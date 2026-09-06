import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useAppState} from '../../../context/AppStateContext';
import {getSocket} from '../../../services/socket';
import {analyticsApi, AnalyticsPeriod, CommandCenterBundle, SlotClassification} from '../../../services/api';
import {cc} from './ccTheme';
import {Sidebar, CcSection} from './Sidebar';
import {TopHeader} from './TopHeader';
import {
  periodDateRangeLabel, Panel, KpiCard, SlotsKpiCard, HealthKpiCard, TrendChart, Heatmap,
  SlotUtilizationPanel, AiInsightsPanel, RealtimeOperationsPanel, ParkingSlotMapPanel,
  TaskFunnelPanel, TopDriversPanel, VisitorAnalyticsPanel, VisitorTypesPanel, AnomalyRadarPanel,
  AskParkingSystemPanel,
} from './panels';

// Existing screens reused as-is inside sidebar sections that don't need a
// bespoke desktop layout — see the brief's "reuse existing architecture,
// don't destroy existing functionality". Only the Dashboard section below
// is the bespoke, reference-matched build.
import {AdminGuardScreen} from '../AdminGuardScreen';
import {AdminMapScreen} from '../AdminMapScreen';
import {AdminStaffScreen} from '../AdminStaffScreen';
import {AdminAttendanceScreen} from '../AdminAttendanceScreen';
import {AdminIntelligenceScreen} from '../AdminIntelligenceScreen';
import {AnalyticsScreen} from '../../AnalyticsScreen';
import {SettingsScreen} from '../../SettingsScreen';

/*
 * Desktop admin "command center" — built to match a specific reference
 * image as closely as possible (composition, grid, KPI layout, sidebar,
 * charts, colors), while every number on it comes from the real database
 * via the backend's /analytics/command-center bundle (see
 * analytics.service.js) plus the app's existing live AppStateContext for
 * anything genuinely real-time (slot occupancy, the activity feed).
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
 */
