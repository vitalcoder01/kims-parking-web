import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {PressableScale} from '../../../components/PressableScale';
import {useAppState} from '../../../context/AppStateContext';
import {analyticsApi, AnalyticsPeriod, CommandCenterBundle, SlotClassification} from '../../../services/api';
import {cc} from './ccTheme';
import {
  periodDateRangeLabel, Panel, KpiCard, SlotsKpiCard, HealthKpiCard, TrendChart, Heatmap,
  SlotUtilizationPanel, AiInsightsPanel, RealtimeOperationsPanel, ParkingSlotMapPanel,
  TaskFunnelPanel, TopDriversPanel, VisitorAnalyticsPanel, VisitorTypesPanel, AnomalyRadarPanel,
  AskParkingSystemPanel,
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
 * "cc" reference-matched palette, laid out as a single scrolling column
 * instead of a 4-column grid. This is what replaces AdminDashboardScreen as
 * the admin's "Dashboard" tab content on a phone.
 *
 * Deliberately reordered, not just stacked top-to-bottom in the desktop's
 * grid order: AI Insights, capacity (slot utilization) and live operations
 * come first — the things worth seeing without scrolling on a phone — with
 * the denser trend/heatmap charts and the explorer panels below.
 */
export function AdminDashboardMobile({onOpenMap, onOpenDrivers, onOpenGuard, onOpenIntelligence, onOpenAttendance}: {
  onOpenMap: (block?: string) => void;
  onOpenDrivers: () => void;
  onOpenGuard: () => void;
  onOpenIntelligence: () => void;
  onOpenAttendance: () => void;
}) {
  const {slots: liveSlots, tasks: liveTasks} = useAppState();
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

  const {overview, kpiComparison, health, taskFunnelVolume, anomalyRadar, visitorIntelligence, insights, activityTrend, demandHeatmap} = data;
  const occupiedNow = liveSlots.filter(s => s.status === 'occupied').length;
  const totalSlotsNow = liveSlots.length;
  const occPct = totalSlotsNow ? Math.round((occupiedNow / totalSlotsNow) * 100) : 0;

  return (
    <div className="screen-scroll" style={{backgroundColor: cc.bg, padding: 16, paddingBottom: 40}}>
      {/* Period selector + real date range + refresh */}
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
          disabled={refreshing}
          style={{width: 32, height: 32, borderRadius: 16, backgroundColor: cc.card, border: `1px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.6 : 1, flexShrink: 0}}
          onClick={() => { setRefreshing(true); load(period, true); }}>
          {refreshing ? <span className="spinner" style={{width: 13, height: 13, borderColor: cc.border, borderTopColor: cc.accentBlue}} /> : <span style={{fontSize: 13, color: cc.textPrimary}}>↻</span>}
        </PressableScale>
      </div>
      <div style={{fontSize: 10.5, color: cc.textMuted, fontWeight: 600, marginBottom: 14}}>{periodDateRangeLabel(period)}</div>

      {/* KPI row — 2 columns x 3 rows on a phone rather than one cramped scroller. */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16}}>
        <KpiCard icon="car" iconColor={cc.kpi.tasks.icon} bg={cc.kpi.tasks.bg} value={overview.totalJobsCompleted.toLocaleString()} label="Parking Tasks" deltaPct={kpiComparison.tasks.pctChange} onClick={onOpenGuard} />
        <KpiCard icon="people" iconColor={cc.kpi.visitors.icon} bg={cc.kpi.visitors.bg} value={visitorIntelligence.total.toLocaleString()} label="Visitors" deltaPct={kpiComparison.visitors.pctChange} onClick={onOpenGuard} />
        <SlotsKpiCard occPct={occPct} occupied={occupiedNow} available={totalSlotsNow - occupiedNow} total={totalSlotsNow} onClick={() => onOpenMap()} />
        <KpiCard icon="car" iconColor={cc.kpi.drivers.icon} bg={cc.kpi.drivers.bg} value={String(kpiComparison.drivers.current)} label="Drivers" deltaPct={kpiComparison.drivers.pctChange} onClick={onOpenDrivers} />
        <KpiCard icon="userCard" iconColor={cc.kpi.users.icon} bg={cc.kpi.users.bg} value={String(kpiComparison.users.current)} label="Users" deltaPct={kpiComparison.users.pctChange} onClick={onOpenAttendance} />
        <HealthKpiCard health={health} onClick={onOpenIntelligence} />
      </div>

      {/* Critical intelligence first — AI insights, capacity, live ops. */}
      <div style={{marginBottom: 14}}><AiInsightsPanel insights={insights} onNavigate={onOpenIntelligence} /></div>
      <div style={{marginBottom: 14}}><SlotUtilizationPanel liveSlots={liveSlots} onViewAll={() => onOpenMap()} /></div>
      <div style={{marginBottom: 14}}><RealtimeOperationsPanel tasks={liveTasks} /></div>

      {/* Demand / trend charts */}
      <div style={{marginBottom: 14}}><Panel title="Parking Activity Trends"><TrendChart days={activityTrend.days} /></Panel></div>
      <div style={{marginBottom: 14}}><Panel title="Hourly Demand Heatmap"><Heatmap heatmap={demandHeatmap} /></Panel></div>

      {/* Investigation panels */}
      <div style={{marginBottom: 14}}><ParkingSlotMapPanel liveSlots={liveSlots} classById={classById} onOpenSlots={() => onOpenMap()} /></div>
      <div style={{marginBottom: 14}}><TaskFunnelPanel funnelVolume={taskFunnelVolume} /></div>
      <div style={{marginBottom: 14}}><TopDriversPanel drivers={overview.drivers} onViewAll={onOpenDrivers} /></div>
      <div style={{marginBottom: 14}}><VisitorAnalyticsPanel dailyCounts={visitorIntelligence.dailyCounts} /></div>
      <div style={{marginBottom: 14}}><VisitorTypesPanel byVehicleType={visitorIntelligence.byVehicleType} total={visitorIntelligence.total} note={visitorIntelligence.note} /></div>
      <div style={{marginBottom: 14}}><AnomalyRadarPanel categories={anomalyRadar.categories} /></div>
      <AskParkingSystemPanel bundle={data} />
    </div>
  );
}
