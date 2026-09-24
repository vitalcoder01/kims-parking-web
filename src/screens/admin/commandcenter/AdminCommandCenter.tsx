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

import {AdminMapScreen} from '../AdminMapScreen';
import {AdminStaffScreen} from '../AdminStaffScreen';
import {AdminAttendanceScreen} from '../AdminAttendanceScreen';
import {AnalyticsScreen} from '../../AnalyticsScreen';
import {SettingsScreen} from '../../SettingsScreen';

/*
 * Desktop admin "command center" —
 * Multi-panel executive workstation providing real-time fleet analytics,
 * spatial slot utilization, driver performance, and operational funnel timing.
 */
export function AdminCommandCenter({userName}: {userName: string}) {
  const [section, setSection] = useState<CcSection>('dashboard');
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const [query, setQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
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
            period={period}
            onPeriodChange={setPeriod}
            dateRangeLabel={periodDateRangeLabel(period)}
            onRefresh={() => setRefreshKey(k => k + 1)}
            refreshing={section === 'dashboard' && dashboardLoading}
            query={query}
            onQueryChange={setQuery}
            themeMode={themeMode}
            onToggleTheme={toggleTheme}
          />
          <div style={{flex: 1, minHeight: 0, overflowY: 'auto'}}>
            {section === 'dashboard' && (
              <DashboardSection
                period={period}
                refreshKey={refreshKey}
                onNavigate={setSection}
                onLoadingChange={setDashboardLoading}
                query={query}
              />
            )}
            {section === 'slots' && <ScreenPane><AdminMapScreen searchQuery={query} /></ScreenPane>}
            {section === 'drivers' && <ScreenPane><AdminStaffScreen initialFilter="driver" initialQuery={query} /></ScreenPane>}
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
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      minHeight: '100%',
      backgroundColor: cc.bg,
      padding: '16px 20px',
    }}>
      <div style={{width: '100%', maxWidth: 960}}>{children}</div>
    </div>
  );
}

// ── Dashboard Section (Data Fetch + Workstation Grid) ──────────────────────────

function DashboardSection({
  period,
  refreshKey,
  onNavigate,
  onLoadingChange,
  query = '',
}: {
  period: AnalyticsPeriod;
  refreshKey: number;
  onNavigate: (s: CcSection) => void;
  onLoadingChange: (loading: boolean) => void;
  query?: string;
}) {
  const cc = useCc();
  const {slots: liveSlots, tasks: liveTasks, visitors: liveVisitors, notifications: liveNotifications} = useAppState();
  const [data, setData] = useState<CommandCenterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) { setLoading(true); onLoadingChange(true); }
    analyticsApi.commandCenter(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => { if (!silent) setErr('Could not load command center telemetry'); })
      .finally(() => { if (!silent) { setLoading(false); onLoadingChange(false); } });
  }, [onLoadingChange]);

  useEffect(() => {
    load(period);
  }, [period, refreshKey, load]);

  // Real websocket-driven live refresh: debounced 4s, rate-limited >=15s
  const periodRef = useRef(period);
  periodRef.current = period;
  const lastFetchRef = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedOnceRef = useRef(false);

  useEffect(() => {
    if (!mountedOnceRef.current) { mountedOnceRef.current = true; return; }
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

  const filteredDrivers = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data.overview.drivers;
    const q = query.trim().toLowerCase();
    return data.overview.drivers.filter(d => d.name.toLowerCase().includes(q));
  }, [data, query]);

  if (loading && !data) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 14}}>
        <span className="spinner" style={{width: 36, height: 36, borderColor: cc.border, borderTopColor: cc.accentBlue}} />
        <span style={{fontSize: 12, fontWeight: 700, color: cc.textMuted}}>
          Aggregating executive command telemetry...
        </span>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12}}>
        <div style={{color: cc.textMuted, fontSize: 13, fontWeight: 600}}>{err}</div>
        <button
          type="button"
          onClick={() => load(period)}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            backgroundColor: cc.accentBlue,
            color: '#fff',
            border: 'none',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
          }}>
          Retry Sync
        </button>
      </div>
    );
  }

  if (!data) return null;

  const {overview, kpiComparison, taskFunnelVolume, activityTrend, demandHeatmap, operationalFriction} = data;

  return (
    <div style={{
      padding: '20px 24px 48px',
      opacity: loading ? 0.55 : 1,
      transition: 'opacity 0.2s ease',
      pointerEvents: loading ? 'none' : 'auto',
    }}>
      {/* ── Top KPI Metric Row (4 Cards) ── */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18}}>
        <KpiCard
          icon="car"
          variant={cc.kpi.tasks}
          value={overview.totalJobsCompleted.toLocaleString()}
          label="Parking Tasks Completed"
        />
        <KpiCard
          icon="people"
          variant={cc.kpi.visitors}
          value={data.visitorIntelligence.total.toLocaleString()}
          label="Registered Visitors"
        />
        <KpiCard
          icon="car"
          variant={cc.kpi.drivers}
          value={String(kpiComparison.drivers.current)}
          label="Active Fleet Runners"
          onClick={() => onNavigate('drivers')}
        />
        <KpiCard
          icon="userCard"
          variant={cc.kpi.users}
          value={String(kpiComparison.users.current)}
          label="Staff & Personnel"
          onClick={() => onNavigate('staff')}
        />
      </div>

      {/* ── Desktop Command Center Multi-Panel Grid ── */}
      <div style={{display: 'grid', gridTemplateColumns: '2fr 1.15fr 1fr', gap: 14, alignItems: 'start'}}>
        <div style={{gridColumn: '1', gridRow: '1'}}>
          <Panel title="Parking Activity Trends">
            <TrendChart days={activityTrend.days} />
          </Panel>
        </div>
        <div style={{gridColumn: '2', gridRow: '1'}}>
          <Panel title="Hourly Demand Heatmap">
            <Heatmap heatmap={demandHeatmap} />
          </Panel>
        </div>
        <div style={{gridColumn: '3', gridRow: '1'}}>
          <SlotUtilizationPanel liveSlots={liveSlots} onViewAll={() => onNavigate('slots')} />
        </div>

        <div style={{gridColumn: '1', gridRow: '2'}}>
          <ParkingSlotMapPanel
            liveSlots={liveSlots}
            classById={classById}
            onOpenSlots={() => onNavigate('slots')}
          />
        </div>
        <div style={{gridColumn: '2', gridRow: '2'}}>
          <TaskFunnelPanel funnelVolume={taskFunnelVolume} />
        </div>
        <div style={{gridColumn: '3', gridRow: '2'}}>
          <TopDriversPanel drivers={filteredDrivers} onViewAll={() => onNavigate('drivers')} />
        </div>

        <div style={{gridColumn: '1 / 4', gridRow: '3'}}>
          <ServiceReliabilityPanel friction={operationalFriction} />
        </div>

        <div style={{gridColumn: '1 / 4', gridRow: '4'}}>
          <ProcessTimingPanel funnel={data.taskFunnel} />
        </div>
      </div>
    </div>
  );
}
