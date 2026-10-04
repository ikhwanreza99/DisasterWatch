import React, { useEffect, useState } from 'react';
import { disastersData } from './data/disasters';
import { DisasterCategory, DisasterCheckpoint, DisasterIncident } from './types';
import { Header } from './components/Header';
import { CategoryFilterBar } from './components/CategoryFilterBar';
import { MapCanvas } from './components/MapCanvas';
import { SlimSidebar } from './components/SlimSidebar';
import { DisasterDetailView } from './components/DisasterDetailView';
import { CitizenReportsView } from './components/CitizenReportsView';
import { AIHelpdeskPanel } from './components/AIHelpdeskPanel';
import { ReportModal } from './components/ReportModal';
import { DonationModal } from './components/DonationModal';
import { EvacuationPostView } from './components/EvacuationPostView';

export default function App() {
  const [disasters, setDisasters] = useState<Record<string, DisasterIncident>>(disastersData);
  const [activeDisasterKey, setActiveDisasterKey] = useState<string>('padang');
  const [highlightedDisasterKey, setHighlightedDisasterKey] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<DisasterCategory | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>('Today');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  // Exclusive single-window panel states: strictly at most ONE panel open at any time
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isRouteOpen, setIsRouteOpen] = useState<boolean>(false);
  const [isReportsOpen, setIsReportsOpen] = useState<boolean>(false);
  const [isSidebarMinimized, setIsSidebarMinimized] = useState<boolean>(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(false);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);

  // Disaster Checkpoint
  const [selectedPostId, setSelectedPostId] =
    useState<DisasterCheckpoint['id'] | null>(null);

  useEffect(() => {
    setSelectedPostId(null);
  }, [activeDisasterKey, isRouteOpen]);

  // Modal overlays
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = useState<boolean>(false);

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
    setIsSidebarMinimized(false);
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
    setIsSidebarExpanded(false);
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
    setIsSidebarExpanded(false);
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
    setIsSidebarExpanded(false);
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
      setIsSidebarExpanded(false);
      setIsSidebarMinimized(true);
    }
  };

  const handleExpandSidebar = () => {
    setIsDetailOpen(false);
    setIsRouteOpen(false);
    setIsReportsOpen(false);
    setIsAIOpen(false);

    setIsSidebarMinimized(false);
    setIsSidebarExpanded(true);
  };

  const handleCollapseSidebar = () => {
    setIsSidebarExpanded(false);
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

  const handleNewReportSuccess = (newReportData: any) => {
    // Add the newly filed report to the active disaster's reports list
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

  return (
    <div
      className={`w-screen h-screen overflow-hidden flex flex-col transition-colors duration-300 ${
        isDarkMode ? 'bg-[#070d18] text-slate-100 dark' : 'bg-white text-slate-800'
      }`}
      data-purpose="app-container"
    >
      {/* Top Bar Navigation */}
      <Header
          disasters={disasters}
          onHighlightDisaster={setHighlightedDisasterKey}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onOpenReportModal={() => setIsReportModalOpen(true)}
        />

        {/* Main Work Area */}
        <main className="relative flex-1 grid grid-cols-12 overflow-hidden">
          {/* Left Category Filter Dock */}
          <CategoryFilterBar
            activeCategory={activeCategory}
            onSelectCategory={handleSelectCategory}
            isDarkMode={isDarkMode}
          />

          {/* Central Map Canvas Area */}
          <MapCanvas
            highlightedDisasterKey={highlightedDisasterKey}
            disasters={disasters}
            activeDisasterKey={activeDisasterKey}
            onSelectDisaster={handleSelectDisaster}
            activeCategory={activeCategory}
            isDarkMode={isDarkMode}
            onExpandView={handleExpandSidebar}
            onOpenAIHelpdesk={handleOpenAI}
            isExpanded={isSidebarExpanded}
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
            onOpenSidebar={() => setIsSidebarMinimized(false)}
            isEvacuationPostOpen={isRouteOpen}
            onOpenEvacuationPost={handleOpenRoute}
            onToggleEvacuationPost={handleToggleRoute}
            selectedPostId={selectedPostId}
            onSelectPost={setSelectedPostId}
          />

          {/* MODE 1: Compact Homepage Menu Sidebar (Only rendered when no other window is open and user un-minimizes sidebar) */}
          {!isDetailOpen && !isRouteOpen && !isReportsOpen && !isAIOpen && !isSidebarMinimized && (
            <SlimSidebar
              disaster={activeDisaster}

              isExpanded={isSidebarExpanded}
              onExpandView={handleExpandSidebar}
              onCollapseView={handleCollapseSidebar}

              onOpenAIHelpdesk={handleOpenAI}
              onOpenDonationModal={() => setIsDonationModalOpen(true)}
              onOpenDisasterBrief={handleOpenDisasterBrief}

              onMinimize={() => {
                setIsSidebarExpanded(false);
                setIsSidebarMinimized(true);
              }}

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
            />
          )}

          {/* MODE 3: Dedicated Single-Window "Rute Distribusi Bantuan" (Strictly single window, no dual window) */}
          {isRouteOpen && (
            <EvacuationPostView
              disaster={activeDisaster}
              onClose={() => setIsRouteOpen(false)}
              selectedPostId={selectedPostId}
              onSelectPost={setSelectedPostId}
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
            />
          )}
        </main>

        {/* Standalone Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        activeDisaster={activeDisaster}
        onReportSuccess={handleNewReportSuccess}
      />

      {/* Standalone Donation & Aid Distribution Modal */}
      <DonationModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
        disaster={activeDisaster}
      />
    </div>
  );
}
