import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {Icon} from '../../../components/Icon';
import {PressableScale} from '../../../components/PressableScale';
import {useAppState} from '../../../context/AppStateContext';
import {analyticsApi, AnalyticsPeriod, CommandCenterBundle, SlotClassification} from '../../../services/api';
import {CcThemeContext, ccDark, ccLight, CcThemeMode, readCcThemeMode, writeCcThemeMode, useCc} from './ccTheme';
import {
  periodDateRangeLabel, Panel, KpiCard, SlotsKpiCard, TrendChart, Heatmap,
  SlotUtilizationPanel, ParkingSlotMapPanel, TaskFunnelPanel, TopDriversPanel, ServiceReliabilityPanel,
  ProcessTimingPanel,
} from './panels';

const PERIODS: {key: AnalyticsPeriod; label: string}[] = [
  {key: 'daily', label: 'Today'},
  {key: 'weekly', label: 'This Week'},
  {key: 'monthly', label: 'This Month'},
  {key: 'yearly', label: 'This Year'},
  {key: 'all', label: 'All-time'},
];

/*
 * The phone-frame counterpart to AdminCommandCenter.tsx's desktop grid —
 * same data (analyticsApi.commandCenter), same panels (./panels.tsx), same
 * "cc" reference-matched palette (with the same light/dark toggle), laid
 * out as a single scrolling column instead of a grid. This is what
 * replaces AdminDashboardScreen as the admin's "Dashboard" tab content on
 * a phone.
 *
 * By request, pared back to 6 panels (same set as the desktop version):
 * the 5-card KPI row, Parking Activity Trends, Hourly Demand Heatmap,
 * Slot Utilization, Parking Slot Map, Task Funnel and Top Drivers. Visitor
 * Analytics/Types, Anomaly Radar, Ask Your Parking System, Realtime
 * Operations and the Operational Health KPI were all removed from this
 * view. The Guard and Intelligence tabs (and their AI Insights preview
 * here) were removed from the admin console entirely, by request — the
 * Tasks/Visitors KPI cards above are display-only now that Guard is gone,
 * with nowhere sensible left to navigate to.
 */
export function AdminDashboardMobile({onOpenMap, onOpenDrivers, onOpenAttendance}: {
  onOpenMap: (block?: string) => void;
  onOpenDrivers: () => void;
  onOpenAttendance: () => void;
}) {
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
      <DashboardBody
        onOpenMap={onOpenMap} onOpenDrivers={onOpenDrivers} onOpenAttendance={onOpenAttendance}
        themeMode={themeMode} onToggleTheme={toggleTheme}
      />
    </CcThemeContext.Provider>
  );
}

