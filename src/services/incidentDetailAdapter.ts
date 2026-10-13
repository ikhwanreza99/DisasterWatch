import { currentArticles, currentRecords } from '../data/currentIncidents';
import { incidentFreshness } from './incidentFreshness';
// Adapter: any incident → IncidentDetailData for the shared template.
// Provenance is explicit per metric; unavailable stays unavailable.
import type { DisasterIncident } from '../types';
import type { ClaimRef, IncidentArticle, IncidentDetailData, OfficialParam } from '../domain/incidentDetail';
import type {
  IncidentAidEventDoc,
  IncidentAidNeedDoc,
  IncidentArticleDoc,
  IncidentClaimDoc,
  IncidentPoskoDoc,
} from '../domain/humanitarian';
import type { AidEventRecord, PoskoRecord } from '../domain/incidentDetail';
import type { RemoteSnapshot } from './store/humanitarianRepo';
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

function articleDocToCandidate(a: IncidentArticleDoc): IncidentArticle {
  const out: IncidentArticle = {
    url: a.url,
    title: a.title,
    sourceName: a.sourceName,
    sourceType: a.sourceType,
    publishedAt: a.publishedAt,
    retrievedAt: a.retrievedAt,
    summary: a.summary,
    contentStatus: a.contentStatus,
    incidentId: null, // Crawl target is not proof that an article matches.
    discoveredBy: a.discoveredBy,
    googleSearchSuggestions: a.googleSearchSuggestions ?? null,
  };
  // Reuse the persisted relevance decision when it targets this incident.
  if (a.relevance?.incidentId === a.incidentId) out.incidentRelevance = a.relevance;
  return out;
}

function claimDocToRef(c: IncidentClaimDoc): ClaimRef {
  return {
    claimId: c.id,
    claimType: c.claimType,
    claimText: c.claimText,
    location: c.location,
    sourceUrl: c.sourceUrl,
    sourceName: c.sourceOrganization,
    verificationStatus: c.verificationStatus,
  };
}

function aidStageToStatus(s: IncidentAidEventDoc['aidStage']): AidEventRecord['distributionStatus'] {
  switch (s) {
    case 'DISTRIBUTED': return 'REPORTED_DISTRIBUTED';
    case 'ARRIVED': return 'REPORTED_RECEIVED';
    case 'DISPATCHED': return 'REPORTED_DISPATCHED';
    default: return 'UNKNOWN';
  }
}

function aidEventDocToRecord(e: IncidentAidEventDoc): AidEventRecord {
  return {
    aidId: e.id,
    incidentId: e.incidentId,
    articleId: e.articleId,
    aidType: e.itemName,
    quantity: e.quantity,
    unit: e.unit,
    estimatedValue: e.estimatedValue,
    recipientOrDestination: e.recipientOrDestination,
    location: e.location,
    distributingOrganization: e.distributingOrganization,
    distributionStatus: aidStageToStatus(e.aidStage),
    eventTime: e.eventTime,
    sourceUrl: e.sourceUrl,
    sourceName: e.sourceOrganization,
    verificationStatus: e.verificationStatus,
    recordKind: 'REPORTED_EVENT',
    isMock: e.isMock,
  };
}

function poskoDocToRecord(p: IncidentPoskoDoc): PoskoRecord {
  return {
    poskoId: p.poskoId,
    incidentId: p.incidentId,
    articleId: p.articleId,
    name: p.name,
    poskoType: p.poskoType,
    address: p.address,
    village: p.village,
    regency: p.regency,
    province: p.province,
    latitude: p.latitude,
    longitude: p.longitude,
    // Only officially-checkpointed coords count as verified (demo/seed coords stay null here).
    coordSource: p.coordinateSource === 'OFFICIAL_CHECKPOINT' ? 'OFFICIAL_CHECKPOINT' : null,
    contact: p.contact,
    capacity: p.capacity,
    occupancy: p.currentOccupancy,
    operationalStatus: p.operationalStatus,
    lastUpdatedAt: p.lastUpdatedAt,
    sourceUrl: p.sourceUrl,
    sourceName: p.sourceOrganization,
    verificationStatus: p.verificationStatus,
    isMock: p.isMock,
  };
}

