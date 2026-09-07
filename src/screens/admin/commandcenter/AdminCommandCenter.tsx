import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useAppState} from '../../../context/AppStateContext';
import {analyticsApi, AnalyticsPeriod, CommandCenterBundle, SlotClassification} from '../../../services/api';
import {CcThemeContext, ccDark, ccLight, CcThemeMode, readCcThemeMode, writeCcThemeMode, useCc} from './ccTheme';
import {Sidebar, CcSection} from './Sidebar';
import {TopHeader} from './TopHeader';
import {
  periodDateRangeLabel, Panel, KpiCard, TrendChart, Heatmap,
  SlotUtilizationPanel, ParkingSlotMapPanel, TaskFunnelPanel, TopDriversPanel, ServiceReliabilityPanel,
  ProcessTimingPanel,
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
  const [section, setSection] = useState<CcSection>('dashboard');
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  // Real loading state of the Dashboard section's data fetch, lifted up so
  // the header's refresh spinner reflects it honestly — it used to be
  // hardcoded `refreshing={false}` below, so a period switch (or any
  // background refresh) gave zero visual feedback while the ~2-3s
  // command-center fetch was in flight, making the dashboard look frozen.
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [themeMode, setThemeMode] = useState<CcThemeMode>(() => readCcThemeMode());
  const palette = themeMode === 'light' ? ccLight : ccDark;

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
            refreshing={section === 'dashboard' && dashboardLoading}
            query={query} onQueryChange={setQuery}
            themeMode={themeMode} onToggleTheme={toggleTheme}
          />
          <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
            {section === 'dashboard' && <DashboardSection period={period} refreshKey={refreshKey} onNavigate={setSection} onLoadingChange={setDashboardLoading} />}
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

function DashboardSection({period, refreshKey, onNavigate, onLoadingChange}: {
  period: AnalyticsPeriod; refreshKey: number; onNavigate: (s: CcSection) => void;
  onLoadingChange: (loading: boolean) => void;
}) {
  const cc = useCc();
  const {slots: liveSlots, tasks: liveTasks, visitors: liveVisitors, notifications: liveNotifications} = useAppState();
  const [data, setData] = useState<CommandCenterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // `silent` backs the live-refresh path below: a background refetch swaps
  // the numbers in place once it resolves, without the spinner/dimming a
  // period switch or manual refresh shows — those already communicate
  // "loading" through the header's spinner (see onLoadingChange).
  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) { setLoading(true); onLoadingChange(true); }
    analyticsApi.commandCenter(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => { if (!silent) setErr('Could not load dashboard data'); })
      .finally(() => { if (!silent) { setLoading(false); onLoadingChange(false); } });
  }, [onLoadingChange]);
  useEffect(() => { load(period); }, [period, refreshKey, load]);

  // Real websocket-driven live refresh — reuses the app's existing genuine
  // Socket.IO state (tasks/visitors/notifications, already patched live by
  // AppStateContext from task:upsert/visitor:upsert/notification:new; see
  // realtime/index.js on the backend) as the trigger for a background
  // refetch of this heavy aggregate bundle, instead of only ever updating
  // on a manual period change or refresh click. Debounced (a single job's
  // lifecycle fires several task:upsert events within seconds) and
  // rate-limited to at most once every 15s (the bundle itself costs ~2-3s
  // server-side — refetching on every event would hammer it) so the
  // dashboard stays live without flooding the backend.
  const periodRef = useRef(period);
  periodRef.current = period;
  const lastFetchRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedOnceRef = useRef(false);
  useEffect(() => {
    if (!mountedOnceRef.current) { mountedOnceRef.current = true; return; } // skip the initial hydration
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const sinceLast = Date.now() - lastFetchRef.current;
      const fire = () => { lastFetchRef.current = Date.now(); load(periodRef.current, true); };
      if (sinceLast >= 15000) fire();
      else timerRef.current = setTimeout(fire, 15000 - sinceLast);
    }, 4000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [liveTasks, liveVisitors, liveNotifications, load]);

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

  const {overview, kpiComparison, taskFunnelVolume, activityTrend, demandHeatmap, operationalFriction} = data;

  return (
    // Dims (never blanks) in place while a period switch or manual refresh
    // is in flight — previously a period change showed the PREVIOUS
    // period's numbers with zero visual change for the ~2-3s the fetch
    // takes, which is exactly why switching to "This Week" looked like it
    // silently did nothing. Live background refreshes (the socket-driven
    // effect above) stay silent/undimmed on purpose — those swap in place.
    <div style={{padding: 20, opacity: loading ? 0.55 : 1, transition: 'opacity 0.15s', pointerEvents: loading ? 'none' : 'auto'}}>
      <div style={{display: 'flex', gap: 12, marginBottom: 16}}>
        <KpiCard icon="car" variant={cc.kpi.tasks} value={overview.totalJobsCompleted.toLocaleString()} label="Parking Tasks" />
        <KpiCard icon="people" variant={cc.kpi.visitors} value={data.visitorIntelligence.total.toLocaleString()} label="Visitors" />
        <KpiCard icon="car" variant={cc.kpi.drivers} value={String(kpiComparison.drivers.current)} label="Drivers" onClick={() => onNavigate('drivers')} />
        <KpiCard icon="userCard" variant={cc.kpi.users} value={String(kpiComparison.users.current)} label="Users" onClick={() => onNavigate('staff')} />
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

        <div style={{gridColumn: '1 / 4', gridRow: '3'}}>
          <ServiceReliabilityPanel friction={operationalFriction} />
        </div>

        {/* New addition — does not touch any panel above. Charts avgMinutes
           per stage from taskFunnel (already fetched, never charted before)
           to show where time is actually lost, not just where volume goes. */}
        <div style={{gridColumn: '1 / 4', gridRow: '4'}}>
          <ProcessTimingPanel funnel={data.taskFunnel} />
        </div>
      </div>
    </div>
  );
}