export function AdminCommandCenter({userName}: {userName: string}) {
  const {notifications} = useAppState();
  const [section, setSection] = useState<CcSection>('dashboard');
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [connected, setConnected] = useState(() => getSocket()?.connected ?? false);

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    return () => { s.off('connect', onConnect); s.off('disconnect', onDisconnect); };
  }, []);

  return (
    <div style={{position: 'fixed', inset: 0, display: 'flex', backgroundColor: cc.bg, zIndex: 0}}>
      <Sidebar active={section} onSelect={setSection} userName={userName} />
      <div style={{flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column'}}>
        <TopHeader
          period={period} onPeriodChange={setPeriod} dateRangeLabel={periodDateRangeLabel(period)}
          onRefresh={() => setRefreshKey(k => k + 1)}
          refreshing={false} connected={connected}
          query={query} onQueryChange={setQuery}
          unreadCount={notifications.filter(n => !n.read).length} userName={userName}
        />
        <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
          {section === 'dashboard' && <DashboardSection period={period} refreshKey={refreshKey} onNavigate={setSection} />}
          {section === 'liveview' && <ScreenPane><AdminGuardScreen /></ScreenPane>}
          {section === 'slots' && <ScreenPane><AdminMapScreen /></ScreenPane>}
          {section === 'drivers' && <ScreenPane><AdminStaffScreen initialFilter="driver" /></ScreenPane>}
          {section === 'staff' && <ScreenPane><AdminAttendanceScreen /></ScreenPane>}
          {section === 'insights' && <ScreenPane><AdminIntelligenceScreen /></ScreenPane>}
          {section === 'explorer' && <ScreenPane><AnalyticsScreen /></ScreenPane>}
          {section === 'settings' && <ScreenPane><SettingsScreen /></ScreenPane>}
        </div>
      </div>
    </div>
  );
}

function ScreenPane({children}: {children: React.ReactNode}) {
  return (
    <div style={{display: 'flex', justifyContent: 'center', minHeight: '100%', backgroundColor: cc.bg}}>
      <div style={{width: '100%', maxWidth: 560}}>{children}</div>
    </div>
  );
}

// ── Dashboard section (data fetch + grid) ──────────────────────────────────

function DashboardSection({period, refreshKey, onNavigate}: {period: AnalyticsPeriod; refreshKey: number; onNavigate: (s: CcSection) => void}) {
  const {slots: liveSlots, tasks: liveTasks} = useAppState();
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

  const {overview, kpiComparison, health, taskFunnelVolume, anomalyRadar, visitorIntelligence, insights, activityTrend, demandHeatmap} = data;
  const occupiedNow = liveSlots.filter(s => s.status === 'occupied').length;
  const totalSlotsNow = liveSlots.length;
  const occPct = totalSlotsNow ? Math.round((occupiedNow / totalSlotsNow) * 100) : 0;

  return (
    <div style={{padding: 20}}>
      <div style={{display: 'flex', gap: 12, marginBottom: 16}}>
        <KpiCard icon="car" iconColor={cc.kpi.tasks.icon} bg={cc.kpi.tasks.bg} value={overview.totalJobsCompleted.toLocaleString()} label="Parking Tasks" deltaPct={kpiComparison.tasks.pctChange} onClick={() => onNavigate('liveview')} />
        <KpiCard icon="people" iconColor={cc.kpi.visitors.icon} bg={cc.kpi.visitors.bg} value={visitorIntelligence.total.toLocaleString()} label="Visitors" deltaPct={kpiComparison.visitors.pctChange} onClick={() => onNavigate('liveview')} />
        <SlotsKpiCard occPct={occPct} occupied={occupiedNow} available={totalSlotsNow - occupiedNow} total={totalSlotsNow} onClick={() => onNavigate('slots')} />
        <KpiCard icon="car" iconColor={cc.kpi.drivers.icon} bg={cc.kpi.drivers.bg} value={String(kpiComparison.drivers.current)} label="Drivers" deltaPct={kpiComparison.drivers.pctChange} onClick={() => onNavigate('drivers')} />
        <KpiCard icon="userCard" iconColor={cc.kpi.users.icon} bg={cc.kpi.users.bg} value={String(kpiComparison.users.current)} label="Users" deltaPct={kpiComparison.users.pctChange} onClick={() => onNavigate('staff')} />
        <HealthKpiCard health={health} onClick={() => onNavigate('insights')} />
      </div>

      <div style={{display: 'grid', gridTemplateColumns: '2fr 1.1fr 1fr 1.3fr', gap: 14, alignItems: 'start'}}>
        <div style={{gridColumn: '1', gridRow: '1'}}>
          <Panel title="Parking Activity Trends"><TrendChart days={activityTrend.days} /></Panel>
        </div>
        <div style={{gridColumn: '2', gridRow: '1'}}>
          <Panel title="Hourly Demand Heatmap"><Heatmap heatmap={demandHeatmap} /></Panel>
        </div>
        <div style={{gridColumn: '3', gridRow: '1'}}>
          <SlotUtilizationPanel liveSlots={liveSlots} onViewAll={() => onNavigate('slots')} />
        </div>
        <div style={{gridColumn: '4', gridRow: '1 / 3', display: 'flex', flexDirection: 'column', gap: 14, minHeight: 0}}>
          <AiInsightsPanel insights={insights} onNavigate={() => onNavigate('insights')} />
          <RealtimeOperationsPanel tasks={liveTasks} />
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

        <div style={{gridColumn: '1', gridRow: '3'}}>
          <VisitorAnalyticsPanel dailyCounts={visitorIntelligence.dailyCounts} />
        </div>
        <div style={{gridColumn: '2', gridRow: '3'}}>
          <VisitorTypesPanel byVehicleType={visitorIntelligence.byVehicleType} total={visitorIntelligence.total} note={visitorIntelligence.note} />
        </div>
        <div style={{gridColumn: '3', gridRow: '3'}}>
          <AnomalyRadarPanel categories={anomalyRadar.categories} />
        </div>
        <div style={{gridColumn: '4', gridRow: '3'}}>
          <AskParkingSystemPanel bundle={data} />
        </div>
      </div>
    </div>
  );
}
