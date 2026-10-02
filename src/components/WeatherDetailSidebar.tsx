import React, { useState, useEffect } from 'react';
import {
  X,
  CloudRain,
  Wind,
  Droplets,
  Sun,
  CloudLightning,
  RefreshCw,
  Compass,
  MapPin,
  Share2,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Info,
  Calendar,
  Gauge,
  Eye,
  Navigation2,
} from 'lucide-react';
import { fetchGoogleWeather, WeatherData } from '../services/weather/googleWeather';
import { DisasterIncident } from '../types';

interface WeatherDetailSidebarProps {
  location: {
    lat: number;
    lng: number;
    name: string;
    province?: string;
    category?: string;
  };
  disaster?: DisasterIncident;
  onClose: () => void;
  onFocusMap: (coords: { lat: number; lng: number }) => void;
  isDarkMode?: boolean;
}

export const WeatherDetailSidebar: React.FC<WeatherDetailSidebarProps> = ({
  location,
  disaster,
  onClose,
  onFocusMap,
  isDarkMode = false,
}) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

  const loadWeatherData = async (force = false) => {
    if (force) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await fetchGoogleWeather(location.lat, location.lng, location.category);
      setWeather(data);
    } catch {
      // Handled in service
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadWeatherData();
  }, [location.lat, location.lng, location.category]);

  const handleCopyCoordinates = () => {
    const coordStr = `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(coordStr);
      setCopiedCoords(true);
      setTimeout(() => setCopiedCoords(false), 2000);
    }
  };

  const handleShareWeather = () => {
    const text = `Pantauan Cuaca Lapangan di ${location.name} (${location.lat.toFixed(4)}°, ${location.lng.toFixed(4)}°): ${weather?.temperature ?? '-'}°C, ${weather?.conditionText ?? '-'}.`;
    if (navigator.share) {
      navigator
        .share({
          title: `DisasterWatch: Cuaca Lapangan ${location.name}`,
          text,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      alert('Informasi cuaca berhasil disalin ke clipboard!');
    }
  };

  // Operational Disaster Mitigations based on live conditions
  const getOperationalAdvice = () => {
    if (!weather) return [];
    const tips: Array<{ icon: string; title: string; desc: string; type: 'warning' | 'alert' | 'info' }> = [];

    if (weather.rainProbability >= 60 || weather.conditionType.includes('RAIN')) {
      tips.push({
        icon: '🌊',
        title: 'Waspada Curah Hujan Tinggi',
        desc: 'Potensi kenaikan debit air sungai & aliran lahar dingin. Pastikan pompa submersible di posko pengungsian aktif dan jalur tanggul dipantau 24 jam.',
        type: 'warning',
      });
    }

    if ((weather.thunderstormProbability ?? 0) >= 40 || weather.conditionType.includes('THUNDERSTORM')) {
      tips.push({
        icon: '⚡',
        title: 'Siaga Bahaya Petir Aktif',
        desc: 'Tunda sementara evakuasi perahu karet di perairan terbuka dan amankan antena radio komunikasi satgas di bukit terbuka.',
        type: 'alert',
      });
    }

    if (weather.windSpeed >= 20 || (weather.windGust && weather.windGust >= 30)) {
      tips.push({
        icon: '💨',
        title: 'Angin Kencang Lapangan',
        desc: `Kecepatan angin ${weather.windSpeed} km/h (hembusan ${weather.windGust ?? weather.windSpeed + 10} km/h). Risiko perambatan cepat karhutla dan batasi operasional drone pemantau TRC.`,
        type: 'alert',
      });
    }

    if (weather.uvIndex >= 8) {
      tips.push({
        icon: '☀️',
        title: 'Radiasi Panas & UV Ekstrem',
        desc: 'Suhu terasa tinggi. Pastikan kecukupan logistik cairan rehidrasi oralit untuk relawan lapangan dan warga rentan di posko evakuasi.',
        type: 'info',
      });
    }

    if (tips.length === 0) {
      tips.push({
        icon: '🛡️',
        title: 'Kondisi Cuaca Lapangan Kondusif',
        desc: 'Parameter meteorologi stabil untuk kelancaran pendistribusian logistik darat dan penerbangan helikopter pemantau.',
        type: 'info',
      });
    }

    return tips;
  };

  const adviceList = getOperationalAdvice();

  return (
    <aside
      className="absolute top-0 right-0 z-40 h-full w-full sm:w-[490px] sm:max-w-[95vw] p-4 sm:p-5 flex flex-col justify-between overflow-y-auto pointer-events-auto transition-all duration-300 ease-in-out bg-white/98 dark:bg-[#0b1329]/98 backdrop-blur-xl border-l border-slate-200/90 dark:border-slate-800/80 shadow-2xl animate-fadeIn"
      id="weatherDetailSidebar"
    >
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
              <span className="text-base">🌤️</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse shrink-0"></span>
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                  Pantauan Cuaca Lapangan
                </h3>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Google Maps Platform Weather API • MetNet AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleShareWeather}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
              title="Bagikan Data Cuaca"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 flex items-center justify-center transition-all cursor-pointer border border-transparent hover:border-rose-200 dark:hover:border-rose-800"
              title="Tutup & Kembali ke Peta"
              aria-label="Tutup Info Cuaca"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Location & GPS Coordinate Card */}
        <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {location.name}
                  {location.province ? `, ${location.province}` : ''}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-200/60 dark:border-cyan-800/60">
                    {location.lat.toFixed(4)}°, {location.lng.toFixed(4)}°
                  </span>
                  <button
                    onClick={handleCopyCoordinates}
                    className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium cursor-pointer"
                    title="Salin Koordinat GPS"
                  >
                    {copiedCoords ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-emerald-500">Tersalin</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Salin</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <button
              onClick={() => onFocusMap({ lat: location.lat, lng: location.lng })}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer shrink-0 active:scale-95"
              title="Arahkan kamera peta ke koordinat titik cuaca ini"
            >
              <Navigation2 className="w-3.5 h-3.5" />
              <span>Fokus Peta</span>
            </button>
          </div>
        </div>

        {/* Live Weather Conditions Card */}
        {loading && !weather ? (
          <div className="bg-slate-50 dark:bg-slate-900/60 rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 animate-pulse text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-500 mb-2" />
            <p className="text-xs text-slate-500">Mengambil data cuaca Google Maps Platform...</p>
          </div>
        ) : weather ? (
          <>
            {/* Main Weather Hero Card */}
            <div className="bg-gradient-to-br from-cyan-500/10 via-blue-500/5 to-slate-900/20 dark:from-cyan-950/30 dark:via-blue-950/20 dark:to-slate-900/60 rounded-3xl p-4 sm:p-5 border border-cyan-500/20 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/15">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                    <Sparkles className="w-2.5 h-2.5" />
                    {weather.source === 'google' ? 'Google MetNet LIVE' : 'Mode Offline / Simulasi'}
                  </span>
                  {weather.timeZone && (
                    <span className="text-[10px] text-slate-400 font-mono">
                      {weather.timeZone}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => loadWeatherData(true)}
                  disabled={isRefreshing}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
                  title="Perbarui cuaca"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-4 py-1">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                      {weather.temperature}°C
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Terasa {weather.feelsLike}°C
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mt-1 capitalize">
                    {weather.conditionText}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Data satelit dan stasiun meteorologi terdekat
                  </p>
                </div>

                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/80 dark:bg-slate-800/80 border border-white/60 dark:border-slate-700/60 flex items-center justify-center p-3 shadow-md shrink-0">
                  <img
                    src={weather.iconUrl}
                    alt={weather.conditionText}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              </div>
            </div>

            {/* 6 Key Operational Weather Metrics */}
            <div className="grid grid-cols-3 gap-2">
              {/* Rain Probability */}
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold mb-1">
                  <CloudRain className="w-3.5 h-3.5 text-sky-500" />
                  <span>Potensi Hujan</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {weather.rainProbability}%
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${
                    weather.rainProbability >= 60
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                      : weather.rainProbability >= 30
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {weather.rainProbability >= 60 ? 'Tinggi' : weather.rainProbability >= 30 ? 'Sedang' : 'Rendah'}
                </span>
              </div>

              {/* Wind Speed & Gust */}
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold mb-1">
                  <Wind className="w-3.5 h-3.5 text-teal-500" />
                  <span>Kec. Angin</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {weather.windSpeed} <span className="text-[10px] font-normal text-slate-400">km/h</span>
                </div>
                <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium block mt-1 truncate">
                  Arah: {weather.windDirection}
                </span>
              </div>

              {/* Thunderstorm Probability */}
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold mb-1">
                  <CloudLightning className="w-3.5 h-3.5 text-amber-500" />
                  <span>Potensi Petir</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {weather.thunderstormProbability ?? 0}%
                </div>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-1 inline-block ${
                    (weather.thunderstormProbability ?? 0) >= 40
                      ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300'
                      : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300'
                  }`}
                >
                  {(weather.thunderstormProbability ?? 0) >= 40 ? 'Waspada' : 'Aman'}
                </span>
              </div>

              {/* Humidity */}
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold mb-1">
                  <Droplets className="w-3.5 h-3.5 text-blue-500" />
                  <span>Kelembaban</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {weather.humidity}%
                </div>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">
                  Udara Permukaan
                </span>
              </div>

              {/* UV Index */}
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold mb-1">
                  <Sun className="w-3.5 h-3.5 text-amber-500" />
                  <span>Indeks UV</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {weather.uvIndex} <span className="text-[10px] font-normal text-slate-400">/ 11</span>
                </div>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">
                  {weather.uvIndex >= 8 ? 'Sangat Tinggi' : weather.uvIndex >= 6 ? 'Tinggi' : 'Sedang'}
                </span>
              </div>

              {/* Air Pressure */}
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-3 border border-slate-200/80 dark:border-slate-800 text-center">
                <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold mb-1">
                  <Gauge className="w-3.5 h-3.5 text-purple-500" />
                  <span>Tekanan</span>
                </div>
                <div className="text-base font-black text-slate-900 dark:text-white">
                  {weather.airPressure ?? 1010} <span className="text-[10px] font-normal text-slate-400">hPa</span>
                </div>
                <span className="text-[9px] text-slate-400 font-medium block mt-1">
                  Barometrik
                </span>
              </div>
            </div>

            {/* Field Operational Advice (AI Powered Mitigation) */}
            <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2 pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  Rekomendasi Operasional Tanggap Darurat (TRC)
                </h4>
              </div>

              <div className="space-y-2.5">
                {adviceList.map((tip, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl p-3 border text-xs flex items-start gap-2.5 ${
                      tip.type === 'alert'
                        ? 'bg-rose-50/70 border-rose-200/80 dark:bg-rose-950/30 dark:border-rose-800/40 text-rose-900 dark:text-rose-200'
                        : tip.type === 'warning'
                        ? 'bg-amber-50/70 border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-800/40 text-amber-900 dark:text-amber-200'
                        : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200/70 dark:border-slate-700/60 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="text-base shrink-0 mt-0.5">{tip.icon}</span>
                    <div className="min-w-0">
                      <strong className="font-bold block leading-snug">{tip.title}</strong>
                      <p className="text-[11px] opacity-90 mt-0.5 leading-relaxed">{tip.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3-Day Forecast Cards */}
            {weather.forecast && weather.forecast.length > 0 && (
              <div className="bg-white dark:bg-slate-900/70 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs">
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-500" />
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                      Prakiraan Cuaca 3 Hari (Google Earth AI)
                    </h4>
                  </div>
                  <span className="text-[10px] text-slate-400">Pembaruan berkala</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {weather.forecast.map((day, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-2.5 text-center border border-slate-200/70 dark:border-slate-700/60"
                    >
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block truncate">
                        {day.dayName}
                      </span>
                      <span className="text-[9px] text-slate-400 block mb-1">{day.date}</span>

                      <div className="w-8 h-8 mx-auto my-1">
                        <img
                          src={day.iconUrl}
                          alt={day.conditionText}
                          className="w-full h-full object-contain"
                        />
                      </div>

                      <div className="text-xs font-black text-slate-900 dark:text-white mt-1">
                        {day.maxTemp}° <span className="text-[10px] font-normal text-slate-400">{day.minTemp}°</span>
                      </div>
                      <span className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 block mt-0.5">
                        🌧️ {day.rainProbability}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Footer Attribution */}
      <div className="pt-3 mt-4 border-t border-slate-100 dark:border-slate-800 text-center">
        <p className="text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
          <span>Didukung oleh</span>
          <span className="font-bold text-slate-600 dark:text-slate-300">Google Maps Platform Weather API</span>
          <span>•</span>
          <span className="text-cyan-600 dark:text-cyan-400 font-semibold">MetNet Model</span>
        </p>
      </div>
    </aside>
  );
};
