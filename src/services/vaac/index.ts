// Volcanic Ash Advisories (VAA) from the Darwin VAAC (Bureau of Meteorology, Australia).
// Darwin VAAC is the ICAO-designated advisory centre for Indonesia, PNG, the Philippines and northern
// Australia; its advisories use Himawari-9 satellite + CVGHM/PVMBG ground reports.
//
// BOM rejects cross-origin browser requests (HTTP 403 when an Origin header is present), so:
//  - dev:        live page through the Vite proxy (/api/vaac, see vite.config.ts)
//  - production: static snapshot /data/vaac.json, rebuilt every ~30 min by GitHub Actions
//                (scripts/fetchVaacSnapshot.ts + .github/workflows/deploy-hosting.yml)
import { useCallback, useEffect, useState } from 'react';
import { parseVaacPage, type AshAdvisory, type VaacStatus } from './parser';

export * from './parser';

const VAAC_PROXY_PATH = '/api/vaac/aviation/warnings/volcanic-ash/';
const VAAC_SNAPSHOT_PATH = '/data/vaac.json';
const CACHE_TTL_MS = 10 * 60_000;

export interface VaacSnapshot {
  fetchedAt: string; // ISO time the server fetched BOM
  advisories: AshAdvisory[];
}

let cache: { at: number; data: VaacSnapshot } | null = null;

async function fetchLive(signal?: AbortSignal): Promise<VaacSnapshot> {
  const res = await fetch(VAAC_PROXY_PATH, { signal });
  const html = await res.text();
  if (!res.ok) throw new Error(`VAAC HTTP ${res.status}`);
  if (!/VA ADVISORY/.test(html)) throw new Error('Proxy /api/vaac tidak aktif — restart npm run dev');
  return { fetchedAt: new Date().toISOString(), advisories: parseVaacPage(html) };
}

async function fetchSnapshot(signal?: AbortSignal): Promise<VaacSnapshot> {
  const res = await fetch(VAAC_SNAPSHOT_PATH, { signal, cache: 'no-cache' });
  if (!res.ok) throw new Error(`Snapshot VAAC belum tersedia (HTTP ${res.status})`);
  const json = (await res.json()) as Partial<VaacSnapshot>;
  if (!json || !Array.isArray(json.advisories) || typeof json.fetchedAt !== 'string') {
    throw new Error('Snapshot VAAC tidak valid');
  }
  return { fetchedAt: json.fetchedAt, advisories: json.advisories };
}

export async function fetchVaac(signal?: AbortSignal): Promise<VaacSnapshot> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;
  const data = import.meta.env.DEV ? await fetchLive(signal) : await fetchSnapshot(signal);
  cache = { at: Date.now(), data };
  return data;
}

/** Fetches only while the layer is ON. */
export function useVaac(enabled: boolean) {
  const [advisories, setAdvisories] = useState<AshAdvisory[]>([]);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<VaacStatus>({ state: 'idle' });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();
    setStatus((s) => (s.state === 'ready' ? s : { state: 'loading' }));
    fetchVaac(ctrl.signal)
      .then((d) => {
        if (ctrl.signal.aborted) return;
        setAdvisories(d.advisories);
        setFetchedAt(d.fetchedAt);
        setStatus({ state: 'ready', updatedAt: d.fetchedAt });
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        setStatus({ state: 'unavailable', reason: e instanceof Error ? e.message : 'VAAC fetch failed' });
      });
    return () => ctrl.abort();
  }, [enabled, nonce]);

  const refresh = useCallback(() => {
    cache = null;
    setNonce((n) => n + 1);
  }, []);
  return { advisories, fetchedAt, status, refresh };
}
