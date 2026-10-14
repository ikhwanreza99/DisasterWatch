import { recordTokenUsage } from '../../admin/tokenUsage';
import { createCheckRunner } from './automaticChecks';
import { firebaseEnv, getFirebaseApp, firebaseStatus } from '../../lib/firebase/config';
import { getDb } from '../../lib/firebase/firestore';
import { resolveGeminiCandidates, resolveGeminiModel } from '../../lib/firebase/geminiConfig';
import { autocompletePlaces, getPlace, newSessionToken } from '../places/placeSearch';
import { safeStatusError, type ServiceCheck } from './model';

export function initialChecks(): ServiceCheck[] {
  const env = firebaseEnv();
  const maps = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const firebase = firebaseStatus().configured;
  return [
    ['maps', 'Google Maps JavaScript', maps], ['places', 'Google Places · Autocomplete & Details', maps],
    ['weather', 'Google Weather · Kondisi sekarang', maps], ['forecast', 'Google Weather · Prakiraan', maps],
    ['auth', 'Firebase Auth · Google Login', firebase], ['firestore', 'Cloud Firestore · baca dari web', firebase],
    ['storage', 'Firebase Storage · lampiran laporan', !!env.storageBucket],
    ['firebase-ai', 'Firebase AI Logic · Gemini', firebase], ['gemini-direct', 'Gemini Developer API · fallback', !!import.meta.env.VITE_GEMINI_API_KEY],
  ].map(([id, name, configured]) => ({ id: String(id), name: String(name), state: configured ? 'configured' : 'disabled', detail: configured ? 'Konfigurasi tersedia; belum ada bukti request berhasil dari halaman ini.' : 'Konfigurasi browser belum tersedia.', checkedAt: null, scope: 'browser' }));
}
async function checkedJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}${await safeErrorSnippet(response)}`);
  return response.json();
}
/** Short, key-safe snippet of an error body so HTTP codes carry a cause. */
async function safeErrorSnippet(response: Response): Promise<string> {
  try {
    const clone = response.clone();
    const body = await clone.text();
    if (!body) return '';
    const snippet = body.replace(/AIza[0-9A-Za-z\-_]{10,}/g, '[KEY]').slice(0, 160);
    return ` · ${snippet}`;
  } catch {
    return '';
  }
}
/**
 * Try Gemini model candidates in order; return the model that answered.
 * Throws the last error when every candidate fails.
 */
function fallbackNote(used: string, primary: string, lastError: unknown): string {
  if (used === primary) return `menggunakan ${used}, tanpa fallback.`;
  const cause = lastError instanceof Error ? lastError.message.slice(0, 120) : 'tidak tersedia';
  return `menggunakan ${used} (fallback otomatis karena ${primary} gagal: ${cause}).`;
}
export async function runBrowserCheck(id: string): Promise<ServiceCheck> {
  const base = initialChecks().find(c => c.id === id)!;
  if (base.state === 'disabled') return base;
  const checkedAt = new Date().toISOString();
  let firestoreSession: string | null = null;
  try {
    let detail = '';
    const env = firebaseEnv();
    if (id === 'firestore') {
      const { getAuthInstance } = await import('../../lib/firebase/auth');
      const auth = getAuthInstance();
      if (auth) await auth.authStateReady();
      firestoreSession = auth?.currentUser ? 'Sesi login dipulihkan' : 'Tidak ada sesi login';
      const { getDocsFromServer, query, collection, limit } = await import('firebase/firestore');
      const db = getDb(); if (!db) throw new Error('No database');
      const snap = await getDocsFromServer(query(collection(db, 'incidentArticles'), limit(1)));
      detail = `Baca Firestore dari server berhasil; sampel ${snap.size} artikel.`;
    } else if (id === 'auth') {
      const data = await checkedJson(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(env.apiKey)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerId: 'google.com', continueUri: window.location.origin }) });
      if (!data.authUri) throw new Error('No OAuth URL');
      detail = 'Endpoint Google OAuth menghasilkan URL login. Login pengguna sampai selesai belum diuji.';
    } else if (id === 'places') {
      const token = newSessionToken();
      const places = await autocompletePlaces('Jakarta', token, AbortSignal.timeout(20_000));
      if (!places.length) return { ...base, checkedAt, state: 'empty', detail: 'Autocomplete berhasil; tidak ada saran lokasi.' };
      await getPlace(places[0].placeId, token, AbortSignal.timeout(20_000));
      detail = `Autocomplete dan Place Details berhasil; ${places.length} saran.`;
    } else if (id === 'weather' || id === 'forecast') {
      const endpoint = id === 'weather' ? 'currentConditions:lookup' : 'forecast/days:lookup';
      const data = await checkedJson(`https://weather.googleapis.com/v1/${endpoint}?key=${encodeURIComponent(import.meta.env.VITE_GOOGLE_MAPS_API_KEY)}&location.latitude=-6.2&location.longitude=106.8&languageCode=id`);
      if (id === 'weather' ? !data.temperature : !Array.isArray(data.forecastDays) || !data.forecastDays.length) throw new Error('No weather payload');
      detail = 'Respons Weather API valid untuk Jakarta; tidak memakai cuaca simulasi.';
    } else if (id === 'gemini-direct') {
      const candidates = resolveGeminiCandidates();
      const primary = candidates[0]!;
      let lastError: unknown = null;
      let used = '';
      for (const model of candidates) {
        try {
          // One retry for transient overload (HTTP 503/429) before moving on.
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              const data = await checkedJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': import.meta.env.VITE_GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Jawab satu kata: OK' }] }], generationConfig: { maxOutputTokens: 64 } }) });
              if (!data.candidates?.some((c: any) => c.content?.parts?.some((p: any) => p.text))) throw new Error('Empty model response');
              recordTokenUsage(data.usageMetadata, model, 'Status · Gemini Direct');
              used = model;
              break;
            } catch (e) {
              lastError = e;
              const transient = e instanceof Error && /HTTP (429|500|502|503|504)/.test(e.message);
              if (!transient || attempt === 1) throw e;
              await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
            }
          }
          if (used) break;
        } catch (e) { lastError = e; }
      }
      if (!used) throw lastError instanceof Error ? lastError : new Error('Gemini Direct gagal pada semua model kandidat');
      detail = `GenerateContent berhasil ${fallbackNote(used, primary, lastError)}`;
    } else if (id === 'firebase-ai') {
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
      const app = getFirebaseApp(); if (!app) throw new Error('No Firebase app');
      const candidates = resolveGeminiCandidates();
      const primary = candidates[0]!;
      let lastError: unknown = null;
      let used = '';
      for (const model of candidates) {
        try {
          const generative = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model, generationConfig: { maxOutputTokens: 64 } });
          const response = await generative.generateContent('Jawab satu kata: OK');
          if (!response.response.text()) throw new Error('Empty model response');
          recordTokenUsage(response.response.usageMetadata, model, 'Status · Firebase AI Logic');
          used = model;
          break;
        } catch (e) { lastError = e; }
      }
      if (!used) throw lastError instanceof Error ? lastError : new Error('Firebase AI Logic gagal pada semua model kandidat');
      detail = `Firebase AI Logic berhasil ${fallbackNote(used, primary, lastError)}`;
    } else if (id === 'storage') {
      return { ...base, detail: 'Bucket terkonfigurasi. Upload/download membutuhkan pengguna login dan lampiran; tidak mengunggah file uji otomatis.' };
    } else if (id === 'maps') {
      return { ...base, detail: 'Uji peta melalui tombol “Uji Maps” pada halaman status.' };
    }
    return { ...base, state: 'ok', checkedAt, detail };
  } catch (e) { return { ...base, state: 'error', checkedAt, detail: safeStatusError(e) + (firestoreSession ? ` · ${firestoreSession}` : '') }; }
}

