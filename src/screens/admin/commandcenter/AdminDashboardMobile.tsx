import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Icon} from '../../../components/Icon';
import {PressableScale} from '../../../components/PressableScale';
import {useAppState} from '../../../context/AppStateContext';
import {analyticsApi, AnalyticsPeriod, CommandCenterBundle, SlotClassification} from '../../../services/api';
import {CcThemeContext, ccDark, ccLight, CcThemeMode, readCcThemeMode, writeCcThemeMode, useCc} from './ccTheme';
import {
  periodDateRangeLabel, Panel, KpiCard, TrendChart, Heatmap,
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
 * The mobile counterpart to AdminCommandCenter.tsx's desktop grid —
 * same data (analyticsApi.commandCenter), same panels (./panels.tsx), same
 * "cc" reference-matched palette (with light/dark toggle), laid
 * out as a high-density, glassy executive mobile command console.
 *
 * Preserves 100% of operational logic:
 * - Live AppStateContext socket-driven background refresh (debounced 4s, >=15s rate-limit)
 * - Period filtering with seamless in-flight visual dimming
 * - Panel actions (navigating to Map, Drivers, Attendance)
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
        onOpenMap={onOpenMap}
        onOpenDrivers={onOpenDrivers}
        onOpenAttendance={onOpenAttendance}
        themeMode={themeMode}
        onToggleTheme={toggleTheme}
      />
    </CcThemeContext.Provider>
  );
}

