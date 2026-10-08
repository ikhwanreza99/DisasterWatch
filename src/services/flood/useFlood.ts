import { useEffect, useState } from 'react';
import type { FloodSnapshot } from './data';
export function useFlood(enabled: boolean) {
  const [data, setData] = useState<FloodSnapshot | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState('loading');
    fetch('/data/flood.json', { signal: controller.signal, cache: 'no-cache' })
      .then(async response => {
        if (!response.ok) throw new Error('Snapshot unavailable');
        const json = await response.json();
        if (json.version !== 1 || !Array.isArray(json.gauges) || !Number.isFinite(Date.parse(json.generatedAt))) throw new Error('Invalid snapshot');
        if (!controller.signal.aborted) { setData(json); setState(json.state === 'ready' ? 'ready' : 'unavailable'); }
      }).catch(() => { if (!controller.signal.aborted) { setData(null); setState('unavailable'); } });
    const timer = setTimeout(() => setNonce(n => n + 1), 30 * 60 * 1000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled, nonce]);
  return { data, state, refresh: () => setNonce(n => n + 1) };
}
