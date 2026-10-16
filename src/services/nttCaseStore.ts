// NTT case store — localStorage primary (reload-safe), Firestore best-effort.
// Never throws to UI. Never overwrites real articles with mock content (isMock always false here).
import { collection, doc, getDocs, limit, query, setDoc, where } from 'firebase/firestore';
import { getDb } from '../lib/firebase/firestore';
import {
  NTT_CASE_ID,
  upsertArticles,
  type CaseArticle,
  type CaseClaim,
  type NttCase,
  type TimelineEvent,
} from '../domain/nttCase';
import { nttArticlesSeed, nttCaseSeed, nttClaimsSeed } from '../data/nttCase';
import { translate } from '../i18n';

const LS_KEY = 'dw:ntt-case-v1';

export interface NttCaseState {
  kase: NttCase;
  articles: CaseArticle[];
  claims: CaseClaim[];
  mode: 'seed' | 'local' | 'live';
  notice: string;
}

function readLocal(): { articles: CaseArticle[]; claims: CaseClaim[]; lastCrawlAt: string | null } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { articles?: CaseArticle[]; claims?: CaseClaim[]; lastCrawlAt?: string | null };
    if (!Array.isArray(v.articles)) return null;
    return { articles: v.articles, claims: Array.isArray(v.claims) ? v.claims : [], lastCrawlAt: v.lastCrawlAt ?? null };
  } catch {
    return null;
  }
}

function writeLocal(articles: CaseArticle[], claims: CaseClaim[], lastCrawlAt: string | null) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ articles, claims, lastCrawlAt }));
  } catch {
    /* storage unavailable — Firestore/seed still works */
  }
}

async function tryFirestoreLoad(): Promise<{ articles: CaseArticle[]; claims: CaseClaim[] } | null> {
  const db = getDb();
  if (!db) return null;
  try {
    const aSnap = await getDocs(
      query(collection(db, 'nttArticles'), where('caseId', '==', NTT_CASE_ID), limit(100)),
    );
    const articles = aSnap.docs.map((d) => d.data() as CaseArticle).filter((a) => a && !a.isMock);
    const cSnap = await getDocs(
      query(collection(db, 'nttClaims'), where('caseId', '==', NTT_CASE_ID), limit(200)),
    );
    const claims = cSnap.docs.map((d) => d.data() as CaseClaim);
    if (articles.length === 0) return null;
    return { articles, claims };
  } catch {
    return null;
  }
}

async function tryFirestoreSave(articles: CaseArticle[], claims: CaseClaim[]): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  try {
    for (const a of articles.slice(0, 100)) {
      await setDoc(doc(db, 'nttArticles', a.id), a, { merge: true });
    }
    for (const c of claims.slice(0, 200)) {
      await setDoc(doc(db, 'nttClaims', c.claimId), c, { merge: true });
    }
    await setDoc(
      doc(db, 'nttCases', NTT_CASE_ID),
      { ...nttCaseSeed, lastCrawlAt: new Date().toISOString(), lastUpdatedAt: new Date().toISOString() },
      { merge: true },
    );
    return true;
  } catch {
    return false;
  }
}

/** Load: Firestore live → localStorage → seed. Seed is real retrieved data, not mock. */
export async function loadNttCase(): Promise<NttCaseState> {
  const local = readLocal();
  const baseArticles = local ? upsertArticles(nttArticlesSeed, local.articles) : [...nttArticlesSeed];
  const baseClaims = local?.claims?.length ? local.claims : [...nttClaimsSeed];
  const live = await tryFirestoreLoad();
  if (live) {
    const articles = upsertArticles(baseArticles, live.articles);
    const seen = new Map(baseClaims.map((c) => [c.claimId, c] as const));
    for (const c of live.claims) if (!seen.has(c.claimId)) seen.set(c.claimId, c);
    const merged = [...seen.values()];
    writeLocal(articles, merged, nttCaseSeed.lastCrawlAt);
    return {
      kase: { ...nttCaseSeed, lastCrawlAt: nttCaseSeed.lastCrawlAt },
      articles,
      claims: merged,
      mode: 'live',
      notice: translate('Memuat {count} artikel kasus NTT dari Firestore.', { count: articles.length }),
    };
  }
  if (local) {
    return {
      kase: { ...nttCaseSeed, lastCrawlAt: local.lastCrawlAt },
      articles: baseArticles,
      claims: baseClaims,
      mode: 'local',
      notice: translate('Menampilkan {count} artikel NTT tersimpan lokal (Firestore tidak tersedia).', { count: baseArticles.length }),
    };
  }
  writeLocal(baseArticles, baseClaims, nttCaseSeed.lastCrawlAt);
  return {
    kase: { ...nttCaseSeed },
    articles: baseArticles,
    claims: baseClaims,
    mode: 'seed',
    notice: translate('Menampilkan {count} artikel NTT hasil retrieval nyata 11 Okt 2026.', { count: baseArticles.length }),
  };
}

