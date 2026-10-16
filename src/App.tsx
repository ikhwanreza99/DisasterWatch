import {fetchSnapshot} from './services/snapshotCache';
import { applyDisasterDecisions } from './services/disasterModeration';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { currentArticles, currentIncidents } from './data/currentIncidents';
import { newsSourceUrl } from './services/newsSourceUrl';
import { classifyRelevance } from './services/incidentNews';
import { descriptorFor } from './services/incidentRegistry';
import { validDisasterPhoto, type DisasterPhoto } from './services/disasterPhoto';
import { getDb } from './lib/firebase/firestore';
import { collection, onSnapshot } from 'firebase/firestore';
import { inRecentWindow } from './services/recentWindow';
import { locationValidation } from './services/locationValidation';
import { CategoryFilter, DisasterCategory, DisasterIncident, DisasterCheckpoint } from './types';
import { Header } from './components/Header';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { MapProvider } from './components/map/MapProvider';
import { SlimSidebar } from './components/SlimSidebar';
const EvacuationPostView = lazy(() => import('./components/EvacuationPostView').then(module => ({ default: module.EvacuationPostView })));
const CitizenReportsView = lazy(() => import('./components/CitizenReportsView').then(module => ({ default: module.CitizenReportsView })));
const AIHelpdeskPanel = lazy(() => import('./components/AIHelpdeskPanel').then(module => ({ default: module.AIHelpdeskPanel })));
const ReportModal = lazy(() => import('./components/ReportModal').then(module => ({ default: module.ReportModal })));
const DonationModal = lazy(() => import('./components/DonationModal').then(module => ({ default: module.DonationModal })));
import { useBmkgEarthquakes, useBmkgWeatherWarnings } from './services/bmkg';
import { firmsSensorsLabel, useFirmsHotspots } from './services/firms';
import { RANGE_LIMITS, resolveDateRange } from './domain/dateRange';
import type { AidRecord, IntelligenceReport, UserIdentity } from './domain/intelligence';
import { demoAid, demoReports } from './data/seedDemo';
import { ensureUser, watchUser, canReport, consumeRedirectResult, signOutUser } from './lib/firebase/auth';
import { mockUser } from './lib/firebase/auth';
import { useI18n, translate } from './i18n';

type LoginReason = 'report' | 'account';
const LOGIN_INTENT_KEY = 'dw:postLoginIntent';
function readLoginIntent(): LoginReason | null {
  try {
    const v = sessionStorage.getItem(LOGIN_INTENT_KEY);
    return v === 'report' || v === 'account' ? v : null;
  } catch {
    return null;
  }
}
function writeLoginIntent(v: LoginReason | null) {
  try {
    if (v) sessionStorage.setItem(LOGIN_INTENT_KEY, v);
    else sessionStorage.removeItem(LOGIN_INTENT_KEY);
  } catch {
    /* storage unavailable (private mode) — popup flow still works */
  }
}
const LoginModal = lazy(() => import('./components/LoginModal').then(module => ({ default: module.LoginModal })));
const NttCaseView = lazy(() => import('./components/NttCaseView').then(module => ({ default: module.NttCaseView })));
import { NTT_CASE_ID } from './domain/nttCase';
import { loadNttCase, refreshNttCase, type NttCaseState } from './services/nttCaseStore';
import { nttIncident } from './data/nttIncident';


