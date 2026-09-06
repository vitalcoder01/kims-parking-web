import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useAppState} from '../../../context/AppStateContext';
import {getSocket} from '../../../services/socket';
import {analyticsApi, AnalyticsPeriod, CommandCenterBundle, SlotClassification} from '../../../services/api';
import {CcThemeContext, ccDark, ccLight, CcThemeMode, readCcThemeMode, writeCcThemeMode, useCc} from './ccTheme';
import {Sidebar, CcSection} from './Sidebar';
import {TopHeader} from './TopHeader';
import {
  periodDateRangeLabel, Panel, KpiCard, SlotsKpiCard, TrendChart, Heatmap,
  SlotUtilizationPanel, ParkingSlotMapPanel, TaskFunnelPanel, TopDriversPanel,
} from './panels';

// Existing screens reused as-is inside sidebar sections that don't need a
// bespoke desktop layout — see the brief's "reuse existing architecture,
// don't destroy existing functionality". Only the Dashboard section below
// is the bespoke, reference-matched build.
import {AdminMapScreen} from '../AdminMapScreen';
import {AdminStaffScreen} from '../AdminStaffScreen';
import {AdminAttendanceScreen} from '../AdminAttendanceScreen';
import {AnalyticsScreen} from '../../AnalyticsScreen';
import {SettingsScreen} from '../../SettingsScreen';

/*
 * Desktop admin "command center" — built to match a specific reference
 * image as closely as possible (composition, grid, KPI layout, sidebar,
 * charts, colors), while every number on it comes from the real database
 * via the backend's /analytics/command-center bundle (see
 * analytics.service.js) plus the app's existing live AppStateContext for
 * anything genuinely real-time (slot occupancy).
 *
 * Only renders on wide viewports (see App.tsx's useIsWide gate) — narrower
 * screens get AdminDashboardMobile.tsx instead, a single-column stack of
 * these SAME panels (see ./panels.tsx) rather than a shrunk copy of this
 * grid. Every sidebar section other than "Dashboard" simply re-renders the
 * SAME mobile screen component the phone-frame admin already uses, just
 * inside a wider shell instead of degrading this into a second, parallel
 * implementation.
 *
 * Sidebar items with no existing backing screen (Parking Tasks list,
 * Visitors list, Notifications list, Reports) are shown disabled with a
 * "Soon" tag in Sidebar.tsx rather than linked to something fake.
 *
 * By request, the Dashboard section itself was pared back from the
 * original reference's full 12-panel layout: Visitor Analytics, Visitor
 * Types, Anomaly Radar, Ask Your Parking System, Realtime Operations and
 * the Operational Health KPI were all removed. Six panels remain: the
 * 5-card KPI row, Parking Activity Trends, Hourly Demand Heatmap, Slot
 * Utilization, Parking Slot Map, Task Funnel and Top Drivers.
 *
 * The "Live View" (Guard) and "AI Insights" (Intelligence) sidebar
 * sections — and their mobile tab-bar equivalents — were removed entirely
 * by request, not just hidden: see Sidebar.tsx's CcSection type and
 * App.tsx's TabKey, neither of which has a slot for them anymore. The
 * underlying AdminGuardScreen.tsx / AdminIntelligenceScreen.tsx files were
 * deleted outright, not left dead in the tree.
 */
export function AdminCommandCenter({userName}: {userName: string}) {
  const {notifications} = useAppState();
  const [section, setSection] = useState<CcSection>('dashboard');
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [connected, setConnected] = useState(() => getSocket()?.connected ?? false);
  const [themeMode, setThemeMode] = useState<CcThemeMode>(() => readCcThemeMode());
  const palette = themeMode === 'light' ? ccLight : ccDark;

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => { s.off('connect', onConnect); s.off('disconnect', onDisconnect); };
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(m => {
      const next: CcThemeMode = m === 'dark' ? 'light' : 'dark';
      writeCcThemeMode(next);
      return next;
    });
  }, []);

  return (
    <CcThemeContext.Provider value={palette}>
      <div style={{position: 'fixed', inset: 0, display: 'flex', backgroundColor: palette.bg, zIndex: 0}}>
        <Sidebar active={section} onSelect={setSection} userName={userName} />
        <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
          <TopHeader
            period={period} onPeriodChange={setPeriod} dateRangeLabel={periodDateRangeLabel(period)}
            onRefresh={() => setRefreshKey(k => k + 1)}
            refreshing={false} connected={connected}
            query={query} onQueryChange={setQuery}
            unreadCount={notifications.filter(n => !n.read).length} userName={userName}
            themeMode={themeMode} onToggleTheme={toggleTheme}
          />
          <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
            {section === 'dashboard' && <DashboardSection period={period} refreshKey={refreshKey} onNavigate={setSection} />}
            {section === 'slots' && <ScreenPane><AdminMapScreen /></ScreenPane>}
            {section === 'drivers' && <ScreenPane><AdminStaffScreen initialFilter="driver" /></ScreenPane>}
            {section === 'staff' && <ScreenPane><AdminAttendanceScreen /></ScreenPane>}
            {section === 'explorer' && <ScreenPane><AnalyticsScreen /></ScreenPane>}
            {section === 'settings' && <ScreenPane><SettingsScreen /></ScreenPane>}
          </div>
        </div>
      </div>
    </CcThemeContext.Provider>
  );
}

