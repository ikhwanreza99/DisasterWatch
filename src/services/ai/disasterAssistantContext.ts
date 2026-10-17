// Single authoritative assistant context for DisasterWatch AI Helpdesk.
//
// SOURCE OF TRUTH: the same React state the dashboard renders
// (disasters + intelReports + aidRecords from App.tsx).
// Every user question rebuilds this snapshot from the CURRENT props —
// never from a stale cache — so chatbot and dashboard always agree.
//
// Deterministic math is done HERE (or in the intelligence engines this
// module calls). Gemini only verbalises the precomputed numbers.
import type { DisasterIncident } from '../../types';
import type { AidRecord, IntelligenceReport } from '../../domain/intelligence';
import { needLabel } from '../../domain/intelligence';
import { localeFor } from '../../i18n';
import { estimateImpact } from '../intelligence/impactEngine';
import { summarizeGaps } from '../intelligence/aidGapEngine';
import { rankDisasters } from '../intelligence/priorityEngine';
import { sourceContext, type AssistantSources } from './assistantSources';
import { recentDisasterContext } from './recentDisasterList';

export interface AssistantDeps {
  dataSources?: AssistantSources;
  disasters: Record<string, DisasterIncident>;
  reports: IntelligenceReport[];
  aid: AidRecord[];
}

export interface DashboardStats {
  activeDisasters: number;
  affectedPeople: number;
  topPriorityId: string | null;
  topPriorityName: string;
  topPriorityScore: number;
  totalAidGap: number;
  unverifiedReports: number;
}

export interface AssistantSnapshot {
  generatedAt: string;
  recentDisasters: string;
  isDemoData: boolean;
  provenance: string;
  summary: DashboardStats;
  disasters: Array<{
    id: string;
    name: string;
    title: string;
    type: string;
    location: string;
    province: string;
    status: string;
    affectedPopulation: number;
    priorityScore: number;
    priorityReasons: string[];
    severity: number;
    updatedAt: string;
    source: string;
    reportCount: number;
  }>;
  aidPosts: Array<{ incidentId: string; name: string; location: string; candidate: boolean; capacity: string; url: string }>;
  reports: {
    total: number;
    byVerificationStatus: Record<string, number>;
    latest: Array<{ id: string; location: string; status: string; confidence: number; snippet: string }>;
    unresolved: Array<{ id: string; location: string; status: string; snippet: string }>;
  };
  needs: Array<{
    disasterId: string;
    disasterName: string;
    category: string;
    label: string;
    estimated: number;
    received: number;
    gap: number;
    gapPct: number;
    coveragePct: number;
    unit: string;
  }>;
  aid: {
    totalRecords: number;
    totalQuantity: number;
    byCategory: Array<{ category: string; label: string; quantity: number; unit: string }>;
    records: Array<{ id: string; disasterId: string; category: string; quantity: number; unit: string; destination: string }>;
  };
  intelligence: {
    ranking: Array<{ disasterId: string; name: string; score: number; reasons: string[] }>;
    highestPriorityDisaster: string;
    largestUnmetNeed: string;
    verificationBacklog: number;
    disasterCount: number;
    affectedPopulation: number;
    alerts: string[];
  };
  /** In-app mitigation guides (for "Pelajari Bencana" grounding) — compacted at render. */
  guides: Array<{ id: string; name: string; title: string; cause: string; hazards: string; evacRoute: string }>;
}

/** Parse legacy `impact` text ("1.250 KK Terdampak") when no structured reports exist. */
function legacyPopulation(d: DisasterIncident): number {
  const m = d.impact.match(/([\d.,]+)\s*(KK|jiwa|keluarga)/i);
  if (!m) return 0;
  const n = parseInt(m[1].replace(/[.,]/g, ''), 10);
  if (!Number.isFinite(n)) return 0;
  return /kk|keluarga/i.test(m[2]) ? n * 4 : n;
}

/**
 * Dashboard-consistent stats. Mirrors IntelligenceSummaryBar's useMemo exactly:
 * affected = max structured impact across disasters, fallback to legacy sum.
 */