function DashboardBody({onOpenMap, onOpenDrivers, onOpenAttendance, themeMode, onToggleTheme}: {
  onOpenMap: (block?: string) => void; onOpenDrivers: () => void; onOpenAttendance: () => void;
  themeMode: CcThemeMode; onToggleTheme: () => void;
}) {
  const cc = useCc();
  const {slots: liveSlots} = useAppState();
  const [period, setPeriod] = useState<AnalyticsPeriod>('monthly');
  const [data, setData] = useState<CommandCenterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) setLoading(true);
    analyticsApi.commandCenter(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => setErr('Could not load dashboard data'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);
  useEffect(() => { load(period); }, [period, load]);

  const classById = useMemo(() => {
    const m = new Map<string, SlotClassification>();
    if (data) for (const s of data.slots.slots) m.set(s.id, s.classification);
    return m;
  }, [data]);

  if (loading && !data) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '60vh', backgroundColor: cc.bg}}>
        <span className="spinner" style={{borderColor: cc.border, borderTopColor: cc.accentBlue}} />
        <span style={{fontSize: 12, fontWeight: 600, color: cc.textMuted}}>Loading dashboard…</span>
      </div>
    );
  }
  if (err && !data) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: '60vh', backgroundColor: cc.bg}}>
        <span style={{fontSize: 13, color: cc.textMuted}}>{err}</span>
        <PressableScale onClick={() => load(period)} style={{padding: '10px 20px', borderRadius: 12, backgroundColor: cc.accentBlue}}>
          <span style={{color: '#fff', fontSize: 13, fontWeight: 700}}>Retry</span>
        </PressableScale>
      </div>
    );
  }
  if (!data) return null;

  const {overview, kpiComparison, taskFunnelVolume, activityTrend, demandHeatmap, operationalFriction} = data;
  const occupiedNow = liveSlots.filter(s => s.status === 'occupied').length;
  const totalSlotsNow = liveSlots.length;
  const occPct = totalSlotsNow ? Math.round((occupiedNow / totalSlotsNow) * 100) : 0;

  return (
    <div className="screen-scroll" style={{backgroundColor: cc.bg, padding: 16, paddingBottom: 40}}>
      {/* Period selector + real date range + refresh + theme toggle */}
      <div style={{display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4}}>
        <div className="hscroll" style={{gap: 8, flex: 1}}>
          {PERIODS.map(p => {
            const on = p.key === period;
            return (
              <PressableScale key={p.key} disabled={loading} onClick={() => setPeriod(p.key)}
                style={{flexShrink: 0, padding: '7px 13px', borderRadius: 999, backgroundColor: on ? cc.accentBlue : cc.card, border: `1px solid ${on ? cc.accentBlue : cc.border}`, opacity: loading ? 0.6 : 1}}>
                <span style={{fontSize: 11.5, fontWeight: 800, color: on ? '#fff' : cc.textSecondary}}>{p.label}</span>
              </PressableScale>
            );
          })}
        </div>
        <PressableScale
          onClick={onToggleTheme}
          title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          style={{width: 32, height: 32, borderRadius: 16, backgroundColor: cc.card, border: `1px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <Icon name={themeMode === 'dark' ? 'moon' : 'sun'} size={14} color={cc.textPrimary} />
        </PressableScale>
        <PressableScale
          disabled={refreshing}
          style={{width: 32, height: 32, borderRadius: 16, backgroundColor: cc.card, border: `1px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.6 : 1, flexShrink: 0}}
          onClick={() => { setRefreshing(true); load(period, true); }}>
          {refreshing ? <span className="spinner" style={{width: 13, height: 13, borderColor: cc.border, borderTopColor: cc.accentBlue}} /> : <Icon name="refresh" size={14} color={cc.textPrimary} />}
        </PressableScale>
      </div>
      <div style={{fontSize: 10.5, color: cc.textMuted, fontWeight: 600, marginBottom: 14}}>{periodDateRangeLabel(period)}</div>

      {/* KPI row — 2 columns; the odd 5th card (Users) spans the full width. */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16}}>
        <KpiCard icon="car" variant={cc.kpi.tasks} value={overview.totalJobsCompleted.toLocaleString()} label="Parking Tasks" deltaPct={kpiComparison.tasks.pctChange} />
        <KpiCard icon="people" variant={cc.kpi.visitors} value={data.visitorIntelligence.total.toLocaleString()} label="Visitors" deltaPct={kpiComparison.visitors.pctChange} />
        <SlotsKpiCard occPct={occPct} occupied={occupiedNow} available={totalSlotsNow - occupiedNow} total={totalSlotsNow} onClick={() => onOpenMap()} />
        <KpiCard icon="car" variant={cc.kpi.drivers} value={String(kpiComparison.drivers.current)} label="Drivers" deltaPct={kpiComparison.drivers.pctChange} onClick={onOpenDrivers} />
        <div style={{gridColumn: 'span 2'}}>
          <KpiCard icon="userCard" variant={cc.kpi.users} value={String(kpiComparison.users.current)} label="Users" deltaPct={kpiComparison.users.pctChange} onClick={onOpenAttendance} />
        </div>
      </div>

      <div style={{marginBottom: 14}}><SlotUtilizationPanel liveSlots={liveSlots} onViewAll={() => onOpenMap()} /></div>
      <div style={{marginBottom: 14}}><Panel title="Parking Activity Trends"><TrendChart days={activityTrend.days} /></Panel></div>
      <div style={{marginBottom: 14}}><Panel title="Hourly Demand Heatmap"><Heatmap heatmap={demandHeatmap} /></Panel></div>
      <div style={{marginBottom: 14}}><ParkingSlotMapPanel liveSlots={liveSlots} classById={classById} onOpenSlots={() => onOpenMap()} /></div>
      <div style={{marginBottom: 14}}><TaskFunnelPanel funnelVolume={taskFunnelVolume} /></div>
      <div style={{marginBottom: 14}}><TopDriversPanel drivers={overview.drivers} onViewAll={onOpenDrivers} /></div>
      <ServiceReliabilityPanel friction={operationalFriction} />
      {/* New addition, appended last — does not touch any panel above. */}
      <div style={{marginTop: 14}}><ProcessTimingPanel funnel={data.taskFunnel} /></div>
    </div>
  );
}
