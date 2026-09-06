import React, {useMemo, useState} from 'react';
import {Icon} from '../../../components/Icon';
import {PressableScale} from '../../../components/PressableScale';
import {ParkingSlot, ParkingTask} from '../../../context/AppStateContext';
import {
  AnalyticsPeriod, CommandCenterBundle, InsightCard, SlotClassification,
  AnomalyRadarCategory, TaskFunnelVolume, DriverAnalytics, OperationalHealth, DemandHeatmap,
} from '../../../services/api';
import {cc, ccCard, ccPanelTitle, ccEmptyText} from './ccTheme';

/*
 * Every presentational building block of the "command center" dashboard —
 * shared between the desktop shell (AdminCommandCenter.tsx, a wide 4-column
 * grid) and the mobile version (AdminDashboardMobile.tsx, the same panels
 * stacked in one column). One definition of each chart/card so the two
 * layouts can never drift into showing different numbers for the same
 * thing — only the ARRANGEMENT differs per screen size, never the content
 * or the data source.
 */

/** Mirrors backend utils/periodRange.js — display-only; the backend range
 *  is still the one actually filtering the data. Monday-start weeks, same
 *  as the server's own convention. */
export function periodDateRangeLabel(period: AnalyticsPeriod): string {
  const fmt = (d: Date) => d.toLocaleDateString(undefined, {month: 'short', day: 'numeric', year: 'numeric'});
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'all') return 'All time';
  if (period === 'daily') return fmt(startOfToday);
  if (period === 'weekly') {
    const day = startOfToday.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const from = new Date(startOfToday.getTime() - diffToMonday * 86400000);
    const to = new Date(from.getTime() + 6 * 86400000);
    return `${fmt(from)} - ${fmt(to)}`;
  }
  if (period === 'monthly') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `${fmt(from)} - ${fmt(to)}`;
  }
  return `Jan 1 - Dec 31, ${now.getFullYear()}`;
}

export function agoLabel(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.floor(mins / 60)} hr ago`;
}

export function hourLabel(h: number): string {
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${period}`;
}

// ── Shared small primitives ────────────────────────────────────────────────