function ScreenPane({children}: {children: React.ReactNode}) {
  const cc = useCc();
  return (
    <div style={{display: 'flex', justifyContent: 'center', minHeight: '100%', backgroundColor: cc.bg}}>
      <div style={{width: '100%', maxWidth: 560}}>{children}</div>
    </div>
  );
}

// ── Dashboard section (data fetch + grid) ──────────────────────────────────

function DashboardSection({period, refreshKey, onNavigate}: {period: AnalyticsPeriod; refreshKey: number; onNavigate: (s: CcSection) => void}) {
  const cc = useCc();
  const {slots: liveSlots} = useAppState();
  const [data, setData] = useState<CommandCenterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback((p: AnalyticsPeriod) => {
    setLoading(true);
    analyticsApi.commandCenter(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => setErr('Could not load dashboard data'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(period); }, [period, refreshKey, load]);

  const classById = useMemo(() => {
    const m = new Map<string, SlotClassification>();
    if (data) for (const s of data.slots.slots) m.set(s.id, s.classification);
    return m;
  }, [data]);

  if (loading && !data) {
    return <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}><span className="spinner" style={{borderColor: cc.border, borderTopColor: cc.accentBlue}} /></div>;
  }
  if (err && !data) {
    return <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: cc.textMuted, fontSize: 13}}>{err}</div>;
  }
  if (!data) return null;

  const {overview, kpiComparison, taskFunnelVolume, activityTrend, demandHeatmap} = data;
  const occupiedNow = liveSlots.filter(s => s.status === 'occupied').length;
  const totalSlotsNow = liveSlots.length;
  const occPct = totalSlotsNow ? Math.round((occupiedNow / totalSlotsNow) * 100) : 0;

  return (
    <div style={{padding: 20}}>
      <div style={{display: 'flex', gap: 12, marginBottom: 16}}>
        <KpiCard icon="car" variant={cc.kpi.tasks} value={overview.totalJobsCompleted.toLocaleString()} label="Parking Tasks" deltaPct={kpiComparison.tasks.pctChange} />
        <KpiCard icon="people" variant={cc.kpi.visitors} value={data.visitorIntelligence.total.toLocaleString()} label="Visitors" deltaPct={kpiComparison.visitors.pctChange} />
        <SlotsKpiCard occPct={occPct} occupied={occupiedNow} available={totalSlotsNow - occupiedNow} total={totalSlotsNow} onClick={() => onNavigate('slots')} />
        <KpiCard icon="car" variant={cc.kpi.drivers} value={String(kpiComparison.drivers.current)} label="Drivers" deltaPct={kpiComparison.drivers.pctChange} onClick={() => onNavigate('drivers')} />
        <KpiCard icon="userCard" variant={cc.kpi.users} value={String(kpiComparison.users.current)} label="Users" deltaPct={kpiComparison.users.pctChange} onClick={() => onNavigate('staff')} />
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr', gap: 14, alignItems: 'start'}}>
        <div style={{gridColumn: '1', gridRow: '1'}}>
          <Panel title="Parking Activity Trends"><TrendChart days={activityTrend.days} /></Panel>
        </div>
        <div style={{gridColumn: '2', gridRow: '1'}}>
          <Panel title="Hourly Demand Heatmap"><Heatmap heatmap={demandHeatmap} /></Panel>
        </div>
        <div style={{gridColumn: '3', gridRow: '1'}}>
          <SlotUtilizationPanel liveSlots={liveSlots} onViewAll={() => onNavigate('slots')} />
        </div>

        <div style={{gridColumn: '1', gridRow: '2'}}>
          <ParkingSlotMapPanel liveSlots={liveSlots} classById={classById} onOpenSlots={() => onNavigate('slots')} />
        </div>
        <div style={{gridColumn: '2', gridRow: '2'}}>
          <TaskFunnelPanel funnelVolume={taskFunnelVolume} />
        </div>
        <div style={{gridColumn: '3', gridRow: '2'}}>
          <TopDriversPanel drivers={overview.drivers} onViewAll={() => onNavigate('drivers')} />
        </div>
      </div>
    </div>
  );
}