// Persist sanitized evidence for 10 minutes in this tab, without API keys.
async function checkedWithCache(id: string, force = false): Promise<ServiceCheck> {
  const key = `dw:status:v4:${id}:${resolveGeminiModel()}`;
  // Firestore always restores current identity after navigation; do not reuse another session.
  if (!force && id !== 'firestore') try {
    const saved = JSON.parse(sessionStorage.getItem(key) || 'null') as ServiceCheck | null;
    const age = saved?.checkedAt ? Date.now() - Date.parse(saved.checkedAt) : Infinity;
    if (saved?.id === id && ['ok','error','empty'].includes(saved.state) && age >= 0 && age < 10 * 60_000) return saved;
  } catch { /* storage unavailable */ }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const base = initialChecks().find(c => c.id === id)!;
  const result = await Promise.race([
    runBrowserCheck(id),
    new Promise<ServiceCheck>(resolve => { timer=setTimeout(()=>resolve({...base,state:'error',checkedAt:new Date().toISOString(),detail:'Batas waktu pemeriksaan habis (25 detik).'}),25_000); }),
  ]);
  clearTimeout(timer);
  try { sessionStorage.setItem(key, JSON.stringify(result)); } catch { /* storage unavailable */ }
  return result;
}

const automaticRunner = createCheckRunner(id => checkedWithCache(id));
export function probeBrowserCheck(id: string, force = false) {
  if (force) {
    try { sessionStorage.removeItem(`dw:status:v4:${id}:${resolveGeminiModel()}`); } catch { /* storage unavailable */ }
  }
  return automaticRunner(id, force);
}