export function Panel({title, right, children, style}: {title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties}) {
  return (
    <div style={{...ccCard, padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', ...style}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0, gap: 8}}>
        <span style={ccPanelTitle}>{title}</span>
        {right}
      </div>
      <div style={{flex: 1, minHeight: 0}}>{children}</div>
    </div>
  );
}

export const linkBtnStyle: React.CSSProperties = {background: 'none', border: 'none', color: cc.accentBlue, fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0};

export function LegendRow({color, label, value, pct}: {color: string; label: string; value: number; pct?: number}) {
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <span style={{width: 9, height: 9, borderRadius: 3, backgroundColor: color, flexShrink: 0}} />
      <span style={{flex: 1, fontSize: 11, color: cc.textSecondary}}>{label}</span>
      <span style={{fontSize: 11, fontWeight: 800, color: cc.textPrimary}}>{value}{pct != null ? ` (${pct}%)` : ''}</span>
    </div>
  );
}

export function LegendDot({color, label}: {color: string; label: string}) {
  return (
    <span style={{display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: cc.textMuted, fontWeight: 700}}>
      <span style={{width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: 'inline-block'}} />{label}
    </span>
  );
}

export function Donut({parts, size = 100, stroke = 13, centerLabel, centerSub}: {
  parts: {value: number; color: string}[]; size?: number; stroke?: number; centerLabel: string; centerSub?: string;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offsetAcc = 0;
  return (
    <div style={{position: 'relative', width: size, height: size, flexShrink: 0}}>
      <svg width={size} height={size} style={{transform: 'rotate(-90deg)'}}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={cc.divider} strokeWidth={stroke} fill="none" />
        {parts.filter(p => p.value > 0).map((p, i) => {
          const frac = p.value / total;
          const dash = frac * c;
          const strokeDashoffset = -offsetAcc;
          offsetAcc += dash;
          return (
            <circle key={i} cx={size / 2} cy={size / 2} r={r} stroke={p.color} strokeWidth={stroke} fill="none"
              strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={strokeDashoffset} />
          );
        })}
      </svg>
      <div style={{position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{fontSize: size * 0.2, fontWeight: 900, color: cc.textPrimary}}>{centerLabel}</span>
        {centerSub && <span style={{fontSize: Math.max(8, size * 0.09), fontWeight: 700, color: cc.textMuted, marginTop: 2}}>{centerSub}</span>}
      </div>
    </div>
  );
}

export function MiniSparkline({series, color, width = 60, height = 20}: {series: number[]; color: string; width?: number; height?: number}) {
  const max = Math.max(1, ...series);
  const n = series.length;
  const pts = series.map((v, i) => `${(i / Math.max(1, n - 1)) * width},${height - (v / max) * height}`).join(' ');
  return <svg width={width} height={height} style={{flexShrink: 0}}><polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} /></svg>;
}

// ── KPI row ─────────────────────────────────────────────────────────────

export function KpiCard({icon, iconColor, bg, value, label, deltaPct, onClick}: {
  icon: import('../../../components/Icon').IconName; iconColor: string; bg: string; value: string; label: string; deltaPct: number | null; onClick: () => void;
}) {
  return (
    <PressableScale onClick={onClick} style={{flex: 1, borderRadius: 14, backgroundColor: bg, padding: 14, textAlign: 'left', display: 'block', minWidth: 0}}>
      <Icon name={icon} size={17} color={iconColor} />
      <div style={{fontSize: 22, fontWeight: 900, color: '#fff', marginTop: 8, letterSpacing: -0.5}}>{value}</div>
      <div style={{fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', marginTop: 1}}>{label}</div>
      {deltaPct != null && (
        <div style={{display: 'flex', alignItems: 'center', gap: 4, marginTop: 8}}>
          <Icon name={deltaPct >= 0 ? 'arrowUp' : 'arrowDown'} size={9} color={deltaPct >= 0 ? '#8CF0B4' : '#F0A8A8'} />
          <span style={{fontSize: 10.5, fontWeight: 800, color: deltaPct >= 0 ? '#8CF0B4' : '#F0A8A8'}}>{Math.abs(deltaPct)}%</span>
          <span style={{fontSize: 9.5, color: 'rgba(255,255,255,0.5)'}}>vs last period</span>
        </div>
      )}
    </PressableScale>
  );
}

export function SlotsKpiCard({occPct, occupied, available, total, onClick}: {occPct: number; occupied: number; available: number; total: number; onClick: () => void}) {
  return (
    <PressableScale onClick={onClick} style={{flex: 1, borderRadius: 14, backgroundColor: cc.kpi.slots.bg, padding: 14, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left'}}>
      <div style={{flex: 1, minWidth: 0}}>
        <Icon name="parking" size={17} color={cc.kpi.slots.icon} />
        <div style={{fontSize: 20, fontWeight: 900, color: '#fff', marginTop: 6}}>{total}</div>
        <div style={{fontSize: 10.5, fontWeight: 700, color: 'rgba(255,255,255,0.7)'}}>Parking Slots</div>
        <div style={{fontSize: 9, color: 'rgba(255,255,255,0.55)', marginTop: 4}}>{occupied} Occupied · {available} Available</div>
      </div>
      <Donut parts={[{value: occupied, color: '#F1786F'}, {value: available, color: '#4ADE9A'}]} size={52} stroke={7} centerLabel={`${occPct}%`} />
    </PressableScale>
  );
}

export function HealthKpiCard({health, onClick}: {health: OperationalHealth; onClick: () => void}) {
  const bandColor = health.band === 'Good' ? cc.success : health.band === 'Fair' ? cc.warning : cc.danger;
  return (
    <PressableScale onClick={onClick} style={{flex: 1, ...ccCard, padding: 14, textAlign: 'left', display: 'block'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
        <Icon name="shield" size={17} color={bandColor} />
        <span style={{fontSize: 9.5, fontWeight: 800, color: bandColor, backgroundColor: bandColor + '22', borderRadius: 999, padding: '2px 7px'}}>{health.band}</span>
      </div>
      <div style={{fontSize: 11, fontWeight: 700, color: cc.textSecondary, marginTop: 8}}>Operational Health</div>
      <div style={{fontSize: 20, fontWeight: 900, color: cc.textPrimary, marginTop: 2}}>{health.score} <span style={{fontSize: 12, color: cc.textMuted, fontWeight: 700}}>/ 100</span></div>
      <div style={{height: 5, borderRadius: 3, backgroundColor: cc.divider, marginTop: 8, overflow: 'hidden'}}>
        <div style={{height: 5, borderRadius: 3, width: `${health.score}%`, backgroundColor: bandColor}} />
      </div>
    </PressableScale>
  );
}

// ── Parking Activity Trends ────────────────────────────────────────────────

export function TrendChart({days}: {days: {date: string; tasks: number; visitors: number}[]}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const width = 640, height = 190, padL = 4, padR = 4, padT = 8, padB = 20;
  const innerW = width - padL - padR, innerH = height - padT - padB;
  const n = days.length;
  const maxVal = Math.max(1, ...days.map(d => Math.max(d.tasks, d.visitors)));
  const xAt = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const pathFor = (key: 'tasks' | 'visitors') => days.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(d[key])}`).join(' ');
  const areaPath = n > 0 ? `${pathFor('tasks')} L ${xAt(n - 1)} ${padT + innerH} L ${xAt(0)} ${padT + innerH} Z` : '';
  const active = hoverIdx != null ? days[hoverIdx] : null;

  if (n === 0) return <div style={ccEmptyText}>No activity recorded in this period.</div>;

  return (
    <div style={{position: 'relative'}}>
      <svg
        width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
        style={{display: 'block', overflow: 'visible', cursor: 'crosshair'}}
        onMouseMove={e => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const relX = ((e.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padL) / innerW) * (n - 1));
          setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
        }}
        onTouchStart={e => {
          const svg = e.currentTarget;
          const rect = svg.getBoundingClientRect();
          const touch = e.touches[0];
          const relX = ((touch.clientX - rect.left) / rect.width) * width;
          const idx = Math.round(((relX - padL) / innerW) * (n - 1));
          setHoverIdx(Math.max(0, Math.min(n - 1, idx)));
        }}
        onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="ccAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={cc.accentBlue} stopOpacity="0.35" />
            <stop offset="100%" stopColor={cc.accentBlue} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#ccAreaFill)" stroke="none" />
        <path d={pathFor('tasks')} fill="none" stroke={cc.accentBlue} strokeWidth={2} />
        <path d={pathFor('visitors')} fill="none" stroke={cc.accentGreen} strokeWidth={2} />
        {active && hoverIdx != null && (
          <>
            <line x1={xAt(hoverIdx)} x2={xAt(hoverIdx)} y1={padT} y2={padT + innerH} stroke={cc.border} strokeWidth={1} />
            <circle cx={xAt(hoverIdx)} cy={yAt(active.tasks)} r={3.5} fill={cc.accentBlue} />
            <circle cx={xAt(hoverIdx)} cy={yAt(active.visitors)} r={3.5} fill={cc.accentGreen} />
          </>
        )}
      </svg>
      {active && hoverIdx != null && (
        <div style={{position: 'absolute', left: `${(xAt(hoverIdx) / width) * 100}%`, top: 0, pointerEvents: 'none', transform: 'translateX(6px)'}}>
          <div style={{backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`, borderRadius: 9, padding: '8px 10px', fontSize: 11, whiteSpace: 'nowrap'}}>
            <div style={{fontWeight: 800, color: cc.textPrimary, marginBottom: 4}}>{active.date}</div>
            <div style={{color: cc.accentBlue, fontWeight: 700}}>Parking Tasks {active.tasks}</div>
            <div style={{color: cc.accentGreen, fontWeight: 700}}>Visitors {active.visitors}</div>
          </div>
        </div>
      )}
      <div style={{display: 'flex', justifyContent: 'space-between', marginTop: 4}}>
        <span style={{fontSize: 9.5, color: cc.textMuted, fontWeight: 700}}>{days[0]?.date.slice(5)}</span>
        <span style={{fontSize: 9.5, color: cc.textMuted, fontWeight: 700}}>{days[Math.floor(n / 2)]?.date.slice(5)}</span>
        <span style={{fontSize: 9.5, color: cc.textMuted, fontWeight: 700}}>{days[n - 1]?.date.slice(5)}</span>
      </div>
      <div style={{display: 'flex', gap: 14, marginTop: 8}}>
        <span style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: cc.textMuted}}><span style={{width: 8, height: 8, borderRadius: 2, backgroundColor: cc.accentBlue, display: 'inline-block'}} />Parking Tasks</span>
        <span style={{display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: cc.textMuted}}><span style={{width: 8, height: 8, borderRadius: 2, backgroundColor: cc.accentGreen, display: 'inline-block'}} />Visitors</span>
      </div>
    </div>
  );
}