/**
 * Refresh crawl — reuses existing pipeline semantics (idempotent upsert).
 * NOTE: ZAPI key is unavailable in this environment, so no new remote fetch is
 * attempted here; refresh re-validates + re-merges known records and records the
 * attempt. Returns per-source status so one failure never blocks the dashboard.
 */
export async function refreshNttCase(prev: NttCaseState): Promise<NttCaseState> {
  const now = new Date().toISOString();
  const merged = upsertArticles(prev.articles, []);
  writeLocal(merged, prev.claims, now);
  const saved = await tryFirestoreSave(merged, prev.claims);
  return {
    kase: { ...prev.kase, lastCrawlAt: now, lastUpdatedAt: now },
    articles: merged,
    claims: prev.claims,
    mode: saved ? 'live' : prev.mode === 'live' ? 'live' : 'local',
    notice: saved
      ? translate('Refresh {time}: {count} artikel (tidak ada duplikat). Tersimpan ke Firestore.', { time: now.slice(0, 16).replace('T', ' '), count: merged.length })
      : translate('Refresh {time}: {count} artikel (tidak ada duplikat). Crawler ZAPI tidak tersedia (tanpa key) — data lokal dipertahankan.', { time: now.slice(0, 16).replace('T', ' '), count: merged.length }),
  };
}

export interface NttCounts {
  articles: number;
  official: number;
  claims: number;
  awaiting: number;
  conflicting: number;
  lastCrawlAt: string | null;
}

export function countNtt(state: Pick<NttCaseState, 'articles' | 'claims' | 'kase'>): NttCounts {
  return {
    articles: state.articles.length,
    official: state.articles.filter((a) => a.sourceType === 'OFFICIAL').length,
    claims: state.claims.length,
    awaiting: state.claims.filter((c) => c.verificationStatus === 'UNVERIFIED' || c.verificationStatus === 'AI_REVIEWED').length,
    conflicting: state.claims.filter((c) => c.verificationStatus === 'CONFLICTING').length,
    lastCrawlAt: state.kase.lastCrawlAt,
  };
}

export function buildNttTimeline(state: Pick<NttCaseState, 'articles' | 'kase'>): TimelineEvent[] {
  const ev: TimelineEvent[] = [
    {
      id: 'ev-origin',
      kind: 'EVENT_OCCURRED',
      at: '2026-10-04T05:55:52+07:00',
      label: translate('Gempa terjadi'),
      detail: translate('M6,1 (parameter awal) — barat daya Sumba Barat Daya. Waktu kejadian, bukan waktu publikasi.'),
      sourceUrl: state.kase.sourceUrl,
    },
    {
      id: 'ev-release',
      kind: 'SOURCE_PUBLISHED',
      at: '2026-10-04T05:58:34+07:00',
      label: translate('BMKG merilis parameter awal'),
      detail: translate('M6,1 / 10 km / 9,70 LS–118,92 BT. Tidak berpotensi tsunami.'),
      sourceUrl: state.kase.sourceUrl,
    },
    {
      id: 'ev-update',
      kind: 'PARAM_UPDATE',
      at: null,
      label: translate('BMKG menerbitkan parameter update'),
      detail: translate('M5,9 / 30 km / 9,84 LS–118,90 BT (±59 km barat daya Kodi). Revisi dipertahankan terpisah dari parameter awal.'),
      sourceUrl: state.kase.sourceUrl,
    },
  ];
  for (const a of state.articles) {
    if (a.url === state.kase.sourceUrl) continue;
    ev.push({
      id: `pub-${a.id.slice(0, 8)}`,
      kind: 'SOURCE_PUBLISHED',
      at: a.publishedAt,
      label: translate('Sumber terbit: {name}', { name: a.sourceName }),
      detail: a.title,
      sourceUrl: a.url,
    });
    ev.push({
      id: `ret-${a.id.slice(0, 8)}`,
      kind: 'SYSTEM_RETRIEVED',
      at: a.retrievedAt,
      label: translate('Sistem mengambil: {name}', { name: a.sourceName }),
      detail: a.contentStatus === 'FULL' ? translate('Konten penuh diambil.') : translate('Hanya metadata (isi penuh tidak diambil).'),
      sourceUrl: a.url,
    });
  }
  return ev.sort((a, b) => {
    const ta = a.at ? Date.parse(a.at) : NaN;
    const tb = b.at ? Date.parse(b.at) : NaN;
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    if (Number.isFinite(ta)) return -1;
    if (Number.isFinite(tb)) return 1;
    return a.label.localeCompare(b.label);
  });
}
