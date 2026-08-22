import React, {useEffect, useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAppState} from '../../context/AppStateContext';
import {Badge} from '../../components/Badge';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';

// The Admin console's Dashboard tab — one responsive layout (see
// AdminDesktopShell for the sidebar/top bar around it, which carries the
// page title/date so this screen doesn't repeat its own header).
type ActivityType = 'success' | 'info' | 'primary' | 'warning';

export function AdminDashboardScreen() {
  const {colors, isDark} = useTheme();
  const {tasks, drivers, slots, fetchTaskHistory} = useAppState();

  // The live `tasks` array is bounded to "at most one row per doctor" now,
  // so a completed job disappears from it the moment that doctor's next car
  // comes in — this feed needs the real history to stay populated over time.
  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => {
    fetchTaskHistory().then(setHistory).catch(() => {});
  }, [fetchTaskHistory, tasks.length]);

  const liveTasks = tasks.filter(t => t.status !== 'completed');
  const busyDrivers = drivers.filter(d => d.status === 'busy').length;
  const parkedCars = slots.filter(s => s.status === 'occupied').length;
  const pendingRetrieval = tasks.filter(t => t.type === 'retrieve' && t.status !== 'completed').length;

  const blockStats = React.useMemo(() => {
    const byBlock = new Map<string, {total: number; used: number}>();
    for (const sl of slots) {
      const entry = byBlock.get(sl.block) ?? {total: 0, used: 0};
      entry.total += 1;
      if (sl.status === 'occupied') entry.used += 1;
      byBlock.set(sl.block, entry);
    }
    return [...byBlock.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, v]) => ({name: `Block ${name}`, ...v}));
  }, [slots]);

  const totalSlots = slots.length;
  const usedSlots = parkedCars;
  const fillPct = totalSlots ? Math.round((usedSlots / totalSlots) * 100) : 0;
  const fillColor = (pct: number) => (pct > 80 ? colors.error : pct > 60 ? colors.warning : colors.primary);

  const actColor: Record<ActivityType, string> = {
    success: colors.success, info: colors.info, primary: colors.primary, warning: colors.warning,
  };

  const liveActivity = history.slice(0, 5).map(t => ({
    icon: (t.status === 'completed' ? 'check' : t.type === 'park' ? 'car' : 'refresh') as IconName,
    text: `${t.carNumber} — ${t.type === 'park' ? 'parked' : 'retrieved'}${t.slotId ? ` at ${t.slotId}` : ''}`,
    sub: `${t.doctorName} · ${t.driverName ?? 'Unassigned'}`,
    type: (t.status === 'completed' ? 'success' : t.type === 'park' ? 'primary' : 'info') as ActivityType,
  }));

  const sec: React.CSSProperties = {fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.xs, color: colors.textMuted};
  const sheet: React.CSSProperties = {borderRadius: radius.xl, border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.card, marginBottom: spacing.xl, boxShadow: `0 2px 8px ${colors.shadow}`};
  const emptyTxt: React.CSSProperties = {fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, padding: spacing.xl, textAlign: 'center', color: colors.textMuted};
  const trackBg = isDark ? '#2A2A2A' : '#EBEBEB';

  const statDefs = [
    {n: String(parkedCars), l: 'Vehicles Parked', c: colors.primary, ic: 'parking' as IconName},
    {n: String(busyDrivers), l: 'Drivers On Duty', c: colors.info, ic: 'people' as IconName},
    {n: String(liveTasks.length), l: 'Tasks Active', c: colors.warning, ic: 'bolt' as IconName},
    {n: String(pendingRetrieval), l: 'Retrieval Pending', c: colors.success, ic: 'refresh' as IconName},
  ];

  const statCard = (m: typeof statDefs[number]) => (
    <div key={m.l} style={{borderRadius: radius.xl, border: `1px solid ${colors.border}`, padding: '18px 16px', backgroundColor: colors.card, boxShadow: `0 2px 8px ${colors.shadow}`}}>
      <div style={{width: 40, height: 40, borderRadius: radius.md, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md, backgroundColor: m.c + '18'}}>
        <Icon name={m.ic} size={19} color={m.c} />
      </div>
      <div style={{fontSize: typography.sizes['3xl'], fontWeight: typography.weights.black, letterSpacing: -1, color: colors.textPrimary, lineHeight: 1.1}}>{m.n}</div>
      <div style={{fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 4, color: colors.textMuted}}>{m.l}</div>
    </div>
  );

  // ── Shared card bodies — identical data/markup on both layouts, only the
  // surrounding grid arrangement differs below. ──────────────────────────
  const occupancyBody = (
    <div style={sheet}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '16px 16px 10px'}}>
        <div>
          <div style={{fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2, color: colors.textMuted}}>OVERALL</div>
          <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, color: colors.textPrimary}}>
            {usedSlots}<span style={{fontSize: typography.sizes.lg, color: colors.textMuted}}>/{totalSlots}</span>
          </div>
        </div>
        <div style={{textAlign: 'right'}}>
          <div style={{fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 2, color: colors.textMuted}}>FULL</div>
          <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, color: fillColor(fillPct)}}>{fillPct}%</div>
        </div>
      </div>
      <div style={{height: 10, margin: '0 16px 16px', borderRadius: 5, overflow: 'hidden', backgroundColor: trackBg}}>
        <div style={{height: '100%', borderRadius: 5, width: `${fillPct}%`, backgroundColor: fillColor(fillPct), transition: 'width 0.4s ease'}} />
      </div>
      <div style={{height: 1, margin: `0 16px ${spacing.md}px`, backgroundColor: colors.divider}} />
      {blockStats.length === 0 ? (
        <div style={emptyTxt}>No parking slots configured yet</div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: spacing.md}}>
          {blockStats.map(b => {
            const pct = b.total ? Math.round((b.used / b.total) * 100) : 0;
            const bc = fillColor(pct);
            return (
              <div key={b.name} style={{display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px'}}>
                <span style={{width: 58, fontSize: 12, fontWeight: 600, color: colors.textSecondary}}>{b.name}</span>
                <div style={{flex: 1, height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: trackBg}}>
                  <div style={{height: '100%', borderRadius: 3, width: `${pct}%`, backgroundColor: bc, transition: 'width 0.4s ease'}} />
                </div>
                <span style={{width: 40, fontSize: 11, fontWeight: 700, textAlign: 'right', color: colors.textPrimary, fontVariantNumeric: 'tabular-nums'}}>{b.used}/{b.total}</span>
                <span style={{width: 32, fontSize: 10, fontWeight: 700, textAlign: 'right', color: bc}}>{pct}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const driversBody = (
    <div style={sheet}>
      {drivers.length === 0 ? (
        <div style={emptyTxt}>No drivers added yet</div>
      ) : drivers.map((d, i) => {
        const initials = d.name.split(' ').map(w => w[0]).join('').slice(0, 2);
        const busy = d.status === 'busy';
        return (
          <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '12px 16px', borderBottom: i === drivers.length - 1 ? 'none' : `1px solid ${colors.divider}`}}>
            <div style={{width: 36, height: 36, borderRadius: radius.sm, border: `1px solid ${colors.primary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.primary + '1A'}}>
              <span style={{fontSize: 11, fontWeight: 900, color: colors.primary}}>{initials}</span>
            </div>
            <div style={{flex: 1}}>
              <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>{d.name}</div>
              <div style={{fontSize: 11, marginTop: 2, color: colors.textSecondary}}>Driver</div>
            </div>
            <Badge label={d.status === 'off' ? 'Off Duty' : busy ? 'On Task' : 'Free'} variant={d.status === 'off' ? 'muted' : busy ? 'warning' : 'success'} dot />
          </div>
        );
      })}
    </div>
  );

  const activityBody = (
    <div style={{...sheet, marginBottom: 4}}>
      {liveActivity.length === 0 ? (
        <div style={emptyTxt}>No activity yet today</div>
      ) : liveActivity.map((a, i) => (
        <div key={i} style={{display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: i === liveActivity.length - 1 ? 'none' : `1px solid ${colors.divider}`, gap: 10}}>
          <span style={{width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0, backgroundColor: actColor[a.type], marginLeft: 16}} />
          <div style={{
            width: 30, height: 30, borderRadius: radius.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            backgroundColor: actColor[a.type] + '15',
          }}>
            <Icon name={a.icon} size={15} color={actColor[a.type]} />
          </div>
          <div style={{flex: 1, paddingRight: 16}}>
            <div style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>{a.text}</div>
            <div style={{fontSize: 11, marginTop: 2, color: colors.textMuted}}>{a.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="admin-content-pad">
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: spacing.base, marginBottom: spacing.xl}}>
        {statDefs.map(statCard)}
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: spacing.xl, alignItems: 'start'}}>
        <div>
          <div style={sec}>PARKING OCCUPANCY</div>
          {occupancyBody}
        </div>
        <div>
          <div style={sec}>DRIVERS ON DUTY</div>
          {driversBody}
        </div>
      </div>

      <div style={sec}>LIVE ACTIVITY</div>
      {activityBody}
    </div>
  );
}
