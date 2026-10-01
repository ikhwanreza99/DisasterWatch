// React hook for BMKG V1: fetch on mount + manual refresh.
// No aggressive polling. Optional conservative auto-refresh is OFF by default;
// if enabled, keep >= 10 min and document it at the call site.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllBmkgEarthquakes } from './bmkgEarthquake';
import type { BmkgCombinedResult } from './bmkgEarthquake';
import type { EarthquakeEvent } from './bmkgTypes';
import type { BmkgStatus } from './bmkgTypes';

export interface UseBmkgOptions {
  /** Set to e.g. 600_000 for 10-min refresh. 0 = off (default). */
  autoRefreshMs?: number;
}

export interface UseBmkgEarthquakes {
  events: EarthquakeEvent[];
  latest: EarthquakeEvent | null;
  status: BmkgStatus;
  perFeed: BmkgCombinedResult['perFeed'] | null;
  refresh: () => void;
  refreshing: boolean;
}

export function useBmkgEarthquakes(options: UseBmkgOptions = {}): UseBmkgEarthquakes {
  const { autoRefreshMs = 0 } = options;
  const [events, setEvents] = useState<EarthquakeEvent[]>([]);
  const [status, setStatus] = useState<BmkgStatus>({ state: 'idle' });
  const [perFeed, setPerFeed] = useState<UseBmkgEarthquakes['perFeed']>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setRefreshing(true);
    setStatus((s) => (s.state === 'ready' ? s : { state: 'loading' }));
    getAllBmkgEarthquakes()
      .then((res) => {
        if (cancelled || !mounted.current) return;
        setEvents(res.events);
        setPerFeed(res.perFeed);
        if (res.anyOk) {
          setStatus({ state: 'ready', count: res.events.length, updatedAt: res.retrievedAt });
        } else {
          setStatus({ state: 'unavailable', reason: 'BMKG public feed unreachable (network/CORS/HTTP). App data unaffected.' });
        }
      })
      .catch((e: unknown) => {
        if (cancelled || !mounted.current) return;
        setEvents([]);
        setStatus({
          state: 'unavailable',
          reason: e instanceof Error ? e.message.slice(0, 200) : 'BMKG fetch failed.',
        });
      })
      .finally(() => {
        if (!cancelled && mounted.current) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  // Conservative optional auto-refresh only.
  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs < 600_000) return;
    const t = setInterval(() => setNonce((n) => n + 1), autoRefreshMs);
    return () => clearInterval(t);
  }, [autoRefreshMs]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    events,
    latest: events.length > 0 ? events[0]! : null,
    status,
    perFeed,
    refresh,
    refreshing,
  };
}
