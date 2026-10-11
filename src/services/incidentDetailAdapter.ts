// Adapter: any incident → IncidentDetailData for the shared template.
// Provenance is explicit per metric; unavailable stays unavailable.
import type { DisasterIncident } from '../types';
import type { ClaimRef, IncidentArticle, IncidentDetailData, OfficialParam } from '../domain/incidentDetail';
import { canonicalUrl } from '../domain/nttCase';
import { descriptorFor } from './incidentRegistry';
import { classifyForIncident } from './incidentNews';
import { extractAidEvents, extractFromReport, extractPosko } from './incidentIntel';
import type { DetailTimelineEvent } from '../components/detail/IncidentTimeline';
import { nttArticlesSeed } from '../data/nttCase';
import { buildNttTimeline, type NttCaseState } from './nttCaseStore';

const DEMO_IDS = new Set(['padang', 'banjar', 'pekanbaru', 'cianjur', 'demak', 'palu', 'jayapura', 'lombok-2018-08-05']);

/** Official parameters from real records only — never demo values, never invented. */
function officialParams(incidentId: string, ntt: NttCaseState | null): OfficialParam[] {
  if (incidentId === 'ntt-sumba-barat-daya-2026-10-04') {
    const kase = ntt?.kase;
    if (!kase) return [];
    return kase.revisions.map((r) => ({
      label: r.revision === 'initial' ? 'Parameter awal BMKG' : 'Parameter update BMKG',
      value: `M${r.magnitude} · kedalaman ${r.depthKm} km · ${r.latitude}°LS ${r.longitude}°BT — ${r.locationText}. ${r.tsunamiAssessment}.`,
      revision: r.revision,
      reportedAt: r.reportedAt,
      sourceUrl: r.sourceUrl,
      sourceName: 'BMKG',
    }));
  }
  if (incidentId === 'lombok-2018-08-05') {
    return [
      {
        label: 'Parameter BMKG (dimutakhirkan)',
        value: 'M7,0 · kedalaman 15 km · 8,37°LS 116,48°BT — 18 km barat laut Lombok Timur. Sesar Naik Flores. Peringatan dini tsunami diaktivasi; terdeteksi 0,135 m di Carik dan 0,100 m di Badas; berakhir 20:25 WIB.',
        revision: 'update',
        reportedAt: '2018-08-05T18:46:37+07:00',
        sourceUrl: 'https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi',
        sourceName: 'BMKG via BNPB',
      },
    ];
  }
  return [];
}

/** Claims with verification status preserved — reported claims never become verified facts. */
function incidentClaims(incidentId: string, ntt: NttCaseState | null): ClaimRef[] {
  if (incidentId === 'ntt-sumba-barat-daya-2026-10-04') {
    const claims = ntt?.claims;
    if (!claims) return [];
    const sourceOf = new Map((ntt?.articles ?? []).map((a) => [a.id, a.sourceName] as const));
    return claims.map((c) => ({
      claimId: c.claimId,
      claimType: c.claimType,
      claimText: c.claimText,
      location: c.location,
      sourceUrl: c.sourceUrl,
      sourceName: sourceOf.get(c.articleId) ?? null,
      verificationStatus: c.verificationStatus,
    }));
  }
  return [];
}

function nttCandidates(): IncidentArticle[] {
  return nttArticlesSeed.map((a) => ({
    url: a.url,
    title: a.title,
    sourceName: a.sourceName,
    sourceType: a.sourceType,
    publishedAt: a.publishedAt,
    retrievedAt: a.retrievedAt,
    summary: a.summary,
    contentStatus: a.contentStatus,
    incidentId: a.caseId,
    discoveredBy: a.discoveredBy,
  }));
}