export function computeDashboardStats(deps: AssistantDeps): DashboardStats {
  const list = Object.values(deps.disasters);
  const ranking = rankDisasters(deps.disasters, deps.reports, deps.aid);
  const top = ranking[0];
  let pop = 0;
  let gapItems = 0;
  for (const d of list) {
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === d.id);
    pop = Math.max(pop, estimateImpact(mine).affectedPopulation);
    gapItems += summarizeGaps(
      d.id,
      mine,
      deps.aid.filter((a) => a.disasterId === d.id),
    ).reduce((s, g) => s + g.gap, 0);
  }
  const legacyPop = list.reduce((s, d) => s + legacyPopulation(d), 0);
  const topName = top ? (deps.disasters[top.disasterId]?.name ?? top.disasterId) : '-';
  return {
    activeDisasters: list.length,
    affectedPeople: pop > 0 ? pop : legacyPop,
    topPriorityId: top ? top.disasterId : null,
    topPriorityName: topName,
    topPriorityScore: top ? top.score : 0,
    totalAidGap: Math.round(gapItems),
    unverifiedReports: deps.reports.filter(
      (r) => r.verificationStatus === 'UNVERIFIED' || r.verificationStatus === 'AI_REVIEWED',
    ).length,
  };
}

const VERIF_KEYS = ['UNVERIFIED', 'AI_REVIEWED', 'VERIFIED', 'CONFLICTING'] as const;

