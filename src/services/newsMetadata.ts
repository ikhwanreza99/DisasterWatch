// Conservative headline classification, not verified incident intelligence.
const locations = [
  'Indonesia', 'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Sumatera Selatan', 'Sumatra',
  'Sumatera', 'Riau', 'Jambi', 'Bengkulu', 'Lampung', 'Bangka Belitung', 'Kepulauan Riau',
  'Jakarta', 'Banten', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Yogyakarta',
  'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'NTB', 'NTT',
  'Kalimantan', 'Sulawesi', 'Gorontalo', 'Maluku', 'Papua',
  'Bandung', 'Bekasi', 'Bogor', 'Depok', 'Tangerang', 'Semarang', 'Surabaya', 'Medan',
  'Padang', 'Pekanbaru', 'Palembang', 'Makassar', 'Manado', 'Palu', 'Ambon', 'Jayapura',
  'Denpasar', 'Mataram', 'Kupang', 'Pontianak', 'Banjarmasin', 'Samarinda', 'Balikpapan',
  'Lombok', 'Sumba', 'Cianjur', 'Sukabumi', 'Demak', 'Kudus', 'Garut', 'Lumajang', 'Sentani', 'Flores',
];
const foreign = /\b(Gaza|Palestina|Israel|Jepang|Japan|Filipina|Philippines|Myanmar|Thailand|Vietnam|Nepal|Pakistan|Afghanistan|Turki|Turkey|Taiwan|China|Tiongkok|India|Bangladesh|Amerika|Australia|Malaysia|Korea|Sri Lanka|Haiti)\b/i;
const disasters: [string, RegExp][] = [
  ['flood', /\bbanjir\b/i], ['earthquake', /\bgempa\b/i], ['landslide', /\blongsor\b/i],
  ['tsunami', /\btsunami\b/i], ['volcanic_eruption', /\berupsi\b|gunung meletus/i],
  ['forest_fire', /\bkarhutla\b|kebakaran hutan/i], ['storm', /puting beliung|cuaca ekstrem/i],
  ['drought', /\bkekeringan\b/i],
];
const aid: [string, RegExp][] = [
  ['logistics', /logistik|sembako|makanan|pangan/i], ['clean_water', /air bersih/i],
  ['shelter', /pengungs|tenda|hunian sementara/i], ['medical', /medis|obat|layanan kesehatan/i],
  ['evacuation', /evakuasi|pencarian|penyelamatan/i], ['donation', /donasi|sumbangan/i],
  ['recovery', /rehabilitasi|rekonstruksi|pemulihan/i],
];
export function extractNewsMetadata(title: string) {
  // Foreign-location mentions are held out even when Indonesia is the donor.
  if (foreign.test(title) || /iphone|denaturalization|shnaider/i.test(title)) return null;
  const evidence = locations.filter(location => new RegExp(`\\b${location}\\b`, 'i').test(title));
  if (!evidence.length) return null;
  const disasterTypes = disasters.filter(([, pattern]) => pattern.test(title)).map(([name]) => name);
  if (!disasterTypes.length && !/\bbencana\b/i.test(title)) return null;
  const aidCategories = aid.filter(([, pattern]) => pattern.test(title)).map(([name]) => name);
  const aidRelated = aidCategories.length > 0 || /bantuan|relawan|penyaluran/i.test(title);
  return {
    countryCode: 'ID' as const,
    locationEvidence: evidence,
    disasterTypes: disasterTypes.length ? disasterTypes : ['other'],
    topic: aidRelated ? 'disaster_aid' as const : 'disaster_event' as const,
    aidRelated,
    aidCategories,
    verificationStatus: 'UNVERIFIED' as const,
    extractionMethod: 'headline_keywords_v1' as const,
  };
}