function DashboardBody({onOpenMap, onOpenDrivers, onOpenAttendance, themeMode, onToggleTheme}: {
  onOpenMap: (block?: string) => void;
  onOpenDrivers: () => void;
  onOpenAttendance: () => void;
  themeMode: CcThemeMode;
  onToggleTheme: () => void;
}) {
  const cc = useCc();
  const {slots: liveSlots, tasks: liveTasks, visitors: liveVisitors, notifications: liveNotifications} = useAppState();
  const [period, setPeriod] = useState<AnalyticsPeriod>('daily');
  const [data, setData] = useState<CommandCenterBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback((p: AnalyticsPeriod, silent?: boolean) => {
    if (!silent) setLoading(true);
    analyticsApi.commandCenter(p)
      .then(d => { setData(d); setErr(null); })
      .catch(() => { if (!silent) setErr('Could not load dashboard telemetry'); })
      .finally(() => { if (!silent) setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  // Real websocket-driven live refresh: tasks/visitors/notifications are
  // patched live by AppStateContext from genuine Socket.IO events. Debounced (4s)
  // and rate-limited (>=15s apart) background refetch.
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

  const isDark = themeMode === 'dark';

  if (loading && !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: '75vh',
        backgroundColor: cc.bg,
        padding: 24,
      }}>
        <div style={{
          padding: '24px 28px',
          borderRadius: 18,
          backgroundColor: isDark ? 'rgba(17,23,38,0.7)' : 'rgba(255,255,255,0.7)',
          border: `1px solid ${cc.border}`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 14,
          maxWidth: 320,
          textAlign: 'center',
          boxShadow: isDark ? '0 12px 32px rgba(0,0,0,0.45)' : '0 12px 32px rgba(15,23,42,0.06)',
        }}>
          <div style={{position: 'relative', width: 44, height: 44}}>
            <span className="spinner" style={{
              width: 44,
              height: 44,
              borderWidth: 3,
              borderColor: cc.divider,
              borderTopColor: cc.accentBlue,
            }} />
          </div>
          <div>
            <div style={{fontSize: 13, fontWeight: 800, color: cc.textPrimary, letterSpacing: -0.2}}>
              SYNCING COMMAND TELEMETRY
            </div>
            <div style={{fontSize: 11, fontWeight: 600, color: cc.textMuted, marginTop: 4, lineHeight: 1.4}}>
              Connecting to hospital fleet stream and parking bay sensors...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (err && !data) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: '75vh',
        backgroundColor: cc.bg,
        padding: 24,
      }}>
        <div style={{
          padding: '24px 28px',
          borderRadius: 18,
          backgroundColor: isDark ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.04)',
          border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'}`,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          maxWidth: 320,
          textAlign: 'center',
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: 'rgba(239,68,68,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Icon name="alert" size={20} color="#EF4444" />
          </div>
          <div style={{fontSize: 13, fontWeight: 700, color: cc.textPrimary}}>{err}</div>
          <PressableScale
            onClick={() => load(period)}
            style={{
              padding: '9px 20px',
              borderRadius: 10,
              backgroundColor: cc.accentBlue,
              boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
            }}>
            <span style={{color: '#fff', fontSize: 12, fontWeight: 800}}>RETRY SYNC</span>
          </PressableScale>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const {overview, kpiComparison, taskFunnelVolume, activityTrend, demandHeatmap, operationalFriction} = data;

  return (
    <div className="screen-scroll" style={{
      backgroundColor: cc.bg,
      padding: '16px 14px 48px',
      position: 'relative',
    }}>
      {/* ── Executive Workstation Header Bar ── */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 16,
        backgroundColor: isDark ? 'rgba(17,23,38,0.72)' : 'rgba(255,255,255,0.75)',
        border: `1px solid ${cc.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 24px rgba(15,23,42,0.04)',
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: isDark ? 'rgba(59,130,246,0.16)' : 'rgba(37,99,235,0.1)',
            border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : 'rgba(37,99,235,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="dashboard" size={19} color={cc.accentBlue} />
          </div>
          <div style={{minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{
                fontSize: 13,
                fontWeight: 900,
                color: cc.textPrimary,
                letterSpacing: -0.2,
                textTransform: 'uppercase',
              }}>
                Command Console
              </span>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 6px',
                borderRadius: 999,
                backgroundColor: isDark ? 'rgba(34,197,94,0.14)' : 'rgba(22,163,74,0.1)',
                border: `1px solid ${isDark ? 'rgba(34,197,94,0.3)' : 'rgba(22,163,74,0.25)'}`,
              }}>
                <span style={{
                  width: 5,
                  height: 5,
                  borderRadius: 2.5,
                  backgroundColor: cc.success,
                  boxShadow: `0 0 6px ${cc.success}`,
                }} />
                <span style={{fontSize: 9, fontWeight: 800, color: cc.success, letterSpacing: 0.2}}>
                  LIVE
                </span>
              </div>
            </div>
            <div style={{
              fontSize: 10.5,
              fontWeight: 600,
              color: cc.textMuted,
              marginTop: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              KIMS Healthcare Valet Operations
            </div>
          </div>
        </div>

        {/* Action button controls */}
        <div style={{display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0}}>
          <PressableScale
            onClick={onToggleTheme}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${cc.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={15} color={cc.textPrimary} />
          </PressableScale>

          <PressableScale
            disabled={refreshing}
            onClick={() => { setRefreshing(true); load(period, true); }}
            title="Refresh command telemetry"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
              border: `1px solid ${cc.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing ? 0.6 : 1,
            }}>
            {refreshing ? (
              <span className="spinner" style={{
                width: 14,
                height: 14,
                borderWidth: 2,
                borderColor: cc.border,
                borderTopColor: cc.accentBlue,
              }} />
            ) : (
              <Icon name="refresh" size={15} color={cc.textPrimary} />
            )}
          </PressableScale>
        </div>
      </div>

      {/* ── Period Selector Bar ── */}
      <div style={{
        padding: '8px 10px',
        borderRadius: 14,
        backgroundColor: isDark ? 'rgba(17,23,38,0.5)' : 'rgba(255,255,255,0.6)',
        border: `1px solid ${cc.border}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginBottom: 8,
      }}>
        <div className="hscroll" style={{gap: 6}}>
          {PERIODS.map(p => {
            const on = p.key === period;
            return (
              <PressableScale
                key={p.key}
                disabled={loading}
                onClick={() => setPeriod(p.key)}
                style={{
                  flexShrink: 0,
                  padding: '6px 12px',
                  borderRadius: 999,
                  backgroundColor: on
                    ? cc.accentBlue
                    : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${on ? cc.accentBlue : cc.border}`,
                  boxShadow: on ? '0 2px 8px rgba(37,99,235,0.25)' : 'none',
                  opacity: loading ? 0.6 : 1,
                }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: on ? '#FFFFFF' : cc.textSecondary,
                  letterSpacing: -0.1,
                }}>
                  {p.label}
                </span>
              </PressableScale>
            );
          })}
        </div>
      </div>

      {/* Range Metadata Ribbon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 4px',
        marginBottom: 12,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 10.5,
          fontWeight: 700,
          color: cc.textMuted,
        }}>
          <Icon name="calendar" size={12} color={cc.textMuted} />
          <span>{periodDateRangeLabel(period)}</span>
        </div>
        <div style={{
          fontSize: 10,
          fontWeight: 700,
          color: cc.textMuted,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}>
          {loading ? 'SYNCING...' : 'UP TO DATE'}
        </div>
      </div>

      {/* ── Main Dashboard Body Panels ── */}
      <div style={{
        opacity: loading ? 0.55 : 1,
        transition: 'opacity 0.2s ease',
        pointerEvents: loading ? 'none' : 'auto',
      }}>
        {/* KPI Grid (2x2) */}
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14}}>
          <KpiCard
            icon="car"
            variant={cc.kpi.tasks}
            value={overview.totalJobsCompleted.toLocaleString()}
            label="Parking Tasks"
          />
          <KpiCard
            icon="people"
            variant={cc.kpi.visitors}
            value={data.visitorIntelligence.total.toLocaleString()}
            label="Visitors"
          />
          <KpiCard
            icon="car"
            variant={cc.kpi.drivers}
            value={String(kpiComparison.drivers.current)}
            label="Drivers"
            onClick={onOpenDrivers}
          />
          <KpiCard
            icon="userCard"
            variant={cc.kpi.users}
            value={String(kpiComparison.users.current)}
            label="Users"
            onClick={onOpenAttendance}
          />
        </div>

        {/* Operational Panels */}
        <div style={{display: 'flex', flexDirection: 'column', gap: 14}}>
          <div>
            <SlotUtilizationPanel liveSlots={liveSlots} onViewAll={() => onOpenMap()} />
          </div>

          <div>
            <Panel title="Parking Activity Trends">
              <TrendChart days={activityTrend.days} />
            </Panel>
          </div>

          <div>
            <Panel title="Hourly Demand Heatmap">
              <Heatmap heatmap={demandHeatmap} />
            </Panel>
          </div>

          <div>
            <ParkingSlotMapPanel
              liveSlots={liveSlots}
              classById={classById}
              onOpenSlots={() => onOpenMap()}
            />
          </div>

          <div>
            <TaskFunnelPanel funnelVolume={taskFunnelVolume} />
          </div>

          <div>
            <TopDriversPanel drivers={overview.drivers} onViewAll={onOpenDrivers} />
          </div>

          <div>
            <ServiceReliabilityPanel friction={operationalFriction} />
          </div>

          <div>
            <ProcessTimingPanel funnel={data.taskFunnel} />
          </div>
        </div>

        {/* Workstation Footer Watermark */}
        <div style={{
          marginTop: 24,
          padding: '16px 12px',
          borderRadius: 14,
          border: `1px dashed ${cc.divider}`,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}>
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: cc.textMuted,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}>
            KIMS Hospital Healthcare Valet Telemetry
          </div>
          <div style={{fontSize: 9.5, fontWeight: 600, color: cc.textMuted, opacity: 0.7}}>
            Realtime Socket Protocol • Encrypted Mobile Dispatch Stream
          </div>
        </div>
      </div>
    </div>
  );
}