export default function App() {
  const { t } = useI18n();
  // Follow the visible viewport when the on-screen keyboard opens on phones.
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      document.documentElement.style.setProperty('--app-height', `${viewport?.height ?? window.innerHeight}px`);
    };
    update();
    viewport?.addEventListener('resize', update);
    window.addEventListener('resize', update);
    return () => {
      viewport?.removeEventListener('resize', update);
      window.removeEventListener('resize', update);
      document.documentElement.style.removeProperty('--app-height');
    };
  }, []);
  const [disasters, setDisasters] = useState<Record<string, DisasterIncident>>(() => {
    const covered = new Set(currentArticles
      .filter(article => {
        if (!article.incidentId || !newsSourceUrl(article.url)) return false;
        const descriptor = descriptorFor(article.incidentId);
        return descriptor !== null && classifyRelevance(article, descriptor).status === 'MATCHED';
      })
      .map(article => article.incidentId!));
    // Keep the dedicated NTT case accessible independently of the recent dataset.
    return Object.fromEntries(Object.entries({ ...currentIncidents, [nttIncident.id]: nttIncident }).filter(([id]) => id === NTT_CASE_ID || covered.has(id)));
  });
  const [moderationLoaded,setModerationLoaded]=useState(()=>!getDb());
  const [ntt, setNtt] = useState<NttCaseState | null>(null);
  useEffect(() => {
    const db=getDb();
    if(!db)return;
    return onSnapshot(collection(db,'disasters'),{includeMetadataChanges:true},snapshot=>{
      if(snapshot.metadata.fromCache)return;
      const records = snapshot.docs.map(doc=>({...doc.data(),id:doc.id}) as DisasterIncident & {isMock?:boolean;eventDate?:string;approvalStatus?:string});
      const approved=records.filter(record=>record.approvalStatus==='APPROVED');
      const rejected=records.filter(record=>record.approvalStatus==='REJECTED').map(record=>record.id);
      setDisasters(previous=>applyDisasterDecisions(previous,Object.fromEntries(approved.filter(incident=>incident.isMock===false && incident.coords && locationValidation(incident).status!=='REJECTED' && (incident.id===NTT_CASE_ID || inRecentWindow(incident.eventDate))).map(incident=>[incident.id,incident])),rejected));
      setModerationLoaded(true);
    },()=>{ /* Do not reveal incident markers until moderation has been read successfully. */ });
  },[]);
  useEffect(() => {
    const controller = new AbortController();
    fetchSnapshot<{ photos?: Record<string, DisasterPhoto> }>('/data/disaster-photos.json')
      .then((data: { photos?: Record<string, DisasterPhoto> }) => {
        if (controller.signal.aborted || !data.photos) return;
        setDisasters(previous => Object.fromEntries(Object.entries(previous).map(([id, incident]) => {
          const photo = data.photos![id];
          return [id, validDisasterPhoto(photo, id) ? { ...incident, photoUrl: photo.imageUrl, photoAlt: translate('Dokumentasi {name}', { name: incident.name }), photoSource: photo.sourceName, photoSourceUrl: photo.sourceUrl, photoReportDate: photo.reportDate } : incident];
        })));
      }).catch(() => { /* Keep explicit unavailable placeholder. */ });
    return () => controller.abort();
  }, []);
  const [isNttOpen, setIsNttOpen] = useState<boolean>(false);
  const [nttRefreshing, setNttRefreshing] = useState<boolean>(false);
  const [activeDisasterKey, setActiveDisasterKey] = useState<string>('padang');
  const [intelReports, setIntelReports] = useState<IntelligenceReport[]>(demoReports);
  const [aidRecords, setAidRecords] = useState<AidRecord[]>(demoAid);
  const [storeNotice, setStoreNotice] = useState<string>('Mode demo lokal — Firestore fallback aktif.');
  const [currentUser, setCurrentUser] = useState<UserIdentity>(mockUser());
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  // Separate date selections: BMKG quakes (~latest 30), FIRMS (NRT, last 60 days), MAGMA (archive since 2018).
  const [selectedDate, setSelectedDate] = useState<string>('Today');
  const [magmaDate, setMagmaDate] = useState<string>('Today');
  const [bmkgDate, setBmkgDate] = useState<string>('Today');
  const isDarkMode = false;

  // Exclusive single-window panel states: strictly at most ONE panel open at any time
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isRouteOpen, setIsRouteOpen] = useState<boolean>(false);
  const [isReportsOpen, setIsReportsOpen] = useState<boolean>(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(true);
  // Sidebar can expand to the full disaster detail (design from feat/homepage-slicing).
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);
  // News ticker highlights the incident it is announcing on the map.
  const [highlightedDisasterKey, setHighlightedDisasterKey] = useState<string | null>(null);
  // Selected evacuation post (Posko) in the Posko view / on the map.
  const [selectedPostId, setSelectedPostId] = useState<DisasterCheckpoint['id'] | null>(null);
  useEffect(() => {
    setSelectedPostId(null);
  }, [activeDisasterKey, isRouteOpen]);
  const [aiDraft, setAiDraft] = useState<{ message: string; file?: File } | null>(null);
  const [hasAIContext, setHasAIContext] = useState(false);
  const [isAIExpanded, setIsAIExpanded] = useState(false);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<LoginReason>('report');
  const [loginError, setLoginError] = useState('');
  const [aiWorkflow, setAiWorkflow] = useState<'menu' | 'report-disaster'>('menu');
  useEffect(() => watchUser(setCurrentUser), []);

  // Modal overlays
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState<boolean>(false);
  const [apiLayersEnabled, setApiLayersEnabled] = useState(false);

  // BMKG V1: official feed → React state → map/UI. No Firestore, no auto-disaster.
  // Fetch on load + manual refresh only (no aggressive polling).
  const bmkg = useBmkgEarthquakes({ enabled: apiLayersEnabled });
  // Earthquakes shown on the map follow the BMKG date selection (e.g. Today = only today's quakes).
  const bmkgRange = resolveDateRange(bmkgDate, RANGE_LIMITS.bmkg);
  const bmkgEventsInRange = bmkg.events.filter((e) => {
    const t = Date.parse(e.eventTime);
    return Number.isFinite(t) && t >= bmkgRange.start.getTime() && t <= bmkgRange.end.getTime();
  });
  // NASA FIRMS hotspots via server-side proxy (MAP_KEY never reaches the browser).
  // Range follows the header date selector (Today / 24 jam / 7 hari / 30 hari).
  const firms = useFirmsHotspots(selectedDate, apiLayersEnabled);
  // BMKG weather nowcast: RSS → CAP details → React state. Same constraints.
  const bmkgWx = useBmkgWeatherWarnings({ enabled: apiLayersEnabled });

  const activeDisaster = disasters[activeDisasterKey] || Object.values(disasters)[0];

  const handleSelectDisaster = (key: string) => {
    // Clicking an incident marker opens the mini sidebar for it (as in feat/homepage-slicing).
    // If another single-window panel (Posko, Laporan, AI) is open, that panel stays and follows
    // the new incident — the mini sidebar only renders when no other panel is open.
    if (disasters[key]) {
      setActiveDisasterKey(key);
      // Every incident — NTT and Lombok included — shares one detail template.
      // The NTT deep-dive intel view is opened explicitly (shortcut / detail button).
      setIsNttOpen(false);
      if (window.matchMedia('(max-width: 639px)').matches) {
        setIsSidebarMinimized(true);
        setIsSidebarExpanded(false);
        setIsRouteOpen(false);
        setIsReportsOpen(false);
      } else {
        setIsSidebarMinimized(false);
      }
    }
  };

  const handleSelectCategory = (cat: CategoryFilter) => {
    setActiveCategory(cat);
    // If the active disaster doesn't match the new category, pick the first visible
    if (cat !== 'all' && cat !== 'none' && activeDisaster && activeDisaster.category !== cat) {
      const match = Object.values(disasters).find((d) => d.category === cat);
      if (match) {
        setActiveDisasterKey(match.id);
      }
    }
  };

  // Mutually exclusive single-window openers (ensures ZERO dual window anywhere)
  const handleOpenDetail = () => {
    setIsNttOpen(false);
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(false);
    setIsSidebarExpanded(!window.matchMedia('(max-width: 639px)').matches);
  };

  const handleToggleDetail = () => {
    if (!isSidebarMinimized && isSidebarExpanded) {
      setIsSidebarExpanded(false);
    } else {
      handleOpenDetail();
    }
  };

  const handleCollapseSidebar = () => {
    setIsSidebarExpanded(false);
  };

  const handleOpenRoute = () => {
    setIsNttOpen(false);
    setIsDetailOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(true);
    setIsSidebarExpanded(false);
    setIsRouteOpen(true);
  };

  const handleToggleRoute = () => {
    if (isRouteOpen) {
      setIsRouteOpen(false);
    } else {
      handleOpenRoute();
    }
  };

  const handleOpenReports = () => {
    setIsNttOpen(false);
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(true);
    setIsSidebarExpanded(false);
    setIsReportsOpen(true);
  };

  const handleToggleReports = () => {
    if (isReportsOpen) {
      setIsReportsOpen(false);
    } else {
      handleOpenReports();
    }
  };

  const handleOpenAI = (withContext = false) => {
    setIsNttOpen(false);
    setAiDraft(null);
    setIsAIExpanded(false);
    setHasAIContext(withContext);
    setAiWorkflow('menu');
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsSidebarMinimized(true);
    setIsSidebarExpanded(false);
    setIsAIOpen(true);
  };

  const openReportForm = () => {
    handleOpenAI();
    setAiWorkflow('report-disaster');
  };

  /** Opens the Google login modal; the intent survives a full-page redirect via sessionStorage. */
  const openLogin = (reason: LoginReason) => {
    setLoginReason(reason);
    setLoginError('');
    writeLoginIntent(reason);
    setIsLoginOpen(true);
  };

  const handleLogout = async () => {
    try {
      setCurrentUser(await signOutUser());
    } catch {
      // Already logged (code only) in auth.ts; keep the current state.
      return;
    }
    if (aiWorkflow === 'report-disaster') setIsAIOpen(false);
  };

  const handleReportDisaster = () => {
    if (!canReport(currentUser)) {
      openLogin('report');
      return;
    }
    openReportForm();
  };

  const handleOpenWeather = () => {
    // Weather sidebar opens INSIDE map canvas — does not close other sidebars
    setIsWeatherOpen(true);
  };

  const handleCloseWeather = () => {
    setIsWeatherOpen(false);
  };

  const handleToggleSidebar = () => {
    if (isSidebarMinimized) {
      // Opening menu sidebar: close any active right window so there's no dual window
      setIsDetailOpen(false);
      setIsRouteOpen(false);
      setIsReportsOpen(false);
      setIsAIOpen(false);
      setIsNttOpen(false);
      setIsSidebarMinimized(false);
    } else {
      setIsSidebarExpanded(false);
      setIsSidebarMinimized(true);
    }
  };

  /** Open the NTT deep-dive intelligence view (secondary action inside the standard NTT detail). */
  const handleOpenNttIntel = () => {
    if (disasters[NTT_CASE_ID]) setActiveDisasterKey(NTT_CASE_ID);
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(true);
    setIsSidebarExpanded(false);
    setIsNttOpen(true);
  };

  /**
   * Shortcut entry: opens the NTT incident in the SAME shared detail template as
   * Cianjur/Lombok (never a different page layout). The claim-level deep-dive
   * remains one click away inside the standard view.
   */
  const handleOpenNttIncident = () => {
    if (disasters[NTT_CASE_ID]) setActiveDisasterKey(NTT_CASE_ID);
    setIsNttOpen(false);
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(false);
    setIsSidebarExpanded(!window.matchMedia('(max-width: 639px)').matches);
  };

  const handleRefreshNtt = async () => {
    if (!ntt || nttRefreshing) return;
    setNttRefreshing(true);
    try {
      setNtt(await refreshNttCase(ntt));
    } finally {
      setNttRefreshing(false);
    }
  };

  const handleOpenDisasterBrief = () => {
    if (!activeDisaster) return;
    alert(
      [
        t('[DATA TEKNIS SATGAS BNPB & BMKG]'),
        t('Wilayah: {region}', { region: `${activeDisaster.name}, ${activeDisaster.province}` }),
        t('Bencana: {disaster}', { disaster: activeDisaster.fullTitleDisplay }),
        t('Status: {status}', { status: activeDisaster.urgency }),
        t('Estimasi Kerugian: {cost}', { cost: activeDisaster.cost }),
        t('Gap Pemulihan: {recovery}', { recovery: activeDisaster.gapRecovery }),
        t('Jumlah Hotspot/Titik: {hotspots}', { hotspots: activeDisaster.stats.hotspots }),
        t('Personel Siaga: {personnel}', { personnel: activeDisaster.stats.personnel }),
      ].join('\n')
    );
  };

  // Load Firestore (fallback to mock) + ensure auth session once.
  // NTT case loads independently (localStorage seed → Firestore best-effort); never blocks dashboard.
  useEffect(() => {
    let cancelled = false;
    loadNttCase().then((s) => {
      if (cancelled) return;
      setNtt(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setStoreNotice('Laporan resmi ditinjau 12 Okt 2026 · lokasi peta mewakili wilayah, bukan batas terdampak.');
    // Finish a pending Google redirect sign-in first so ensureUser() doesn't start an anonymous session.
    consumeRedirectResult()
      .then(({ user, source, error }) => {
        if (cancelled) return;
        const reason: LoginReason | null =
          source === 'avatar' ? 'account' : source ? 'report' : readLoginIntent();
        writeLoginIntent(null);
        if (user) {
          setCurrentUser(user);
          if (reason === 'report') openReportForm();
        } else if (error) {
          setLoginReason(reason ?? 'report');
          setLoginError(error.message);
          setIsLoginOpen(true);
        }
      })
      .finally(() => {
        ensureUser().then((u) => {
          if (!cancelled) setCurrentUser(u);
        });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNewReportSuccess = (newReportData: any) => {
    // Legacy path (ReportModal lama / AIHelpdesk lama): keep UI feed working.
    const newReportItem = {
      id: `rep-${Date.now()}`,
      location: newReportData.location || activeDisaster?.name || t('Lokasi belum tersedia'),
      title: t('Laporan Warga Baru'),
      desc: newReportData.description || newReportData.desc || t('Laporan baru diterima dari lapangan.'),
      time: t('Baru saja'),
      author: t('Oleh: Warga Pelapor Terverifikasi'),
      sourceType: 'citizen' as const,
      tag: t('Menunggu Verifikasi TRC'),
      tagClass: 'bg-amber-50 text-amber-700 border-amber-200',
    };

    setDisasters((prev) => {
      const updated = { ...prev };
      const current = updated[activeDisasterKey];
      if (current) {
        updated[activeDisasterKey] = {
          ...current,
          reports: [newReportItem, ...current.reports],
        };
      }
      return updated;
    });
  };

  /** New intelligence pipeline path: structured report + legacy feed stay in sync. */
  const handleIntelReport = (rep: IntelligenceReport) => {
    setIntelReports((prev) => [rep, ...prev]);
    const targetKey = rep.disasterId && disasters[rep.disasterId] ? rep.disasterId : activeDisasterKey;
    const e = rep.extractedData;
    setDisasters((prev) => {
      const updated = { ...prev };
      const current = updated[targetKey];
      if (!current) return prev;
      updated[targetKey] = {
        ...current,
        reports: [
          {
            id: rep.id,
            newsCategory: rep.newsCategory,
            newsInsight: rep.newsInsight,
            sourceType: rep.sourceType,
            sourceName: rep.sourceName,
            sourceUrl: rep.sourceUrl,
            location: rep.location.name,
            title: e ? `${e.disasterType.toUpperCase()} • AI ${(Math.round((rep.aiConfidence ?? 0) * 100))}%` : t('Laporan AI'),
            desc: rep.rawText.slice(0, 220),
            time: t('Baru saja'),
            author: t('Oleh: {source}', { source: rep.sourceName }),
            tag: rep.verificationStatus === 'VERIFIED' ? t('Terverifikasi Posko TRC') : rep.verificationStatus === 'CONFLICTING' ? t('Konflik — Perlu Verifikasi') : t('AI Review — Menunggu TRC'),
            tagClass:
              rep.verificationStatus === 'VERIFIED'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : rep.verificationStatus === 'CONFLICTING'
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200',
          },
          ...current.reports,
        ],
      };
      return updated;
    });
  };

  const handleAidAdded = (aid: AidRecord) => {
    setAidRecords((prev) => [aid, ...prev]);
  };

  return (
    <div
      // Inline 100dvh (fits the visible area between the mobile browser bars); h-screen is the fallback.
      style={{ height: 'var(--app-height, 100dvh)' }}
      className={`w-screen h-screen overflow-hidden flex flex-col transition-colors duration-300 ${
        isDarkMode ? 'bg-[#070d18] text-slate-100 dark' : 'bg-white text-slate-800'
      }`}
      data-purpose="app-container"
    >
      {/* Top Bar Navigation */}
      <Header
          user={currentUser}
          dates={{ bmkg: bmkgDate, firms: selectedDate, magma: magmaDate }}
          onSelectDate={(target, value) =>
            target === 'magma' ? setMagmaDate(value) : target === 'bmkg' ? setBmkgDate(value) : setSelectedDate(value)
          }
          onReportDisaster={handleReportDisaster}
          disasters={moderationLoaded ? disasters : {}}
          onHighlightDisaster={setHighlightedDisasterKey}
          onOpenLogin={() => openLogin('account')}
          onSignOut={handleLogout}
        />

        {/* Main Work Area — map-first workspace (min 60vh desktop) */}
        <main className="relative flex-1 grid grid-cols-12 overflow-hidden min-h-0 md:min-h-[60vh]">
          {/* Left Category Filter Dock */}
          <CategoryFilterBar
            availableCategories={moderationLoaded ? Object.values(disasters).map(d => d.category) : []}
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            isDarkMode={isDarkMode}
          />

          {/* Central Map Canvas Area (provider-abstracted, Leaflet default) */}
          <MapProvider
            mapActionSlot={disasters[NTT_CASE_ID] && !isNttOpen && !isAIOpen && !isDetailOpen && !isRouteOpen && !isReportsOpen && isSidebarMinimized ? (
            <button
              type="button"
              onClick={handleOpenNttIncident}
              title={t('Buka detail gempa Sumba Barat Daya 4 Okt 2026 (tampilan standar yang sama)')}
              data-purpose="ntt-case-launcher"
              className="min-h-11 w-full min-w-0 flex items-center gap-2 rounded-full border border-rose-200 bg-white/95 px-3 py-2 text-xs font-bold text-rose-700 shadow-lg backdrop-blur hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-rose-500"
            >
              <span aria-hidden="true">🌋</span>
              <span className="min-w-0 truncate">{t('Kasus NTT · M6,1 Sumba Barat Daya')}</span>
              {ntt && <span className="shrink-0 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px]">{t('{count} berita', { count: ntt.articles.length })}</span>}
            </button>
            ) : null}
            onHighlightDisaster={setHighlightedDisasterKey}
            mobileFilterSlot={<CategoryFilterBar availableCategories={moderationLoaded ? Object.values(disasters).map(d => d.category) : []} mobile activeCategory={activeCategory} onSelectCategory={handleSelectCategory} isDarkMode={isDarkMode} />}
            onStartAIChat={isAIOpen ? undefined : (message, file) => {
              handleOpenAI(false);
              setAiDraft({ message, file });
            }}
            apiLayersEnabled={apiLayersEnabled}
            onApiLayersChange={setApiLayersEnabled}
            disasters={moderationLoaded ? disasters : {}}
            activeDisasterKey={activeDisasterKey}
            onSelectDisaster={handleSelectDisaster}
            activeCategory={activeCategory}
            isDarkMode={isDarkMode}
            onExpandView={handleOpenDetail}
            onOpenAIHelpdesk={() => handleOpenAI(true)}
            isExpanded={isSidebarExpanded}
            highlightedDisasterKey={highlightedDisasterKey}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
            isSidebarMinimized={isSidebarMinimized}
            onToggleSidebar={handleToggleSidebar}
            isDetailOpen={!isSidebarMinimized && isSidebarExpanded}
            onToggleDetail={handleToggleDetail}
            onOpenDetail={handleOpenDetail}
            isRouteOpen={isRouteOpen}
            onToggleRoute={handleToggleRoute}
            onOpenRoute={handleOpenRoute}
            isReportsOpen={isReportsOpen}
            onToggleReports={handleToggleReports}
            onOpenReports={handleOpenReports}
            isWeatherOpen={isWeatherOpen}
            onOpenWeather={handleOpenWeather}
            onCloseWeather={handleCloseWeather}
            bmkgEvents={bmkgEventsInRange}
            bmkgRangeLabel={bmkgRange.label}
            bmkgStatus={
              bmkg.status.state === 'ready'
                ? 'ready'
                : bmkg.status.state === 'unavailable'
                  ? 'unavailable'
                  : bmkg.status.state === 'loading'
                    ? 'loading'
                    : 'idle'
            }
            firmsHotspots={firms.hotspots}
            firmsStatus={firms.status.state}
            firmsProgress={firms.progress}
            onRetryFirms={firms.refresh}
            firmsRangeLabel={firms.range.label}
            selectedDate={magmaDate}
            firmsSensors={firmsSensorsLabel(firms.range)}
            bmkgWeather={bmkgWx.warnings}
            weatherStatus={
              bmkgWx.status.state === 'ready'
                ? 'ready'
                : bmkgWx.status.state === 'unavailable'
                  ? 'unavailable'
                  : bmkgWx.status.state === 'loading'
                    ? 'loading'
                    : 'idle'
            }
          />

          {/* MODE 1: Compact Homepage Menu Sidebar (Only rendered when no other window is open and user un-minimizes sidebar) */}
          {activeDisaster && !isDetailOpen && !isRouteOpen && !isReportsOpen && !isAIOpen && !isNttOpen && !isSidebarMinimized && (
            <SlimSidebar
              disaster={activeDisaster}
              isExpanded={isSidebarExpanded}
              onExpandView={handleOpenDetail}
              onCollapseView={handleCollapseSidebar}
              onOpenAIHelpdesk={() => handleOpenAI(true)}
              onOpenDonationModal={() => setIsDonationModalOpen(true)}
              onOpenDisasterBrief={handleOpenDisasterBrief}
              onMinimize={() => {
                setIsSidebarExpanded(false);
                setIsSidebarMinimized(true);
              }}
              onOpenRoute={handleOpenRoute}
              onOpenReports={handleOpenReports}
              intelReports={intelReports}
              aidRecords={aidRecords}
              nttCase={ntt}
              onOpenNttIntelligence={handleOpenNttIntel}
            />
          )}

          {/* MODE 3: Dedicated Single-Window "Posko Evakuasi" (replaces Rute Distribusi, from feat/homepage-slicing) */}
          {activeDisaster && isRouteOpen && (
            <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><EvacuationPostView
              disaster={activeDisaster}
              onClose={() => setIsRouteOpen(false)}
              onOpenDonationModal={() => setIsDonationModalOpen(true)}
              onOpenAIHelpdesk={() => handleOpenAI(true)}
              onViewDisasterDetail={handleOpenDetail}
              isDarkMode={isDarkMode}
              selectedPostId={selectedPostId}
              onSelectPost={setSelectedPostId}
              onSuggestedPosts={(id,posts)=>setDisasters(previous=>previous[id]?{...previous,[id]:{...previous[id],route:{...previous[id].route,checkpoints:posts}}}:previous)}
            /></Suspense>
          )}

          {/* MODE 4: Dedicated Single-Window "Semua Laporan Warga" (Strictly single window, no dual window) */}
          {activeDisaster && isReportsOpen && (
            <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><CitizenReportsView
              disaster={activeDisaster}
              onClose={() => setIsReportsOpen(false)}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onViewDisasterDetail={handleOpenDetail}
              onViewRoute={handleOpenRoute}
              isDarkMode={isDarkMode}
            /></Suspense>
          )}

          {/* MODE 5: Dedicated Single-Window "DisasterAI Helpdesk" */}
          {activeDisaster && isAIOpen && (
            <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><AIHelpdeskPanel
              key={aiWorkflow}
              expanded={isAIExpanded}
              onToggleExpanded={() => setIsAIExpanded(value => !value)}
              initialWorkflow={aiWorkflow}
              hasContext={hasAIContext}
              initialMessage={aiDraft?.message}
              initialAttachment={aiDraft?.file}
              user={currentUser}
              onRequireLogin={() => openLogin('report')}
              disaster={activeDisaster}
              onClose={() => setIsAIOpen(false)}
              onReportSubmitted={handleNewReportSuccess}
              disasters={moderationLoaded ? disasters : {}}
              intelReports={intelReports}
              aidRecords={aidRecords}
              onIntelReport={handleIntelReport}
              nttCase={ntt}
            /></Suspense>
          )}

          {/* MODE 6: Dedicated Single-Window "Kasus Gempa NTT" (real-data case, not demo) */}
          {isNttOpen && ntt && (
            <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><NttCaseView
              state={ntt}
              refreshing={nttRefreshing}
              onRefresh={handleRefreshNtt}
              onClose={() => setIsNttOpen(false)}
            /></Suspense>
          )}
        </main>

        {/* Standalone Report Modal (pipeline: extraction → validation → store) */}
      {isLoginOpen && (
        <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><LoginModal
          source={loginReason === 'account' ? 'avatar' : 'report'}
          initialError={loginError}
          onClose={() => {
            setIsLoginOpen(false);
            setLoginError('');
            writeLoginIntent(null);
          }}
          onSuccess={(user) => {
            setCurrentUser(user);
            setIsLoginOpen(false);
            setLoginError('');
            writeLoginIntent(null);
            if (loginReason === 'report' && !isAIOpen) openReportForm();
          }}
        /></Suspense>
      )}
      {activeDisaster && isReportModalOpen && <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        activeDisaster={activeDisaster}
        onReportSuccess={handleNewReportSuccess}
        onIntelReport={handleIntelReport}
      /></Suspense>}

      {/* Standalone Donation & Aid Distribution Modal */}
      {activeDisaster && isDonationModalOpen && <Suspense fallback={<div role="status" className="absolute bottom-4 right-4 rounded-xl bg-white p-3 shadow">{t('Memuat DisasterWatch...')}</div>}><DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        disaster={activeDisaster}
        onAidAdded={handleAidAdded}
      /></Suspense>}
    </div>
  );
}