/** Build the full structured snapshot. Pure + deterministic. */
export function buildAssistantSnapshot(deps: AssistantDeps): AssistantSnapshot {
  const stats = computeDashboardStats(deps);
  const ranking = rankDisasters(deps.disasters, deps.reports, deps.aid);

  const disasters = Object.values(deps.disasters).map((d) => {
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === d.id);
    const imp = estimateImpact(mine);
    const scored = ranking.find((r) => r.disasterId === d.id);
    return {
      id: d.id,
      name: d.name,
      title: d.fullTitleDisplay,
      type: d.category,
      location: d.name,
      province: d.province,
      status: d.urgency,
      affectedPopulation: imp.affectedPopulation > 0 ? imp.affectedPopulation : legacyPopulation(d),
      priorityScore: scored ? scored.score : 0,
      priorityReasons: scored ? scored.reasons : [],
      severity: imp.urgencyScore,
      updatedAt: d.timestamp,
      source: d.photoSource,
      reportCount: mine.length,
    };
  });

  const byVerificationStatus: Record<string, number> = { UNVERIFIED: 0, AI_REVIEWED: 0, VERIFIED: 0, CONFLICTING: 0 };
  for (const r of deps.reports) {
    if (VERIF_KEYS.includes(r.verificationStatus as (typeof VERIF_KEYS)[number])) {
      byVerificationStatus[r.verificationStatus] += 1;
    }
  }

  const latest = deps.reports.slice(0, 5).map((r) => ({
    id: r.id,
    location: r.location.name,
    status: r.verificationStatus,
    confidence: Math.round((r.aiConfidence ?? 0) * 100),
    snippet: r.rawText.slice(0, 140),
  }));
  const unresolved = deps.reports
    .filter((r) => r.verificationStatus !== 'VERIFIED')
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      location: r.location.name,
      status: r.verificationStatus,
      snippet: r.rawText.slice(0, 140),
    }));

  const needs: AssistantSnapshot['needs'] = [];
  for (const d of Object.values(deps.disasters)) {
    const mine = deps.reports.filter((r) => !r.disasterId || r.disasterId === d.id);
    const mineAid = deps.aid.filter((a) => a.disasterId === d.id);
    for (const g of summarizeGaps(d.id, mine, mineAid)) {
      needs.push({
        disasterId: d.id,
        disasterName: d.name,
        category: g.category,
        label: needLabel(g.category),
        estimated: g.estimated,
        received: g.received,
        gap: g.gap,
        gapPct: g.gapPct,
        coveragePct: Math.round((100 - g.gapPct) * 10) / 10,
        unit: g.unit,
      });
    }
  }
  needs.sort((a, b) => b.gap - a.gap);

  const aidByCat = new Map<string, { quantity: number; unit: string }>();
  for (const a of deps.aid) {
    const prev = aidByCat.get(a.needCategory) ?? { quantity: 0, unit: a.unit };
    aidByCat.set(a.needCategory, { quantity: prev.quantity + (a.quantity || 0), unit: prev.unit });
  }

  const largest = needs[0];
  const alerts: string[] = [];
  if (stats.unverifiedReports > 0) alerts.push(`${stats.unverifiedReports} laporan menunggu verifikasi`);
  if (largest && largest.gap > 0)
    alerts.push(`Gap terbesar: ${largest.label} di ${largest.disasterName} kurang ${largest.gap} ${largest.unit}`);
  if (stats.topPriorityId) alerts.push(`Prioritas tertinggi: ${stats.topPriorityName} (skor ${stats.topPriorityScore})`);

  const guides = Object.values(deps.disasters).map((d) => ({
    id: d.id,
    name: d.name,
    title: d.guide.title,
    cause: d.guide.cause,
    hazards: d.guide.hazards,
    evacRoute: d.guide.evacRoute,
  }));

  return {
    generatedAt: new Date().toISOString(),
    recentDisasters: recentDisasterContext(deps.disasters),
    isDemoData: deps.reports.some(record => record.isMock) || deps.aid.some(record => record.isMock) || Object.values(deps.disasters).some(record => (record as DisasterIncident & {isMock?: boolean}).isMock === true),
    provenance: sourceContext(deps.dataSources),
    summary: stats,
    disasters,
    aidPosts: Object.values(deps.disasters).flatMap(d => d.route.checkpoints.map(post => ({
      incidentId: d.id, name: post.name ?? post.title ?? "Unnamed aid post",
      location: post.location ?? post.subtitle ?? "Unknown", candidate: post.recommendation === true,
      capacity: post.capacity ? `${post.capacity.used}/${post.capacity.total}` : "Unknown",
      url: post.googleMapsUrl ?? "",
    }))),
    reports: { total: deps.reports.length, byVerificationStatus, latest, unresolved },
    needs: needs.slice(0, 20),
    aid: {
      totalRecords: deps.aid.length,
      totalQuantity: deps.aid.reduce((s, a) => s + (a.quantity || 0), 0),
      byCategory: [...aidByCat.entries()].map(([category, v]) => ({
        category,
        label: needLabel(category),
        quantity: v.quantity,
        unit: v.unit,
      })),
      records: deps.aid.slice(0, 20).map((a) => ({
        id: a.id,
        disasterId: a.disasterId,
        category: needLabel(a.needCategory),
        quantity: a.quantity,
        unit: a.unit,
        destination: deps.disasters[a.disasterId]?.name ?? a.disasterId,
      })),
    },
    intelligence: {
      ranking: ranking.map((r) => ({
        disasterId: r.disasterId,
        name: deps.disasters[r.disasterId]?.name ?? r.disasterId,
        score: r.score,
        reasons: r.reasons,
      })),
      highestPriorityDisaster: stats.topPriorityId
        ? `${stats.topPriorityName} (skor ${stats.topPriorityScore})`
        : '-',
      largestUnmetNeed: largest
        ? `${largest.label} di ${largest.disasterName}: butuh ${largest.estimated} ${largest.unit}, terima ${largest.received} ${largest.unit}, kurang ${largest.gap} ${largest.unit} (${largest.gapPct}%)`
        : 'Belum ada estimasi kebutuhan terstruktur',
      verificationBacklog: stats.unverifiedReports,
      disasterCount: stats.activeDisasters,
      affectedPopulation: stats.affectedPeople,
      alerts,
    },
    guides,
  };
}

function fmt(n: number): string {
  return n.toLocaleString(localeFor());
}