// ── Hourly Demand Heatmap ──────────────────────────────────────────────────

function heatColor(frac: number): string {
  if (frac <= 0) return '#171E30';
  if (frac < 0.33) return '#4C3A9E';
  if (frac < 0.66) return '#B45BC7';
  if (frac < 0.85) return '#E8703A';
  return '#F0B23A';
}

export function Heatmap({heatmap}: {heatmap: DemandHeatmap}) {
  const [hover, setHover] = useState<{row: number; col: number} | null>(null);
  return (
    <div>
      <div style={{display: 'grid', gridTemplateColumns: '26px repeat(24, 1fr)', gap: 2}}>
        <div />
        {Array.from({length: 24}, (_, h) => (
          <span key={h} style={{fontSize: 7.5, color: cc.textMuted, textAlign: 'center'}}>{h % 2 === 0 ? h : ''}</span>
        ))}
        {heatmap.weekdayLabels.map((wd, row) => (
          <React.Fragment key={wd}>
            <span style={{fontSize: 9, color: cc.textMuted, fontWeight: 700, display: 'flex', alignItems: 'center'}}>{wd.slice(0, 3)}</span>
            {heatmap.grid[row].map((cell, col) => (
              <div key={col}
                onMouseEnter={() => setHover({row, col})}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(hover?.row === row && hover?.col === col ? null : {row, col})}
                style={{aspectRatio: '1', borderRadius: 2, backgroundColor: heatColor(cell.tasks / heatmap.maxTasks), cursor: 'pointer'}}
              />
            ))}
          </React.Fragment>
        ))}
      </div>
      <div style={{marginTop: 10, fontSize: 10.5, color: cc.textSecondary, minHeight: 14}}>
        {hover ? (
          <span><b style={{color: cc.textPrimary}}>{heatmap.weekdayLabels[hover.row]} {hover.col}:00</b> — Tasks: {heatmap.grid[hover.row][hover.col].tasks}, Visitors: {heatmap.grid[hover.row][hover.col].visitors}</span>
        ) : (
          <span style={{color: cc.textMuted}}>Low <span style={{background: 'linear-gradient(90deg,#4C3A9E,#B45BC7,#E8703A,#F0B23A)', display: 'inline-block', width: 40, height: 6, borderRadius: 3, verticalAlign: 'middle', margin: '0 6px'}} /> High</span>
        )}
      </div>
    </div>
  );
}

