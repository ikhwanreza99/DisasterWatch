import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { disastersData } from './data/disasters';
import { DisasterCategory, DisasterIncident } from './types';
import { Header } from './components/Header';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { MapProvider } from './components/map/MapProvider';
import { SlimSidebar } from './components/SlimSidebar';
import { DisasterDetailView } from './components/DisasterDetailView';
import { RouteDistributionView } from './components/RouteDistributionView';
import { CitizenReportsView } from './components/CitizenReportsView';
import { AIHelpdeskPanel } from './components/AIHelpdeskPanel';
import { ReportModal } from './components/ReportModal';
import { DonationModal } from './components/DonationModal';
import { IntelligenceSummaryBar } from './components/IntelligenceSummaryBar';
import { ArchitectureBadge } from './components/ArchitectureBadge';
import { BmkgSignalCard } from './components/BmkgSignalCard';
import { BmkgWeatherWarningCard } from './components/BmkgWeatherWarningCard';
import { useBmkgEarthquakes, useBmkgWeatherWarnings } from './services/bmkg';
import { firmsSensorsLabel, useFirmsHotspots } from './services/firms';
import type { AidRecord, IntelligenceReport, UserIdentity } from './domain/intelligence';
import { demoAid, demoReports } from './data/seedDemo';
import { loadDisasters } from './services/store/disasterStore';
import { ensureUser } from './lib/firebase/auth';
import { mockUser } from './lib/firebase/auth';

