/** English translations — weather slice. Keys are the Indonesian source strings. */
const weather: Record<string, string> = {
  // WeatherCard
  'Cuaca Lapangan: {name}': 'Field Weather: {name}',
  Simulasi: 'Simulation',
  'Segarkan cuaca terkini': 'Refresh current weather',
  'Terasa {temp}°C': 'Feels like {temp}°C',
  'Siaga Petir': 'Lightning Alert',
  'Hujan Tinggi': 'Heavy Rain',
  'Angin Kencang': 'Strong Wind',
  Hujan: 'Rain',
  Angin: 'Wind',
  Lembab: 'Humidity',
  'Prakiraan 3 Hari (Google Earth AI)': '3-Day Forecast (Google Earth AI)',

  // WeatherDetailSidebar
  'Pantauan Cuaca Lapangan di {name} ({lat}°, {lng}°): {temp}°C, {condition}.':
    'Field Weather Monitoring at {name} ({lat}°, {lng}°): {temp}°C, {condition}.',
  'DisasterWatch: Cuaca Lapangan {name}': 'DisasterWatch: Field Weather {name}',
  'Informasi cuaca berhasil disalin ke clipboard!': 'Weather information copied to clipboard!',
  'Waspada Curah Hujan Tinggi': 'High Rainfall Warning',
  'Potensi kenaikan debit air sungai & aliran lahar dingin. Pastikan pompa submersible di posko pengungsian aktif dan jalur tanggul dipantau 24 jam.':
    'Potential rise in river discharge & cold lava flow. Make sure submersible pumps at the evacuation post are active and levee routes are monitored 24 hours.',
  'Siaga Bahaya Petir Aktif': 'Active Lightning Hazard Alert',
  'Tunda sementara evakuasi perahu karet di perairan terbuka dan amankan antena radio komunikasi satgas di bukit terbuka.':
    'Temporarily postpone rubber-boat evacuations in open waters and secure the task-force communication radio antennas on open hills.',
  'Angin Kencang Lapangan': 'Strong Field Winds',
  'Kecepatan angin {speed} km/h (hembusan {gust} km/h). Risiko perambatan cepat karhutla dan batasi operasional drone pemantau TRC.':
    'Wind speed {speed} km/h (gusts {gust} km/h). Risk of rapid wildfire spread; limit TRC surveillance drone operations.',
  'Radiasi Panas & UV Ekstrem': 'Extreme Heat & UV Radiation',
  'Suhu terasa tinggi. Pastikan kecukupan logistik cairan rehidrasi oralit untuk relawan lapangan dan warga rentan di posko evakuasi.':
    'Feels very hot. Ensure an adequate supply of oral rehydration fluids for field volunteers and vulnerable residents at the evacuation post.',
  'Kondisi Cuaca Lapangan Kondusif': 'Favourable Field Weather Conditions',
  'Parameter meteorologi stabil untuk kelancaran pendistribusian logistik darat dan penerbangan helikopter pemantau.':
    'Meteorological parameters are stable, supporting smooth ground logistics distribution and surveillance helicopter flights.',
  'Pantauan Cuaca Lapangan': 'Field Weather Monitoring',
  'Bagikan Data Cuaca': 'Share Weather Data',
  'Tutup & Kembali ke Peta': 'Close & Return to Map',
  'Tutup Info Cuaca': 'Close Weather Info',
  Tersalin: 'Copied',
  Salin: 'Copy',
  'Salin Koordinat GPS': 'Copy GPS Coordinates',
  'Arahkan kamera peta ke koordinat titik cuaca ini':
    "Point the map camera at this weather point's coordinates",
  'Fokus Peta': 'Focus Map',
  'Mengambil data cuaca Google Maps Platform...': 'Fetching Google Maps Platform weather data...',
  'Mode Offline / Simulasi': 'Offline / Simulation Mode',
  'Perbarui cuaca': 'Refresh weather',
  'Data satelit dan stasiun meteorologi terdekat':
    'Data from satellites and the nearest meteorological stations',
  'Potensi Hujan': 'Rain Chance',
  Tinggi: 'High',
  Sedang: 'Moderate',
  Rendah: 'Low',
  'Kec. Angin': 'Wind Spd.',
  'Arah: {dir}': 'Direction: {dir}',
  'Potensi Petir': 'Lightning Chance',
  Waspada: 'Alert',
  Aman: 'Safe',
  Kelembaban: 'Humidity',
  'Udara Permukaan': 'Surface Air',
  'Indeks UV': 'UV Index',
  'Sangat Tinggi': 'Very High',
  Tekanan: 'Pressure',
  Barometrik: 'Barometric',
  'Rekomendasi Operasional Tanggap Darurat (TRC)':
    'Emergency Response Operational Recommendations (TRC)',
  'Prakiraan Cuaca 3 Hari (Google Earth AI)': '3-Day Weather Forecast (Google Earth AI)',
  'Pembaruan berkala': 'Periodic updates',
  'Didukung oleh': 'Supported by',

  // BmkgForecastPanel
  'Refresh prakiraan (manual)': 'Refresh forecast (manual)',
  'Memuat prakiraan BMKG…': 'Loading BMKG forecast…',
  'Prakiraan BMKG belum tersedia untuk lokasi ini.':
    'BMKG forecast is not yet available for this location.',
  'Kode wilayah tidak ditemukan di BMKG.': 'Region code not found at BMKG.',
  'Prakiraan BMKG sementara tidak dapat dimuat.': 'BMKG forecast temporarily unavailable.',
  'Prakiraan Cuaca': 'Weather Forecast',

  // BmkgWeatherWarningCard
  '{count} aktif': '{count} active',
  'Memuat peringatan dini cuaca BMKG…': 'Loading BMKG weather early warnings…',
  'Data peringatan dini tersedia di BMKG, tetapi endpoint resmi BMKG saat ini tidak mengizinkan akses langsung dari browser DisasterWatch.':
    "Early-warning data is available at BMKG, but BMKG's official endpoint currently does not allow direct access from the DisasterWatch browser.",
  'Refresh peringatan cuaca BMKG (manual)': 'Refresh BMKG weather warnings (manual)',
  'Memuat…': 'Loading…',

  // Google Air Quality — merged into the CUACA city chip
  'Cuaca & kualitas udara {name}': 'Weather & air quality {name}',
  'Kualitas udara (UAQI):': 'Air quality (UAQI):',
  'polutan dominan': 'dominant pollutant',
  // Google's Universal AQI runs opposite to conventional AQIs: 100 is cleanest
  // and 0 is worst, so the UI has to say so or the number reads backwards.
  'makin tinggi makin baik': 'higher is better',
};

export default weather;
