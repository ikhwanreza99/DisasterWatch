import { createCheckRunner } from './automaticChecks';
import { firebaseEnv, getFirebaseApp, firebaseStatus } from '../../lib/firebase/config';
import { getDb } from '../../lib/firebase/firestore';
import { resolveGeminiModel } from '../../lib/firebase/geminiConfig';
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
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export async function runBrowserCheck(id: string): Promise<ServiceCheck> {
  const base = initialChecks().find(c => c.id === id)!;
  if (base.state === 'disabled') return base;
  const checkedAt = new Date().toISOString();
  try {
    let detail = '';
    const env = firebaseEnv();
    if (id === 'firestore') {
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
      const data = await checkedJson(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(resolveGeminiModel())}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': import.meta.env.VITE_GEMINI_API_KEY }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Jawab satu kata: OK' }] }], generationConfig: { maxOutputTokens: 64 } }) });
      if (!data.candidates?.some((c: any) => c.content?.parts?.some((p: any) => p.text))) throw new Error('Empty model response');
      detail = `GenerateContent berhasil menggunakan ${resolveGeminiModel()}, tanpa fallback.`;
    } else if (id === 'firebase-ai') {
      const { getAI, getGenerativeModel, GoogleAIBackend } = await import('firebase/ai');
      const app = getFirebaseApp(); if (!app) throw new Error('No Firebase app');
      const model = getGenerativeModel(getAI(app, { backend: new GoogleAIBackend() }), { model: resolveGeminiModel(), generationConfig: { maxOutputTokens: 64 } });
      const response = await model.generateContent('Jawab satu kata: OK');
      if (!response.response.text()) throw new Error('Empty model response');
      detail = `Firebase AI Logic berhasil menggunakan ${resolveGeminiModel()}, tanpa fallback.`;
    } else if (id === 'storage') {
      return { ...base, detail: 'Bucket terkonfigurasi. Upload/download membutuhkan pengguna login dan lampiran; tidak mengunggah file uji otomatis.' };
    } else if (id === 'maps') {
      return { ...base, detail: 'Uji peta melalui tombol “Uji Maps” pada halaman status.' };
    }
    return { ...base, state: 'ok', checkedAt, detail };
  } catch (e) { return { ...base, state: 'error', checkedAt, detail: safeStatusError(e) }; }
}

// Persist sanitized evidence for 10 minutes in this tab, without API keys.
async function checkedWithCache(id: string, force = false): Promise<ServiceCheck> {
  const key = `dw:status:v3:${id}:${resolveGeminiModel()}`;
  if (!force) try {
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
    try { sessionStorage.removeItem(`dw:status:v3:${id}:${resolveGeminiModel()}`); } catch { /* storage unavailable */ }
  }
  return automaticRunner(id, force);
}