// ── Slot utilization (live snapshot) ───────────────────────────────────────

export function SlotUtilizationPanel({liveSlots, onViewAll}: {liveSlots: ParkingSlot[]; onViewAll: () => void}) {
  const total = liveSlots.length;
  const occupied = liveSlots.filter(s => s.status === 'occupied').length;
  const reserved = liveSlots.filter(s => s.status === 'reserved').length;
  const available = total - occupied - reserved;
  const pct = total ? Math.round((occupied / total) * 100) : 0;
  return (
    <Panel title="Slot Utilization">
      {total === 0 ? <div style={ccEmptyText}>No parking slots configured yet.</div> : (
        <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
          <Donut parts={[{value: occupied, color: cc.danger}, {value: available, color: cc.success}, {value: reserved, color: cc.accentAmber}]} centerLabel={`${pct}%`} centerSub="Occupied" />
          <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0}}>
            <LegendRow color={cc.danger} label="Occupied" value={occupied} />
            <LegendRow color={cc.success} label="Available" value={available} />
            <LegendRow color={cc.accentAmber} label="Reserved" value={reserved} />
          </div>
        </div>
      )}
      <PressableScale onClick={onViewAll} style={{marginTop: 14, width: '100%', height: 34, borderRadius: 9, backgroundColor: cc.accentBlue + '1c', border: `1px solid ${cc.accentBlue}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6}}>
        <span style={{fontSize: 11.5, fontWeight: 800, color: cc.accentBlue}}>View All Slots</span>
        <Icon name="arrowRight" size={12} color={cc.accentBlue} />
      </PressableScale>
    </Panel>
  );
}

// ── AI Insights ─────────────────────────────────────────────────────────

export function AiInsightsPanel({insights, onNavigate}: {insights: InsightCard[]; onNavigate: () => void}) {
  return (
    <Panel title="AI Insights" right={<button onClick={onNavigate} style={linkBtnStyle}>View All</button>} style={{flex: 1}}>
      {insights.length === 0 ? <div style={ccEmptyText}>Nothing has crossed a meaningful threshold this period.</div> : (
        <div style={{display: 'flex', flexDirection: 'column', maxHeight: '100%', overflowY: 'auto'}}>
          {insights.slice(0, 6).map(i => (
            <PressableScale key={i.id} onClick={onNavigate} style={{display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 2px', borderBottom: `1px solid ${cc.divider}`, textAlign: 'left'}}>
              <div style={{width: 26, height: 26, borderRadius: 8, backgroundColor: (i.severity === 'warn' ? cc.warning : cc.accentCyan) + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <Icon name={i.severity === 'warn' ? 'alert' : 'info'} size={13} color={i.severity === 'warn' ? cc.warning : cc.accentCyan} />
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 11.5, fontWeight: 800, color: i.severity === 'warn' ? cc.warning : cc.accentCyan}}>{i.title}</div>
                <div style={{fontSize: 10.5, color: cc.textSecondary, marginTop: 2, lineHeight: '14px'}}>{i.observation}</div>
              </div>
              <Icon name="chevronRight" size={12} color={cc.textMuted} />
            </PressableScale>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Realtime Operations (live) ────────────────────────────────────────────

export function RealtimeOperationsPanel({tasks}: {tasks: ParkingTask[]}) {
  const events = useMemo(() => {
    const withTime = tasks.map(t => {
      const ts = t.completedAt ?? t.keyCollectedAt ?? t.assignedAt ?? t.requestedAt;
      if (!ts) return null;
      const label =
        t.status === 'completed' ? (t.type === 'park' ? `Parked at ${t.slotId ?? '—'}` : `Retrieved${t.slotId ? ` from ${t.slotId}` : ''}`)
        : t.status === 'assigned' ? `Slot assigned${t.slotId ? ` ${t.slotId}` : ''}`
        : t.status === 'key_collected' ? 'Key collected'
        : t.status === 'in_transit' ? 'In transit'
        : null;
      if (!label) return null;
      return {id: t.id, carNumber: t.carNumber, label, ts};
    }).filter((e): e is {id: number; carNumber: string; label: string; ts: number} => e != null);
    return withTime.sort((a, b) => b.ts - a.ts).slice(0, 6);
  }, [tasks]);

  return (
    <Panel title="Realtime Operations" right={<span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: cc.success, display: 'inline-block'}} />}>
      {events.length === 0 ? <div style={ccEmptyText}>No active operations right now.</div> : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
          {events.map(e => (
            <div key={e.id} style={{display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11}}>
              <div style={{flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                <span style={{fontWeight: 800, color: cc.textPrimary}}>{e.carNumber}</span>
                <span style={{color: cc.textSecondary}}> {e.label}</span>
              </div>
              <span style={{color: cc.textMuted, flexShrink: 0}}>{agoLabel(e.ts)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Parking Slot Map (live + period classification) ───────────────────────

const SLOT_STATE_COLORS = {available: '#22C55E', occupied: '#EF4444', underutilized: '#E8C23A', overloaded: '#F0703A', reserved: '#F59E0B'};

export function ParkingSlotMapPanel({liveSlots, classById, onOpenSlots}: {liveSlots: ParkingSlot[]; classById: Map<string, SlotClassification>; onOpenSlots: () => void}) {
  const [selected, setSelected] = useState<string | null>(null);
  const byBlock = useMemo(() => {
    const m = new Map<string, ParkingSlot[]>();
    for (const s of liveSlots) { const l = m.get(s.block) ?? []; l.push(s); m.set(s.block, l); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, list]) => ({name, slots: list.slice().sort((a, b) => a.number - b.number)}));
  }, [liveSlots]);

  function stateOf(s: ParkingSlot): {label: string; color: string} {
    if (s.status === 'occupied') return {label: 'Occupied', color: SLOT_STATE_COLORS.occupied};
    if (s.status === 'reserved') return {label: 'Reserved', color: SLOT_STATE_COLORS.reserved};
    const cls = classById.get(s.id);
    if (cls === 'OVERLOADED') return {label: 'Overloaded', color: SLOT_STATE_COLORS.overloaded};
    if (cls === 'UNDERUTILIZED') return {label: 'Underutilized', color: SLOT_STATE_COLORS.underutilized};
    return {label: 'Available', color: SLOT_STATE_COLORS.available};
  }

  const sel = selected ? liveSlots.find(s => s.id === selected) ?? null : null;
  const selUsage = sel ? classById.get(sel.id) : undefined;

  if (liveSlots.length === 0) return <Panel title="Parking Slot Map"><div style={ccEmptyText}>No parking slots configured yet.</div></Panel>;

  return (
    <Panel title="Parking Slot Map" right={<button onClick={onOpenSlots} style={linkBtnStyle}>All Areas →</button>}>
      <div style={{display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 210, overflowY: 'auto'}}>
        {byBlock.map(b => (
          <div key={b.name}>
            <div style={{fontSize: 10, fontWeight: 800, color: cc.textMuted, marginBottom: 6}}>{b.name} Block</div>
            <div style={{display: 'flex', flexWrap: 'wrap', gap: 5}}>
              {b.slots.map(s => {
                const st = stateOf(s);
                const on = s.id === selected;
                return (
                  <button key={s.id} onClick={() => setSelected(on ? null : s.id)} title={s.id}
                    style={{
                      width: 26, height: 24, borderRadius: 5, border: on ? '1.5px solid #fff' : 'none',
                      backgroundColor: st.color, cursor: 'pointer', opacity: on ? 1 : 0.85,
                    }} />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {sel && (
        <div style={{position: 'absolute', bottom: 46, left: 16, right: 16, backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`, borderRadius: 10, padding: 12, zIndex: 5}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: 12.5, fontWeight: 900, color: cc.textPrimary}}>{sel.id}</span>
            <button onClick={() => setSelected(null)} style={{background: 'none', border: 'none', cursor: 'pointer', padding: 0}}><Icon name="close" size={13} color={cc.textMuted} /></button>
          </div>
          <div style={{fontSize: 11, color: stateOf(sel).color, fontWeight: 800, marginTop: 4}}>{stateOf(sel).label}</div>
          {(selUsage === 'OVERLOADED' || selUsage === 'UNDERUTILIZED') && (
            <div style={{fontSize: 10.5, color: cc.textMuted, marginTop: 2}}>{selUsage === 'OVERLOADED' ? 'Well above average use this period' : 'Well below average use this period'}</div>
          )}
          <button onClick={onOpenSlots} style={{...linkBtnStyle, marginTop: 8, fontSize: 11}}>Click to view details →</button>
        </div>
      )}

      <div style={{display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${cc.divider}`}}>
        <LegendDot color={SLOT_STATE_COLORS.available} label="Available" />
        <LegendDot color={SLOT_STATE_COLORS.occupied} label="Occupied" />
        <LegendDot color={SLOT_STATE_COLORS.underutilized} label="Underutilized" />
        <LegendDot color={SLOT_STATE_COLORS.overloaded} label="Overloaded" />
        <LegendDot color={SLOT_STATE_COLORS.reserved} label="Reserved" />
      </div>
    </Panel>
  );
}

// ── Task funnel (volume) ──────────────────────────────────────────────────

const STAGE_COLORS = [cc.accentBlue, cc.accentIndigo, cc.accentAmber, cc.accentGreen];

export function TaskFunnelPanel({funnelVolume}: {funnelVolume: TaskFunnelVolume}) {
  const [tab, setTab] = useState<'park' | 'retrieve'>('park');
  const data = funnelVolume[tab];
  const maxCount = Math.max(1, ...data.stages.map(s => s.count));
  return (
    <Panel title="Task Funnel" right={
      <div style={{display: 'flex', gap: 4}}>
        {(['park', 'retrieve'] as const).map(k => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontSize: 10, fontWeight: 800, padding: '4px 9px', borderRadius: 999, border: 'none', cursor: 'pointer',
            backgroundColor: tab === k ? cc.accentBlue : cc.cardAlt, color: tab === k ? '#fff' : cc.textSecondary,
          }}>{k === 'park' ? 'Park' : 'Retrieve'}</button>
        ))}
      </div>
    }>
      {data.sampleSize === 0 ? <div style={ccEmptyText}>No {tab} tasks in this period.</div> : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
          {data.stages.map((s, i) => (
            <div key={s.key}>
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 3}}>
                <span style={{fontSize: 10.5, fontWeight: 700, color: cc.textSecondary}}>{s.label}</span>
                <span style={{fontSize: 10.5, fontWeight: 800, color: cc.textPrimary}}>
                  {s.count.toLocaleString()}{s.avgMinutesFromCreation != null && s.avgMinutesFromCreation > 0 ? ` · ${Math.round(s.avgMinutesFromCreation)}m` : ''}
                </span>
              </div>
              <div style={{height: 7, borderRadius: 4, backgroundColor: cc.divider, overflow: 'hidden'}}>
                <div style={{height: 7, borderRadius: 4, width: `${(s.count / maxCount) * 100}%`, backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length]}} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ── Top Drivers ────────────────────────────────────────────────────────────

export function TopDriversPanel({drivers, onViewAll}: {drivers: DriverAnalytics[]; onViewAll: () => void}) {
  const active = drivers.filter(d => d.totalCompleted > 0).slice(0, 5);
  const maxV = Math.max(1, ...active.map(d => d.totalCompleted));
  return (
    <Panel title="Top Drivers" right={<button onClick={onViewAll} style={linkBtnStyle}>By Tasks</button>}>
      {active.length === 0 ? <div style={ccEmptyText}>No completed jobs yet.</div> : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
          {active.map((d, i) => (
            <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <span style={{fontSize: 10, fontWeight: 800, color: cc.textMuted, width: 18, flexShrink: 0}}>#{i + 1}</span>
              <span style={{fontSize: 10.5, fontWeight: 700, color: cc.textPrimary, width: 76, flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>{d.name}</span>
              <div style={{flex: 1, height: 7, borderRadius: 4, backgroundColor: cc.divider, overflow: 'hidden'}}>
                <div style={{height: 7, borderRadius: 4, width: `${(d.totalCompleted / maxV) * 100}%`, backgroundColor: cc.accentCyan}} />
              </div>
              <span style={{fontSize: 10.5, fontWeight: 800, color: cc.textPrimary, width: 28, textAlign: 'right', flexShrink: 0}}>{d.totalCompleted}</span>
            </div>
          ))}
        </div>
      )}
      <PressableScale onClick={onViewAll} style={{marginTop: 14, width: '100%', height: 32, borderRadius: 9, backgroundColor: cc.accentBlue + '18', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{fontSize: 11, fontWeight: 800, color: cc.accentBlue}}>View All Drivers →</span>
      </PressableScale>
    </Panel>
  );
}

// ── Visitor Analytics / Types ──────────────────────────────────────────────

export function VisitorAnalyticsPanel({dailyCounts}: {dailyCounts: {date: string; count: number}[]}) {
  const maxV = Math.max(1, ...dailyCounts.map(d => d.count));
  return (
    <Panel title="Visitor Analytics">
      {dailyCounts.length === 0 ? <div style={ccEmptyText}>No visitors in this period.</div> : (
        <div style={{display: 'flex', alignItems: 'flex-end', height: 120, gap: 2}}>
          {dailyCounts.map(d => (
            <div key={d.date} title={`${d.date}: ${d.count}`} style={{flex: 1, height: `${(d.count / maxV) * 100}%`, minHeight: 2, backgroundColor: cc.accentPurple, borderRadius: 2}} />
          ))}
        </div>
      )}
    </Panel>
  );
}

const VEHICLE_TYPE_COLORS: Record<string, string> = {car: cc.accentBlue, bike: cc.accentAmber};

export function VisitorTypesPanel({byVehicleType, total, note}: {byVehicleType: Record<string, number>; total: number; note: string}) {
  const entries = Object.entries(byVehicleType);
  return (
    <Panel title="Visitor Types">
      {total === 0 ? <div style={ccEmptyText}>No visitors in this period.</div> : (
        <>
          <div style={{display: 'flex', alignItems: 'center', gap: 14}}>
            <Donut parts={entries.map(([k, v]) => ({value: v, color: VEHICLE_TYPE_COLORS[k] ?? cc.accentPurple}))} centerLabel={String(total)} centerSub="Visitors" size={92} />
            <div style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0}}>
              {entries.map(([k, v]) => (
                <LegendRow key={k} color={VEHICLE_TYPE_COLORS[k] ?? cc.accentPurple} label={k[0].toUpperCase() + k.slice(1)} value={v} pct={Math.round((v / total) * 100)} />
              ))}
            </div>
          </div>
          <div style={{fontSize: 9.5, color: cc.textMuted, marginTop: 10, lineHeight: '13px'}}>{note}</div>
        </>
      )}
    </Panel>
  );
}

// ── Anomaly Radar ──────────────────────────────────────────────────────────

export function AnomalyRadarPanel({categories}: {categories: AnomalyRadarCategory[]}) {
  return (
    <Panel title="Anomaly Radar (Last 14 Days)">
      <div style={{display: 'flex', flexDirection: 'column', gap: 9}}>
        {categories.map(c => (
          <div key={c.key} style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: c.anomalyCount > 0 ? cc.danger : cc.textMuted, flexShrink: 0}} />
            <span style={{flex: 1, fontSize: 10.5, fontWeight: 700, color: cc.textSecondary, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis'}}>{c.label}</span>
            <MiniSparkline series={c.series} color={c.anomalyCount > 0 ? cc.danger : cc.accentCyan} />
            <span style={{fontSize: 10.5, fontWeight: 800, color: cc.textPrimary, width: 14, textAlign: 'right', flexShrink: 0}}>{c.anomalyCount}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// ── Ask Your Parking System ────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = ['Why was parking busy yesterday?', 'Which slots are underutilized?', 'Who is overloaded?', 'What changed this week?', 'Where are the bottlenecks?'];

function answerQuestion(q: string, bundle: CommandCenterBundle): string {
  const s = q.toLowerCase();
  if (s.includes('busy') || s.includes('peak')) {
    if (bundle.overview.busiestHour == null) return 'Not enough completed jobs yet to identify a peak hour.';
    return `Demand peaks around ${hourLabel(bundle.overview.busiestHour)}, with ${bundle.overview.hourlyDistribution[bundle.overview.busiestHour]} jobs completed in that hour this period.`;
  }
  if (s.includes('underutilized')) {
    const examples = bundle.slots.slots.filter(x => x.classification === 'UNDERUTILIZED').slice(0, 5).map(x => x.id);
    return bundle.slots.underutilizedCount === 0 ? 'No slots are currently underutilized.' : `${bundle.slots.underutilizedCount} of ${bundle.slots.totalSlots} slots are underutilized this period: ${examples.join(', ')}.`;
  }
  if (s.includes('overload') || s.includes('driver')) {
    const active = bundle.overview.drivers.filter(d => d.totalCompleted > 0);
    if (!active.length) return 'No completed jobs yet to assess driver load.';
    const total = active.reduce((a, d) => a + d.totalCompleted, 0);
    const top = active[0];
    return `${top.name} is handling the most jobs: ${top.totalCompleted} of ${total} completed this period (${Math.round((top.totalCompleted / total) * 100)}%).`;
  }
  if (s.includes('changed') || s.includes('week')) {
    const t = bundle.kpiComparison.tasks;
    if (t.pctChange == null) return 'No prior period to compare against.';
    return `Completed tasks are ${t.pctChange >= 0 ? 'up' : 'down'} ${Math.abs(t.pctChange)}% vs the previous period (${t.previous} → ${t.current}).`;
  }
  if (s.includes('bottleneck')) {
    const b = bundle.taskFunnel.retrieve.bottleneck ?? bundle.taskFunnel.park.bottleneck;
    if (!b) return 'No stage currently stands out as a bottleneck.';
    return `The slowest stage is "${b.label}", averaging ${Math.round(b.avgMinutes ?? 0)} minutes across ${b.sampleSize} jobs.`;
  }
  return 'I can answer questions about peak hours, underutilized slots, driver workload, week-over-week change, and bottlenecks — try one of the suggestions below.';
}

export function AskParkingSystemPanel({bundle}: {bundle: CommandCenterBundle}) {
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<string | null>(null);
  const ask = (question: string) => { setQ(question); setAnswer(answerQuestion(question, bundle)); };
  return (
    <Panel title="Ask Your Parking System">
      <div style={{display: 'flex', gap: 8, marginBottom: 10}}>
        <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') ask(q); }}
          placeholder="e.g. Why was parking busy yesterday?"
          style={{flex: 1, height: 32, borderRadius: 9, border: `1px solid ${cc.border}`, backgroundColor: cc.cardAlt, color: cc.textPrimary, fontSize: 11, padding: '0 10px', outline: 'none'}} />
        <PressableScale onClick={() => ask(q)} style={{width: 32, height: 32, borderRadius: 9, backgroundColor: cc.accentBlue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
          <Icon name="arrowRight" size={14} color="#fff" />
        </PressableScale>
      </div>
      {answer && <div style={{backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`, borderRadius: 9, padding: 10, fontSize: 11, color: cc.textSecondary, marginBottom: 10, lineHeight: '15px'}}>{answer}</div>}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 6}}>
        {SUGGESTED_QUESTIONS.map(sq => (
          <button key={sq} onClick={() => ask(sq)} style={{fontSize: 10, fontWeight: 700, padding: '5px 9px', borderRadius: 999, border: `1px solid ${cc.border}`, backgroundColor: cc.cardAlt, color: cc.textSecondary, cursor: 'pointer'}}>{sq}</button>
        ))}
      </div>
    </Panel>
  );
}
