import React, {useMemo, useState} from 'react';
import {Icon, IconName} from '../../../components/Icon';
import {PressableScale} from '../../../components/PressableScale';
import {ParkingSlot} from '../../../context/AppStateContext';
import {AnalyticsPeriod, SlotClassification, TaskFunnelVolume, DriverAnalytics, DemandHeatmap} from '../../../services/api';
import {useCc, ccCard, ccPanelTitle, ccEmptyText, CcPalette} from './ccTheme';

/*
 * Every presentational building block of the "command center" dashboard —
 * shared between the desktop shell (AdminCommandCenter.tsx, a wide grid)
 * and the mobile version (AdminDashboardMobile.tsx, the same panels
 * stacked in one column). One definition of each chart/card so the two
 * layouts can never drift into showing different numbers for the same
 * thing — only the ARRANGEMENT differs per screen size, never the content
 * or the data source. Every component reads the active palette via
 * useCc() (see ccTheme.ts) so the light/dark toggle reaches all of them
 * from one place.
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

// ── Shared small primitives ────────────────────────────────────────────────

export function Panel({title, right, children, style}: {title: string; right?: React.ReactNode; children: React.ReactNode; style?: React.CSSProperties}) {
  const cc = useCc();
  return (
    <div style={{...ccCard(cc), padding: 16, display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative', ...style}}>
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0, gap: 8}}>
        <span style={ccPanelTitle(cc)}>{title}</span>
        {right}
      </div>
      <div style={{flex: 1, minHeight: 0}}>{children}</div>
    </div>
  );
}

function linkBtnStyle(cc: CcPalette): React.CSSProperties {
  return {background: 'none', border: 'none', color: cc.accentBlue, fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 0};
}

export function LegendRow({color, label, value, pct}: {color: string; label: string; value: number; pct?: number}) {
  const cc = useCc();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <span style={{width: 9, height: 9, borderRadius: 3, backgroundColor: color, flexShrink: 0}} />
      <span style={{flex: 1, fontSize: 11, color: cc.textSecondary}}>{label}</span>
      <span style={{fontSize: 11, fontWeight: 800, color: cc.textPrimary}}>{value}{pct != null ? ` (${pct}%)` : ''}</span>
    </div>
  );
}

export function LegendDot({color, label}: {color: string; label: string}) {
  const cc = useCc();
  return (
    <span style={{display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: cc.textMuted, fontWeight: 700}}>
      <span style={{width: 8, height: 8, borderRadius: 2, backgroundColor: color, display: 'inline-block'}} />{label}
    </span>
  );
}

export function Donut({parts, size = 100, stroke = 13, centerLabel, centerSub}: {
  parts: {value: number; color: string}[]; size?: number; stroke?: number; centerLabel: string; centerSub?: string;
}) {
  const cc = useCc();
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

// ── KPI row ─────────────────────────────────────────────────────────────

export function KpiCard({icon, variant, value, label, deltaPct, onClick}: {
  icon: IconName; variant: {bg: string; icon: string; valueText: string; labelText: string}; value: string; label: string; deltaPct: number | null; onClick?: () => void;
}) {
  const cc = useCc();
  return (
    <PressableScale onClick={onClick} style={{flex: 1, borderRadius: 14, backgroundColor: variant.bg, padding: 14, textAlign: 'left', display: 'block', minWidth: 0, cursor: onClick ? 'pointer' : 'default'}}>
      <Icon name={icon} size={17} color={variant.icon} />
      <div style={{fontSize: 22, fontWeight: 900, color: variant.valueText, marginTop: 8, letterSpacing: -0.5}}>{value}</div>
      <div style={{fontSize: 11, fontWeight: 700, color: variant.labelText, marginTop: 1}}>{label}</div>
      {deltaPct != null && (
        <div style={{display: 'flex', alignItems: 'center', gap: 4, marginTop: 8}}>
          <Icon name={deltaPct >= 0 ? 'arrowUp' : 'arrowDown'} size={9} color={deltaPct >= 0 ? cc.deltaUp : cc.deltaDown} />
          <span style={{fontSize: 10.5, fontWeight: 800, color: deltaPct >= 0 ? cc.deltaUp : cc.deltaDown}}>{Math.abs(deltaPct)}%</span>
          <span style={{fontSize: 9.5, color: variant.labelText}}>vs last period</span>
        </div>
      )}
    </PressableScale>
  );
}

export function SlotsKpiCard({occPct, occupied, available, total, onClick}: {occPct: number; occupied: number; available: number; total: number; onClick: () => void}) {
  const cc = useCc();
  const v = cc.kpi.slots;
  return (
    <PressableScale onClick={onClick} style={{flex: 1, borderRadius: 14, backgroundColor: v.bg, padding: 14, display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left'}}>
      <div style={{flex: 1, minWidth: 0}}>
        <Icon name="parking" size={17} color={v.icon} />
        <div style={{fontSize: 20, fontWeight: 900, color: v.valueText, marginTop: 6}}>{total}</div>
        <div style={{fontSize: 10.5, fontWeight: 700, color: v.labelText}}>Parking Slots</div>
        <div style={{fontSize: 9, color: v.labelText, marginTop: 4}}>{occupied} Occupied · {available} Available</div>
      </div>
      <Donut parts={[{value: occupied, color: cc.danger}, {value: available, color: cc.success}]} size={52} stroke={7} centerLabel={`${occPct}%`} />
    </PressableScale>
  );
}

// ── Parking Activity Trends ────────────────────────────────────────────────

export function TrendChart({days}: {days: {date: string; tasks: number; visitors: number}[]}) {
  const cc = useCc();
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

  if (n === 0) return <div style={ccEmptyText(cc)}>No activity recorded in this period.</div>;

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

function heatColor(frac: number, mode: 'light' | 'dark'): string {
  if (frac <= 0) return mode === 'dark' ? '#171E30' : '#EDEFF6';
  if (frac < 0.33) return '#4C3A9E';
  if (frac < 0.66) return '#B45BC7';
  if (frac < 0.85) return '#E8703A';
  return '#F0B23A';
}

export function Heatmap({heatmap}: {heatmap: DemandHeatmap}) {
  const cc = useCc();
  const mode: 'light' | 'dark' = cc.bg === '#0A0E1A' ? 'dark' : 'light';
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
                style={{aspectRatio: '1', borderRadius: 2, backgroundColor: heatColor(cell.tasks / heatmap.maxTasks, mode), cursor: 'pointer'}}
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
  const cc = useCc();
  const total = liveSlots.length;
  const occupied = liveSlots.filter(s => s.status === 'occupied').length;
  const reserved = liveSlots.filter(s => s.status === 'reserved').length;
  const available = total - occupied - reserved;
  const pct = total ? Math.round((occupied / total) * 100) : 0;
  return (
    <Panel title="Slot Utilization">
      {total === 0 ? <div style={ccEmptyText(cc)}>No parking slots configured yet.</div> : (
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

// ── Parking Slot Map (live + period classification) ───────────────────────

const SLOT_STATE_COLORS = {available: '#22C55E', occupied: '#EF4444', underutilized: '#E8C23A', overloaded: '#F0703A', reserved: '#F59E0B'};

export function ParkingSlotMapPanel({liveSlots, classById, onOpenSlots}: {liveSlots: ParkingSlot[]; classById: Map<string, SlotClassification>; onOpenSlots: () => void}) {
  const cc = useCc();
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

  if (liveSlots.length === 0) return <Panel title="Parking Slot Map"><div style={ccEmptyText(cc)}>No parking slots configured yet.</div></Panel>;

  return (
    <Panel title="Parking Slot Map" right={<button onClick={onOpenSlots} style={linkBtnStyle(cc)}>All Areas →</button>}>
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
                      width: 26, height: 24, borderRadius: 5, border: on ? `1.5px solid ${cc.textPrimary}` : 'none',
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
          <button onClick={onOpenSlots} style={{...linkBtnStyle(cc), marginTop: 8, fontSize: 11}}>Click to view details →</button>
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

export function TaskFunnelPanel({funnelVolume}: {funnelVolume: TaskFunnelVolume}) {
  const cc = useCc();
  const stageColors = [cc.accentBlue, cc.accentIndigo, cc.accentAmber, cc.accentGreen];
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
      {data.sampleSize === 0 ? <div style={ccEmptyText(cc)}>No {tab} tasks in this period.</div> : (
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
                <div style={{height: 7, borderRadius: 4, width: `${(s.count / maxCount) * 100}%`, backgroundColor: stageColors[i % stageColors.length]}} />
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
  const cc = useCc();
  const active = drivers.filter(d => d.totalCompleted > 0).slice(0, 5);
  const maxV = Math.max(1, ...active.map(d => d.totalCompleted));
  return (
    <Panel title="Top Drivers" right={<button onClick={onViewAll} style={linkBtnStyle(cc)}>By Tasks</button>}>
      {active.length === 0 ? <div style={ccEmptyText(cc)}>No completed jobs yet.</div> : (
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