export default function App() {
  const [disasters, setDisasters] = useState<Record<string, DisasterIncident>>(disastersData);
  const [activeDisasterKey, setActiveDisasterKey] = useState<string>('demak');
  const [intelReports, setIntelReports] = useState<IntelligenceReport[]>(demoReports);
  const [aidRecords, setAidRecords] = useState<AidRecord[]>(demoAid);
  const [storeNotice, setStoreNotice] = useState<string>('Mode demo lokal — Firestore fallback aktif.');
  const [currentUser, setCurrentUser] = useState<UserIdentity>(mockUser());
  const [activeCategory, setActiveCategory] = useState<DisasterCategory | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('Today');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Exclusive single-window panel states: strictly at most ONE panel open at any time
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isRouteOpen, setIsRouteOpen] = useState<boolean>(false);
  const [isReportsOpen, setIsReportsOpen] = useState<boolean>(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(true);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);

  // Modal overlays
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isIntelMinimized, setIsIntelMinimized] = useState<boolean>(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState<boolean>(false);

  // BMKG V1: official feed → React state → map/UI. No Firestore, no auto-disaster.
  // Fetch on load + manual refresh only (no aggressive polling).
  const bmkg = useBmkgEarthquakes();
  // NASA FIRMS hotspots via server-side proxy (MAP_KEY never reaches the browser).
  // Range follows the header date selector (Today / 24 jam / 7 hari / 30 hari).
  const firms = useFirmsHotspots(selectedDate);
  // BMKG weather nowcast: RSS → CAP details → React state. Same constraints.
  const bmkgWx = useBmkgWeatherWarnings();

  const activeDisaster = disasters[activeDisasterKey] || disasters['padang'];

  const handleToggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleSelectDisaster = (key: string) => {
    if (disasters[key]) {
      setActiveDisasterKey(key);
    }
  };

  const handleSelectCategory = (cat: DisasterCategory | 'all') => {
    setActiveCategory(cat);
    // If the active disaster doesn't match the new category, pick the first visible
    if (cat !== 'all' && activeDisaster.category !== cat) {
      const match = Object.values(disasters).find((d) => d.category === cat);
      if (match) {
        setActiveDisasterKey(match.id);
      }
    }
  };

  // Mutually exclusive single-window openers (ensures ZERO dual window anywhere)
  const handleOpenDetail = () => {
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(true);
    setIsDetailOpen(true);
  };

  const handleToggleDetail = () => {
    if (isDetailOpen) {
      setIsDetailOpen(false);
    } else {
      handleOpenDetail();
    }
  };

  const handleOpenRoute = () => {
    setIsDetailOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(true);
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
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsAIOpen(false);
    setIsSidebarMinimized(true);
    setIsReportsOpen(true);
  };

  const handleToggleReports = () => {
    if (isReportsOpen) {
      setIsReportsOpen(false);
    } else {
      handleOpenReports();
    }
  };

  const handleOpenAI = () => {
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsSidebarMinimized(true);
    setIsAIOpen(true);
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
      setIsSidebarMinimized(false);
    } else {
      setIsSidebarMinimized(true);
    }
  };

  const handleOpenDisasterBrief = () => {
    alert(
      `[DATA TEKNIS SATGAS BNPB & BMKG]\n` +
        `Wilayah: ${activeDisaster.name}, ${activeDisaster.province}\n` +
        `Bencana: ${activeDisaster.fullTitleDisplay}\n` +
        `Status: ${activeDisaster.urgency}\n` +
        `Estimasi Kerugian: ${activeDisaster.cost}\n` +
        `Gap Pemulihan: ${activeDisaster.gapRecovery}\n` +
        `Jumlah Hotspot/Titik: ${activeDisaster.stats.hotspots}\n` +
        `Personel Siaga: ${activeDisaster.stats.personnel}`
    );
  };

  // Load Firestore (fallback to mock) + ensure auth session once.
  useEffect(() => {
    let cancelled = false;
    loadDisasters().then(({ data, status }) => {
      if (cancelled) return;
      setDisasters(data);
      setStoreNotice(status.message);
      if (!data[activeDisasterKey] && data['demak']) setActiveDisasterKey('demak');
    });
    ensureUser().then((u) => {
      if (!cancelled) setCurrentUser(u);
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
      location: newReportData.location || activeDisaster.name,
      title: 'Laporan Warga Baru',
      desc: newReportData.description || newReportData.desc || 'Laporan baru diterima dari lapangan.',
      time: 'Baru saja',
      author: 'Oleh: Warga Pelapor Terverifikasi',
      tag: 'Menunggu Verifikasi TRC',
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
            location: rep.location.name,
            title: e ? `${e.disasterType.toUpperCase()} • AI ${(Math.round((rep.aiConfidence ?? 0) * 100))}%` : 'Laporan AI',
            desc: rep.rawText.slice(0, 220),
            time: 'Baru saja',
            author: `Oleh: ${rep.sourceName}`,
            tag: rep.verificationStatus === 'VERIFIED' ? 'Terverifikasi Posko TRC' : rep.verificationStatus === 'CONFLICTING' ? 'Konflik — Perlu Verifikasi' : 'AI Review — Menunggu TRC',
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
      className={`w-screen h-screen overflow-hidden flex flex-col transition-colors duration-300 ${
        isDarkMode ? 'bg-[#070d18] text-slate-100 dark' : 'bg-white text-slate-800'
      }`}
      data-purpose="app-container"
    >
      {/* Top Bar Navigation */}
      <Header
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />

        {/* Collapsible intelligence panel */}
        <div className="relative" data-purpose="intel-panel">
          <button
            type="button"
            onClick={() => setIsIntelMinimized((v) => !v)}
            aria-expanded={!isIntelMinimized}
            aria-label={isIntelMinimized ? 'Tampilkan panel ringkasan' : 'Minimize panel ringkasan'}
            title={isIntelMinimized ? 'Tampilkan' : 'Minimize'}
            className="absolute right-3 top-1 z-10 flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isIntelMinimized ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            <span>{isIntelMinimized ? 'Tampilkan' : 'Minimize'}</span>
          </button>

          {isIntelMinimized ? (
            <div className="px-6 sm:px-8 py-1.5 text-[11px] font-semibold text-slate-400">Ringkasan intelijen disembunyikan</div>
          ) : (
            <>
              <IntelligenceSummaryBar disasters={disasters} reports={intelReports} aid={aidRecords}>
                <BmkgSignalCard
                  inline
                  latest={bmkg.latest}
                  count={bmkg.events.length}
                  status={bmkg.status}
                  refreshing={bmkg.refreshing}
                  onRefresh={bmkg.refresh}
                />
                <BmkgWeatherWarningCard
                  inline
                  active={bmkgWx.active}
                  upcoming={bmkgWx.upcoming}
                  status={bmkgWx.status}
                  errorType={bmkgWx.errorType}
                  refreshing={bmkgWx.refreshing}
                  onRefresh={bmkgWx.refresh}
                />
              </IntelligenceSummaryBar>
              <ArchitectureBadge />
              {/* BMKG official signal status (earthquake + weather feeds) */}
              <div className="px-6 sm:px-8 pt-1 flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">BMKG Official Signals</span>
                <span
                  className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${
                    bmkg.status.state === 'ready'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  EARTHQUAKE {bmkg.status.state === 'ready' ? 'LIVE' : bmkg.status.state.toUpperCase()}
                </span>
                <span
                  className={`rounded-full border px-1.5 py-px text-[9px] font-bold ${
                    bmkgWx.status.state === 'ready'
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                      : bmkgWx.errorType === 'RSS_CORS_BLOCKED' || bmkgWx.errorType === 'CAP_CORS_BLOCKED'
                        ? 'border-orange-300 bg-orange-100 text-orange-700 dark:border-orange-700 dark:bg-orange-950/60 dark:text-orange-300'
                        : 'border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
                  }`}
                >
                  WEATHER{' '}
                  {bmkgWx.status.state === 'ready'
                    ? 'LIVE'
                    : bmkgWx.errorType === 'RSS_CORS_BLOCKED' || bmkgWx.errorType === 'CAP_CORS_BLOCKED'
                      ? 'BROWSER ACCESS BLOCKED'
                      : bmkgWx.status.state.toUpperCase()}
                </span>
              </div>
              <div className="px-6 sm:px-8 pb-1 flex items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{storeNotice}</span>
                  <span className="ml-2 text-slate-400">• Pengguna: {currentUser.displayName ?? currentUser.uid}{currentUser.isMock ? ' (mock)' : ''}</span>
                </span>
                <span className="shrink-0 text-[10px] font-medium text-slate-400 text-right">
                  MOCK + AI-PROCESSSED — bukan feed resmi BNPB/BMKG
                </span>
              </div>
            </>
          )}
        </div>

        {/* Main Work Area */}
        <main className="relative flex-1 grid grid-cols-12 overflow-hidden">
          {/* Left Category Filter Dock */}
          <CategoryFilterBar
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            isDarkMode={isDarkMode}
          />

          {/* Central Map Canvas Area (provider-abstracted, Leaflet default) */}
          <MapProvider
            disasters={disasters}
            activeDisasterKey={activeDisasterKey}
            onSelectDisaster={handleSelectDisaster}
            activeCategory={activeCategory}
            isDarkMode={isDarkMode}
            onExpandView={handleOpenDetail}
            onOpenAIHelpdesk={handleOpenAI}
            isExpanded={false}
            isSidebarMinimized={isSidebarMinimized}
            onToggleSidebar={handleToggleSidebar}
            isDetailOpen={isDetailOpen}
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
            bmkgEvents={bmkg.events}
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
            firmsRangeLabel={firms.range.label}
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
          {!isDetailOpen && !isRouteOpen && !isReportsOpen && !isAIOpen && !isSidebarMinimized && (
            <SlimSidebar
              disaster={activeDisaster}
              onExpandView={handleOpenDetail}
              onOpenAIHelpdesk={handleOpenAI}
              onOpenDisasterBrief={handleOpenDisasterBrief}
              onMinimize={() => setIsSidebarMinimized(true)}
              onOpenRoute={handleOpenRoute}
              onOpenReports={handleOpenReports}
            />
          )}

          {/* MODE 2: Dedicated Single-Window "Detail Bencana" (Strictly single window, no dual window) */}
          {isDetailOpen && (
            <DisasterDetailView
              disaster={activeDisaster}
              onClose={() => setIsDetailOpen(false)}
              onOpenDonationModal={() => setIsDonationModalOpen(true)}
              onOpenDisasterBrief={handleOpenDisasterBrief}
              onViewRoute={handleOpenRoute}
              onViewReports={handleOpenReports}
              isDarkMode={isDarkMode}
              intelReports={intelReports}
              aidRecords={aidRecords}
            />
          )}

          {/* MODE 3: Dedicated Single-Window "Rute Distribusi Bantuan" (Strictly single window, no dual window) */}
          {isRouteOpen && (
            <RouteDistributionView
              disaster={activeDisaster}
              onClose={() => setIsRouteOpen(false)}
              onOpenDonationModal={() => setIsDonationModalOpen(true)}
              onOpenAIHelpdesk={handleOpenReports}
              onViewDisasterDetail={handleOpenDetail}
              isDarkMode={isDarkMode}
            />
          )}

          {/* MODE 4: Dedicated Single-Window "Semua Laporan Warga" (Strictly single window, no dual window) */}
          {isReportsOpen && (
            <CitizenReportsView
              disaster={activeDisaster}
              onClose={() => setIsReportsOpen(false)}
              onOpenReportModal={() => setIsReportModalOpen(true)}
              onViewDisasterDetail={handleOpenDetail}
              onViewRoute={handleOpenRoute}
              isDarkMode={isDarkMode}
            />
          )}

          {/* MODE 5: Dedicated Single-Window "DisasterAI Helpdesk" */}
          {isAIOpen && (
            <AIHelpdeskPanel
              disaster={activeDisaster}
              onClose={() => setIsAIOpen(false)}
              onReportSubmitted={handleNewReportSuccess}
              disasters={disasters}
              intelReports={intelReports}
              aidRecords={aidRecords}
              onIntelReport={handleIntelReport}
            />
          )}
        </main>

        {/* Standalone Report Modal (pipeline: extraction → validation → store) */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        activeDisaster={activeDisaster}
        onReportSuccess={handleNewReportSuccess}
        onIntelReport={handleIntelReport}
      />

      {/* Standalone Donation & Aid Distribution Modal */}
      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        disaster={activeDisaster}
        onAidAdded={handleAidAdded}
      />
    </div>
  );
}
