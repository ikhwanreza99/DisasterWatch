import type { IncidentArticle } from '../domain/incidentDetail';
// Reviewed article metadata; no article body is copied or claimed to be fetched.
export const currentMedia: IncidentArticle[] = [
  {
    incidentId: 'padang', sourceName: 'Liputan6', sourceType: 'NEWS_MEDIA',
    title: 'Banjir Menerjang Kota Padang',
    url: 'https://www.liputan6.com/regional/read/8310406/banjir-menerjang-kota-padang',
    publishedAt: '2026-10-10T20:50:00+07:00', retrievedAt: '2026-10-12T23:00:00+07:00',
    summary: 'Laporan banjir di Kota Padang pada 10 Oktober, termasuk kawasan Koto Tangah.',
    contentStatus: 'METADATA_ONLY', discoveredBy: 'reviewed-publisher-metadata',
  },
  {
    incidentId: 'padang', sourceName: 'ANTARA', sourceType: 'NEWS_MEDIA',
    title: 'Banjir bandang di Padang',
    url: 'https://www.antaranews.com/foto/5780196/banjir-bandang-di-padang',
    publishedAt: '2026-10-10T20:09:00+07:00', retrievedAt: '2026-10-12T23:00:00+07:00',
    summary: 'Dokumentasi evakuasi warga terdampak banjir di Padang.',
    contentStatus: 'METADATA_ONLY', discoveredBy: 'reviewed-publisher-metadata',
  },
  {
    incidentId: 'palembang-2026-10', sourceName: 'RRI', sourceType: 'NEWS_MEDIA',
    title: 'Palembang Diselimuti Asap Karhutla, Udara Masuk Kategori Berbahaya',
    url: 'https://rri.co.id/palembang/regional/2779449/palembang-diselimuti-asap-karhutla-udara-masuk-kategori-berbahaya',
    publishedAt: '2026-10-01T11:21:00+07:00', retrievedAt: '2026-10-12T00:00:00+07:00',
    summary: 'RRI melaporkan dampak asap karhutla terhadap Kota Palembang. Lokasi dampak asap tidak berarti lokasi sumber api.',
    contentStatus: 'METADATA_ONLY', discoveredBy: 'reviewed-publisher-metadata',
  },
  {
    incidentId: 'kobar-2026-10', sourceName: 'detikKalimantan', sourceType: 'NEWS_MEDIA',
    title: 'Karhutla, Batik Air dan NAM Air Hentikan Penerbangan di Pangkalan Bun',
    url: 'https://www.detik.com/kalimantan/bisnis/d-8702783/karhutla-batik-air-dan-nam-air-hentikan-penerbangan-di-pangkalan-bun',
    publishedAt: '2026-10-12T09:43:00+07:00', retrievedAt: '2026-10-12T00:00:00+07:00',
    summary: 'Asap karhutla berdampak pada layanan penerbangan di Pangkalan Bun.',
    contentStatus: 'METADATA_ONLY', discoveredBy: 'reviewed-publisher-metadata',
  },
  {
    incidentId: 'merauke-2026-10', sourceName: 'RRI', sourceType: 'NEWS_MEDIA',
    title: 'Polisi dan Warga Berhasil Memadamkan Karhutla di Merauke',
    url: 'https://rri.co.id/jayapura/regional/2786507/polisi-dan-warga-berhasil-memadamkan-karhutla-di-merauke',
    publishedAt: '2026-10-04T22:02:00+07:00', retrievedAt: '2026-10-12T23:00:00+07:00',
    summary: 'Pemadaman karhutla di Candra Jaya, Distrik Kurik, dilaporkan berlangsung pada 2 Oktober. Ini laporan dalam rentang 1–12 Oktober, bukan konfirmasi kejadian 9 Oktober.',
    contentStatus: 'METADATA_ONLY', discoveredBy: 'reviewed-publisher-metadata',
  },
];
