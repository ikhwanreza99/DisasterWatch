// React hook for BMKG weather forecast (per adm4).
// Fetch on adm4 change + manual refresh (cache bypass). No polling:
// BMKG updates ~2x/day and the 12-min client cache absorbs repeats.
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchForecast } from './bmkgWeatherForecast';
import type { BmkgForecast, BmkgForecastState } from './bmkgWeatherForecast';

export interface UseBmkgWeatherForecast {
  state: BmkgForecastState;
  forecast: BmkgForecast | null;
  error: string | null;
  fromCache: boolean;
  refresh: () => void;
  refreshing: boolean;
}

export function useBmkgWeatherForecast(adm4: string | null): UseBmkgWeatherForecast {
  const [state, setState] = useState<BmkgForecastState>('LOADING');
  const [forecast, setForecast] = useState<BmkgForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
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
    if (!adm4) {
      setForecast(null);
      setError(null);
      setFromCache(false);
      setRefreshing(false);
      setState('NO_LOCATION');
      return () => {
        cancelled = true;
      };
    }
    setRefreshing(true);
    setState((s) => (s === 'READY' ? s : 'LOADING'));
    fetchForecast(adm4, { bypassCache: nonce > 0 })
      .then((res) => {
        if (cancelled || !mounted.current) return;
        setForecast(res.forecast);
        setError(res.error ?? null);
        setFromCache(res.fromCache ?? false);
        setState(res.state);
      })
      .catch(() => {
        if (cancelled || !mounted.current) return;
        setForecast(null);
        setError('Prakiraan BMKG sementara tidak dapat dimuat.');
        setState('NETWORK_ERROR');
      })
      .finally(() => {
        if (!cancelled && mounted.current) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adm4, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { state, forecast, error, fromCache, refresh, refreshing };
}
