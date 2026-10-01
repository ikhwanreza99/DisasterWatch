// MAGMA Indonesia (PVMBG, Badan Geologi) — volcano activity levels + gerakan tanah (landslide) reports.
// Source: the public map page https://magma.esdm.go.id/ embeds its marker data as JSON arrays
// (markersGunungApi / markersGerakanTanah). The page sends `Access-Control-Allow-Origin: *`,
// so the browser fetches it directly — no proxy, works on static Hosting too.
// The official REST API (/api/v1/...) requires a JWT login and is not used.
// MAGMA earthquakes (markersGempa) are BMKG-sourced, already covered by the BMKG layer → skipped.
import { useCallback, useEffect, useState } from 'react';

export const MAGMA_URL = 'https://magma.esdm.go.id/';
export const MAGMA_VOLCANO_URL = 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas';
export const MAGMA_LANDSLIDE_URL = 'https://magma.esdm.go.id/v1/gerakan-tanah/tanggapan';
const CACHE_TTL_MS = 10 * 60_000;

export type VolcanoLevel = 1 | 2 | 3 | 4;

export const VOLCANO_LEVEL_LABEL: Record<VolcanoLevel, string> = {
  1: 'Level I (Normal)',
  2: 'Level II (Waspada)',
  3: 'Level III (Siaga)',
  4: 'Level IV (Awas)',
};

export const VOLCANO_LEVEL_COLOR: Record<VolcanoLevel, string> = {
  1: '#16a34a',
  2: '#eab308',
  3: '#f97316',
  4: '#dc2626',
};

export interface Volcano {
  code: string;
  name: string;
  regency: string;
  province: string;
  elevationM: number | null;
  latitude: number;
  longitude: number;
  level: VolcanoLevel;
  hasVona: boolean;
  erupting: boolean;
  noticeNumber: string | null;
}

export interface LandslideReport {
  id: string;
  latitude: number;
  longitude: number;
  province: string;
  regency: string;
  date: string; // YYYY-MM-DD
  movementType: string | null; // e.g. "Longsoran Rotasi/Nendatan"
  material: string | null;
  zone: string | null; // kerentanan zone, e.g. "MENENGAH"
}

export interface MagmaData {
  volcanoes: Volcano[];
  landslides: LandslideReport[];
  fetchedAt: string;
}

export type MagmaStatus =
  | { state: 'idle' | 'loading' }
  | { state: 'ready'; updatedAt: string }
  | { state: 'unavailable'; reason: string };

/** Extract the JSON array literal assigned to `var <name> = [...]` (string-aware bracket matching). */
export function extractJsonArray(html: string, name: string): unknown[] | null {
  const at = html.indexOf(`var ${name} = `);
  if (at < 0) return null;
  const start = html.indexOf('[', at);
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inStr) {
      if (ch === '\\') i++;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) {
      try {
        const v = JSON.parse(html.slice(start, i + 1));
        return Array.isArray(v) ? v : null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const first = (v: unknown): string | null => (Array.isArray(v) && typeof v[0] === 'string' ? v[0] : null);

export function parseMagmaHtml(html: string): MagmaData {
  const rawV = extractJsonArray(html, 'markersGunungApi');
  if (!rawV) throw new Error('MAGMA page format changed (markersGunungApi not found)');

  const volcanoes: Volcano[] = [];
  for (const r of rawV as Record<string, unknown>[]) {
    const lat = num(r.ga_lat_gapi);
    const lng = num(r.ga_lon_gapi);
    const lvl = num(r.ga_status);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || ![1, 2, 3, 4].includes(lvl)) continue;
    volcanoes.push({
      code: str(r.ga_code),
      name: str(r.ga_nama_gapi),
      regency: str(r.ga_kab_gapi),
      province: str(r.ga_prov_gapi),
      elevationM: Number.isFinite(num(r.ga_elev_gapi)) ? num(r.ga_elev_gapi) : null,
      latitude: lat,
      longitude: lng,
      level: lvl as VolcanoLevel,
      hasVona: r.has_vona === true,
      erupting: r.erupt_icon === true,
      noticeNumber: str(r.noticenumber) || null,
    });
  }

  const landslides: LandslideReport[] = [];
  for (const r of (extractJsonArray(html, 'markersGerakanTanah') ?? []) as Record<string, unknown>[]) {
    const lat = num(r.crs_lat);
    const lng = num(r.crs_lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const t = (r.tanggapan ?? {}) as Record<string, unknown>;
    landslides.push({
      id: str(r.crs_ids) || `${lat},${lng}`,
      latitude: lat,
      longitude: lng,
      province: str(r.crs_prv),
      regency: str(r.crs_cty),
      date: str(r.date),
      movementType: str(t.qls_tgt) || null,
      material: str(t.qls_mgt) || null,
      zone: first(t.qls_zkg),
    });
  }

  // Highest alert level first.
  volcanoes.sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
  return { volcanoes, landslides, fetchedAt: new Date().toISOString() };
}

let cache: { at: number; data: MagmaData } | null = null;

export async function fetchMagma(signal?: AbortSignal): Promise<MagmaData> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const res = await fetch(MAGMA_URL, { signal, headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error(`MAGMA HTTP ${res.status}`);
  const data = parseMagmaHtml(await res.text());
  cache = { at: Date.now(), data };
  return data;
}

/** Fetches only while the MAGMA layer is ON. */
export function useMagma(enabled: boolean) {
  const [data, setData] = useState<MagmaData | null>(null);
  const [status, setStatus] = useState<MagmaStatus>({ state: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setStatus((s) => (s.state === 'ready' ? s : { state: 'loading' }));
    fetchMagma(ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setData(d);
        setStatus({ state: 'ready', updatedAt: d.fetchedAt });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setStatus({ state: 'unavailable', reason: e instanceof Error ? e.message : 'MAGMA fetch failed' });
      });
    return () => ctrl.abort();
  }, [enabled, nonce]);

  const refresh = useCallback(() => {
    cache = null;
    setNonce((n) => n + 1);
  }, []);

  return { data, status, refresh };
}
