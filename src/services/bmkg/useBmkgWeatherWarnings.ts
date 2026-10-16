// React hook for BMKG weather warnings (V1).
// Fetch on mount + manual refresh. No aggressive polling: optional
// auto-refresh requires >= 5 minutes (BMKG limit: 60 req/min/IP, and one
// refresh already fans out to 1 RSS + N CAP requests).
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBmkgWeatherWarnings, getWeatherWarningAccess } from './bmkgWeatherWarning';
import type { BmkgWeatherErrorType } from './bmkgWeatherWarning';
import type { BmkgWeatherWarning } from './bmkgTypes';
import type { BmkgStatus } from './bmkgTypes';

export const MIN_WEATHER_AUTO_REFRESH_MS = 300_000;

export interface UseBmkgWeatherWarnings {
  warnings: BmkgWeatherWarning[];
  active: BmkgWeatherWarning[];
  upcoming: BmkgWeatherWarning[];
  status: BmkgStatus;
  /** Machine-readable fetch class; drives accurate blocked-state messaging. */
  errorType: BmkgWeatherErrorType;
  refresh: () => void;
  refreshing: boolean;
}

export function useBmkgWeatherWarnings(options: { autoRefreshMs?: number; enabled?: boolean } = {}): UseBmkgWeatherWarnings {
  const { autoRefreshMs = 0, enabled = true } = options;
  const [warnings, setWarnings] = useState<BmkgWeatherWarning[]>([]);
  const [status, setStatus] = useState<BmkgStatus>({ state: 'idle' });
  const [errorType, setErrorType] = useState<BmkgWeatherErrorType>('UNKNOWN');
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
    if (!enabled) { setRefreshing(false); return; }
    let cancelled = false;
    // Capability gate: the nowcast endpoints are known browser-blocked, so do
    // NOT attempt the request (avoids the CORS console error entirely).
    // The RSS/CAP parser + transport stay intact for future/server use.
    if (getWeatherWarningAccess() === 'BROWSER_ACCESS_BLOCKED') {
      setWarnings([]);
      setErrorType('RSS_CORS_BLOCKED');
      setStatus({ state: 'unavailable', reason: 'Official BMKG source exists; browser access restricted.' });
      setRefreshing(false);
      return () => {
        cancelled = true;
      };
    }
    setRefreshing(true);
    setStatus((s) => (s.state === 'ready' ? s : { state: 'loading' }));
    getBmkgWeatherWarnings()
      .then((res) => {
        if (cancelled || !mounted.current) return;
        setWarnings(res.warnings);
        setErrorType(res.errorType);
        if (res.ok) {
          setStatus({ state: 'ready', count: res.warnings.length, updatedAt: res.fetchedAt });
        } else {
          setStatus({ state: 'unavailable', reason: 'BMKG weather feed unreachable (network/CORS/HTTP). App data unaffected.' });
        }
      })
      .catch((e: unknown) => {
        if (cancelled || !mounted.current) return;
        setWarnings([]);
        setErrorType('UNKNOWN');
        setStatus({ state: 'unavailable', reason: e instanceof Error ? e.message.slice(0, 200) : 'BMKG fetch failed.' });
      })
      .finally(() => {
        if (!cancelled && mounted.current) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce, enabled]);

  useEffect(() => {
    if (!enabled || !autoRefreshMs || autoRefreshMs < MIN_WEATHER_AUTO_REFRESH_MS) return;
    const t = setInterval(() => setNonce((n) => n + 1), autoRefreshMs);
    return () => clearInterval(t);
  }, [autoRefreshMs, enabled]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return {
    warnings,
    active: warnings.filter((w) => w.status === 'ACTIVE'),
    upcoming: warnings.filter((w) => w.status === 'UPCOMING'),
    status,
    errorType,
    refresh,
    refreshing,
  };
}