/** Render the snapshot as compact grounded text for the Gemini prompt. Numbers are precomputed. */
export function renderAssistantContextText(snap: AssistantSnapshot, maxChars = 6000): string {
  const L: string[] = [
    snap.provenance,
    `CURRENT DISASTERWATCH APP SNAPSHOT. Contains explicitly marked demo records: ${snap.isDemoData}. Event dates determine when an incident happened; updatedAt is not an event date.`,
    `RINGKASAN: ${snap.summary.activeDisasters} insiden aktif; ${fmt(snap.summary.affectedPeople)} orang terdampak; prioritas tertinggi ${snap.summary.topPriorityName} (skor ${snap.summary.topPriorityScore}); ${snap.summary.unverifiedReports} laporan belum terverifikasi; total gap bantuan ${fmt(snap.summary.totalAidGap)}.`,
  ];
  // Details are bounded; summary totals still cover the full loaded snapshot.
  for (const d of snap.disasters.slice(0, 4)) {
    L.push(
      `- [${d.id}] ${d.name}, ${d.province} | ${d.title} (tipe: ${d.type}) | status ${d.status} | terdampak ${fmt(d.affectedPopulation)} orang | prioritas ${d.priorityScore} (${d.priorityReasons.join(', ') || '-'}) | laporan terkait ${d.reportCount} | pemutakhiran: ${d.updatedAt} | sumber: ${d.source}`,
    );
  }
  L.push('AID POSTS (bounded records; recommendations are candidates, not confirmed active shelters):');
  for (const post of snap.aidPosts.slice(0, 4)) {
    L.push(`  - ${post.incidentId}: ${post.name} @${post.location}; candidate=${post.candidate}; capacity=${post.capacity}; ${post.url}`);
  }
  if (!snap.aidPosts.length) L.push('No aid-post records in this snapshot. This says nothing about disaster occurrence.');
  const b = snap.reports.byVerificationStatus;
  L.push(
    `LAPORAN: total ${snap.reports.total} (UNVERIFIED ${b.UNVERIFIED}, AI_REVIEWED ${b.AI_REVIEWED}, VERIFIED ${b.VERIFIED}, CONFLICTING ${b.CONFLICTING}).`,
  );
  for (const r of snap.reports.latest.slice(0, 3)) {
    L.push(`  - ${r.id} @${r.location} [${r.status}, AI ${r.confidence}%]: ${r.snippet}`);
  }
  if (snap.needs.length > 0) {
    L.push('KEBUTUHAN vs BANTUAN (gap & coverage sudah dihitung aplikasi — pakai angka ini apa adanya):');
    for (const n of snap.needs.slice(0, 6)) {
      L.push(
        `  - ${n.label} @${n.disasterName}: butuh ${fmt(n.estimated)} ${n.unit}, terima ${fmt(n.received)} ${n.unit}, kurang ${fmt(n.gap)} ${n.unit} (${n.gapPct}%), coverage ${n.coveragePct}%`,
      );
    }
  } else {
    L.push('KEBUTUHAN: belum ada estimasi kebutuhan terstruktur.');
  }
  if (snap.aid.byCategory.length > 0) {
    L.push(
      `BANTUAN DITERIMA: ${snap.aid.totalRecords} catatan — ${snap.aid.byCategory.map((c) => `${c.label} ${fmt(c.quantity)} ${c.unit}`).join('; ')}.`,
    );
  } else {
    L.push('BANTUAN DITERIMA: belum ada catatan bantuan.');
  }
  L.push(
    `INTELIJEN: peringkat prioritas ${snap.intelligence.ranking.map((r) => `${r.name} ${r.score}`).join('; ')}; gap terbesar: ${snap.intelligence.largestUnmetNeed}.`,
  );
  L.push('DETAILS are bounded excerpts, not every database record.');
  L.push(snap.recentDisasters.slice(0, 600));
  for (const g of snap.guides.slice(0, 2)) {
    L.push(`PANDUAN ${g.id} (${g.name} — ${g.title}): penyebab: ${g.cause.slice(0, 200)}; bahaya: ${g.hazards.slice(0, 200)}; evakuasi: ${g.evacRoute.slice(0, 200)}`);
  }
  if (snap.reports.unresolved.length > 0) {
    L.push(
      `BELUM SELESAI: ${snap.reports.unresolved.map((r) => `${r.location} (${r.status})`).join('; ')}.`,
    );
  }
  L.push('Catatan: tidak ada data korban meninggal terverifikasi dalam konteks ini.');
  const joined = L.join('\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) + '\n...(dipotong)' : joined;
}

/**
 * Back-compat text builder used by askAssistant.
 * Prototype-scale: whole-state snapshot, truncated.
 */
export function buildDisasterContext(deps: AssistantDeps, maxChars = 6000): string {
  return renderAssistantContextText(buildAssistantSnapshot(deps), maxChars);
}