export function buildIncidentDetail(
  disaster: DisasterIncident,
  ntt: NttCaseState | null,
  /** Extra crawled candidates (persisted pool) — deduped, classified, never trusted blindly. */
  pool: IncidentArticle[] = [],
  /** Firestore-first humanitarian snapshot (explicit fallback when null). */
  remote: RemoteSnapshot | null = null,
): { detail: IncidentDetailData; timeline: DetailTimelineEvent[] } {
  const d = descriptorFor(disaster.id);
  const isDemo = DEMO_IDS.has(disaster.id);
  const isNtt = disaster.id === 'ntt-sumba-barat-daya-2026-10-04';

  // Candidate pool: Firestore docs first, then NTT explicit records, then crawl pool.
  // Dedup by canonical URL; re-classify anything without a decision for THIS incident.
  // A search result is never marked relevant merely because a query returned it —
  // every candidate below is classified before display.
  const seen = new Set<string>();
  const raw: IncidentArticle[] = [];
  for (const a of [...(remote?.articles ?? []).map(articleDocToCandidate), ...currentArticles.filter(a => a.incidentId === disaster.id), ...nttCandidates(), ...pool]) {
    const key = canonicalUrl(a.url) ?? a.url;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(a);
  }
  const candidates: IncidentArticle[] = d ? raw.map((a) => classifyForIncident(a, d)) : [];
  // Reports linked to this incident also contribute aid/posko evidence.
  const aid: AidEventRecord[] = [];
  const posko: PoskoRecord[] = [];
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
  // Firestore-first remote snapshot (explicit fallback when absent): claims deduped
  // by (type, text) so seeded mirrors of the same claim don't double up; aid/posko
  // appended then deduped; needs carried for future panels.
  const localClaimKeys = new Set<string>();
  const baseClaims = incidentClaims(disaster.id, ntt);
  for (const c of baseClaims) localClaimKeys.add(`${c.claimType}|${c.claimText}`);
  const remoteClaims: ClaimRef[] = [];
  for (const c of remote?.claims ?? []) {
    const ref = claimDocToRef(c);
    const key = `${ref.claimType}|${ref.claimText}`;
    if (localClaimKeys.has(key)) continue;
    localClaimKeys.add(key);
    remoteClaims.push(ref);
  }
  const seenAid = new Set(aid.map((a) => a.aidId));
  for (const e of remote?.aidEvents ?? []) {
    const rec = aidEventDocToRecord(e);
    if (seenAid.has(rec.aidId)) continue;
    seenAid.add(rec.aidId);
    aid.push(rec);
  }
  const seenPosko = new Set(posko.map((p) => p.poskoId));
  for (const p of remote?.poskos ?? []) {
    const rec = poskoDocToRecord(p);
    if (seenPosko.has(rec.poskoId)) continue;
    seenPosko.add(rec.poskoId);
    posko.push(rec);
  }
  const remoteNeeds: IncidentAidNeedDoc[] = remote?.needs ?? [];

  const provenance = isNtt
    ? {
        cost: 'UNAVAILABLE' as const,
        impact: 'REPORTED' as const,
        recovery: 'UNAVAILABLE' as const,
        casualties: 'REPORTED' as const,
        aid: 'REPORTED' as const,
        posko: 'UNAVAILABLE' as const,
      }
    : currentRecords.some(r => r.id === disaster.id) ? {
        cost: 'UNAVAILABLE' as const, impact: 'UNAVAILABLE' as const, recovery: 'UNAVAILABLE' as const,
        casualties: 'UNAVAILABLE' as const, aid: 'UNAVAILABLE' as const, posko: 'UNAVAILABLE' as const,
      } : {
        cost: 'DEMO' as const,
        impact: 'DEMO' as const,
        recovery: 'DEMO' as const,
        casualties: 'UNAVAILABLE' as const,
        aid: 'DEMO' as const,
        posko: disaster.route.checkpoints.length > 0 ? ('DEMO' as const) : ('UNAVAILABLE' as const),
      };
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
      { id: `${disaster.id}-ev`, kind: 'EVENT_OCCURRED', at: null, label: 'Kejadian tercatat', detail: disaster.timestamp, sourceUrl: currentRecords.find(r => r.id === disaster.id)?.url ?? null },
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

  // Recovery history surfaces as timestamped timeline events (no UI redesign:
  // status changes carry their source + time, history preserved, never overwritten).
  for (const doc of remote?.recovery ?? []) {
    const entries = doc.history.slice(-2);
    for (const h of entries) {
      timeline.push({
        id: `${doc.id}-${h.at}`,
        kind: 'SOURCE_PUBLISHED',
        at: h.at,
        label: `Layanan ${doc.serviceType}: ${h.status}${doc.affectedArea ? ` — ${doc.affectedArea}` : ''}`,
        detail: doc.impactDescription ?? `Perubahan status tercatat (${doc.verificationStatus}).`,
        sourceUrl: h.sourceUrl ?? doc.sourceUrl,
      });
    }
  }

  const remoteMode = remote?.mode ?? 'fallback';
  const provenanceNote =
    (isNtt
      ? 'Parameter gempa resmi BMKG; kerusakan/korban = klaim yang dilaporkan (konflik dipertahankan); yang tak ada = Belum tersedia.'
      : 'Angka dampak, biaya, dan pemulihan = data demo prototipe, bukan data resmi BNPB/BMKG. Korban terverifikasi: Belum tersedia.') +
    (remoteMode === 'live' ? ` ${remote?.notice ?? ''}` : ' Sumber humaniter: data lokal (Firestore tidak tersedia).');

  return {
    detail: {
      incidentId: disaster.id,
      provenance,
      provenanceNote,
      articles: candidates,
      aidEvents: aid,
      posko,
      officialParams: officialParams(disaster.id, ntt),
      claims: [...baseClaims, ...remoteClaims],
      needs: remoteNeeds,
      crawl: incidentFreshness(disaster.id, remote?.crawlRuns ?? []),
    },
    timeline,
  };
}