export function buildIncidentDetail(
  disaster: DisasterIncident,
  ntt: NttCaseState | null,
  /** Extra crawled candidates (persisted pool) — deduped, classified, never trusted blindly. */
  pool: IncidentArticle[] = [],
): { detail: IncidentDetailData; timeline: DetailTimelineEvent[] } {
  const d = descriptorFor(disaster.id);
  const isDemo = DEMO_IDS.has(disaster.id);
  const isNtt = disaster.id === 'ntt-sumba-barat-daya-2026-10-04';

  // Candidate pool: NTT explicit records + persisted crawl pool (dedup by canonical URL).
  // A search result is never marked relevant merely because a query returned it —
  // every candidate below is classified before display.
  const seen = new Set<string>();
  const raw: IncidentArticle[] = [];
  for (const a of [...nttCandidates(), ...pool]) {
    const key = canonicalUrl(a.url) ?? a.url;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(a);
  }
  const candidates: IncidentArticle[] = d ? raw.map((a) => classifyForIncident(a, d)) : [];
  // Reports linked to this incident also contribute aid/posko evidence.
  const aid = [];
  const posko = [];
  for (const a of candidates) {
    if (a.incidentRelevance?.status !== 'MATCHED') continue;
    aid.push(...extractAidEvents(a, disaster.id, !isNtt));
    posko.push(...extractPosko(a, disaster.id, !isNtt));
  }
  for (const r of disaster.reports) {
    const { aid: ra, posko: rp } = extractFromReport(r, disaster.id, isDemo);
    aid.push(...ra);
    posko.push(...rp);
  }

  const provenance = isNtt
    ? {
        cost: 'UNAVAILABLE' as const,
        impact: 'REPORTED' as const,
        recovery: 'UNAVAILABLE' as const,
        casualties: 'REPORTED' as const,
        aid: 'REPORTED' as const,
        posko: 'UNAVAILABLE' as const,
      }
    : {
        cost: 'DEMO' as const,
        impact: 'DEMO' as const,
        recovery: 'DEMO' as const,
        casualties: 'UNAVAILABLE' as const,
        aid: 'DEMO' as const,
        posko: disaster.route.checkpoints.length > 0 ? ('DEMO' as const) : ('UNAVAILABLE' as const),
      };
  const provenanceNote = isNtt
    ? 'Parameter gempa resmi BMKG; kerusakan/korban = klaim yang dilaporkan (konflik dipertahankan); yang tak ada = Belum tersedia.'
    : 'Angka dampak, biaya, dan pemulihan = data demo prototipe, bukan data resmi BNPB/BMKG. Korban terverifikasi: Belum tersedia.';

  let timeline: DetailTimelineEvent[];
  if (isNtt) {
    const src = ntt
      ? { kase: ntt.kase, articles: ntt.articles }
      : { kase: { sourceUrl: 'https://www.bmkg.go.id/gempabumi/20261004055834' } as never, articles: [] };
    timeline = buildNttTimeline(src as never).map((e) => ({ ...e }));
  } else if (disaster.id === 'lombok-2018-08-05') {
    timeline = [
      { id: 'lb-main', kind: 'EVENT_OCCURRED', at: '2018-08-05T18:46:37+07:00', label: 'Gempa utama M7,0', detail: '18 km barat laut Lombok Timur, kedalaman 15 km (BMKG). Sesar Naik Flores.', sourceUrl: 'https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi' },
      { id: 'lb-tsu', kind: 'SOURCE_PUBLISHED', at: '2018-08-05T18:48:00+07:00', label: 'Peringatan dini tsunami + deteksi', detail: 'Tsunami terdeteksi 0,135 m di Carik, 0,100 m di Badas; peringatan berakhir 20:25 WIB (BMKG).', sourceUrl: 'https://content.bmkg.go.id/wp-content/uploads/Ulasan_Guncangan_Gempa_Lombok_Timur_05082018_5_revisi_1.pdf' },
      { id: 'lb-bnpb', kind: 'SOURCE_PUBLISHED', at: '2018-08-06T02:30:00+07:00', label: 'BNPB: 82 korban jiwa (pendataan sementara)', detail: 'Per 6 Agu 2018 02:30 WIB; angka final berbeda antar sumber — lihat catatan.', sourceUrl: 'https://bnpb.go.id/berita/gempa-7-sr-guncang-lombok-utara-peringatan-dini-tsunami-diaktivasi' },
    ];
  } else {
    timeline = [
      { id: `${disaster.id}-ev`, kind: 'EVENT_OCCURRED', at: null, label: 'Kejadian tercatat', detail: disaster.timestamp, sourceUrl: null },
      ...disaster.reports.slice(0, 5).map((r, i) => ({
        id: `${disaster.id}-rep-${i}`,
        kind: 'SOURCE_PUBLISHED' as const,
        at: null,
        label: `Laporan: ${r.location}`,
        detail: r.desc.slice(0, 140),
        sourceUrl: r.sourceUrl ?? null,
      })),
    ];
  }

  return {
    detail: {
      incidentId: disaster.id,
      provenance,
      provenanceNote,
      articles: candidates,
      aidEvents: aid,
      posko,
      officialParams: officialParams(disaster.id, ntt),
      claims: incidentClaims(disaster.id, ntt),
      crawl: {
        lastAttemptAt: isNtt ? (ntt?.kase.lastCrawlAt ?? null) : null,
        lastSuccessAt: isNtt ? (ntt?.kase.lastCrawlAt ?? null) : null,
        error: isNtt ? null : 'Crawler berita umum tidak tersedia (tanpa ZAPI_API_KEY); insiden ini belum memiliki crawl khusus.',
      },
    },
    timeline,
  };
}
