export type Severity = 'EXTREME' | 'SEVERE' | 'ABOVE_NORMAL' | 'NO_FLOODING' | 'UNKNOWN';
export const floodLevels: Record<Severity, { label: string; color: string }> = {
  EXTREME: { label: 'Ekstrem', color: '#b91c1c' },
  SEVERE: { label: 'Bahaya', color: '#f04421' },
  ABOVE_NORMAL: { label: 'Peringatan', color: '#f59e0b' },
  NO_FLOODING: { label: 'Normal', color: '#40a66b' },
  UNKNOWN: { label: 'Tidak ada data', color: '#94a3b8' },
};
export interface FloodGauge {
  id: string; name: string; river: string; source: string;
  lat: number; lng: number; qualityVerified: boolean;
  severity: Severity; issuedTime?: string; validUntil?: string;
  unit?: string;
  thresholds?: { warningLevel?: number; dangerLevel?: number; extremeDangerLevel?: number };
  forecastIssuedTime?: string;
  forecast: { time: string; endTime: string; value: number }[];
}
export interface FloodSnapshot {
  version: 1; generatedAt: string; state: 'ready' | 'unavailable';
  gauges: FloodGauge[];
}
export function currentSeverity(gauge: FloodGauge, now = Date.now()): Severity {
  // An expired forecast must never imply current safety.
  if (!gauge.validUntil || Date.parse(gauge.validUntil) < now || !Number.isFinite(Date.parse(gauge.validUntil))) return 'UNKNOWN';
  return gauge.severity;
}
export function normalizeFloodData(gauges: any[], statuses: any[], models: any[], forecasts: Record<string, any>, now = new Date()): FloodSnapshot {
  const statusById = new Map(statuses.map(s => [s.gaugeId, s]));
  const modelById = new Map(models.map(m => [m.gaugeId, m]));
  return { version: 1, state: 'ready', generatedAt: now.toISOString(), gauges: gauges
    .filter(g => g.countryCode === 'ID' && typeof g.gaugeId === 'string' && Number.isFinite(g.location?.latitude) && Number.isFinite(g.location?.longitude))
    .map(g => {
      const status = statusById.get(g.gaugeId);
      const model = modelById.get(g.gaugeId);
      const latest = [...(forecasts[g.gaugeId]?.forecasts ?? [])].filter(f => Number.isFinite(Date.parse(f.issuedTime)))
        .sort((a,b) => Date.parse(b.issuedTime) - Date.parse(a.issuedTime))[0];
      return {
        id: g.gaugeId, name: g.siteName || g.river || g.gaugeId, river: g.river || '', source: g.source || '',
        lat: g.location.latitude, lng: g.location.longitude, qualityVerified: g.qualityVerified === true,
        severity: Object.hasOwn(floodLevels, status?.severity) ? status.severity : 'UNKNOWN',
        issuedTime: status?.issuedTime, validUntil: status?.forecastTimeRange?.end,
        unit: model?.gaugeValueUnit, thresholds: model?.thresholds, forecastIssuedTime: latest?.issuedTime,
        forecast: (latest?.forecastRanges ?? []).filter((p: { value: number; forecastStartTime: string }) => Number.isFinite(p.value) && Number.isFinite(Date.parse(p.forecastStartTime)))
          .map((p: { value: number; forecastStartTime: string; forecastEndTime: string }) => ({ time: p.forecastStartTime, endTime: p.forecastEndTime, value: p.value }))
          .sort((a: { time: string },b: { time: string }) => Date.parse(a.time) - Date.parse(b.time)),
      };
    }) };
}
