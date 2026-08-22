import React, {useEffect, useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';
import {useAppState} from '../../context/AppStateContext';
import {Badge} from '../../components/Badge';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';

// Direct port of the mobile app's AdminDashboardScreen.
type ActivityType = 'success' | 'info' | 'primary' | 'warning';

export function AdminDashboardScreen() {
  const {colors, isDark} = useTheme();
  const {user} = useAuth();
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

  const today = new Date().toLocaleDateString(undefined, {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'});

  const sec: React.CSSProperties = {fontSize: typography.sizes.base, fontWeight: typography.weights.black, letterSpacing: -0.2, marginBottom: spacing.sm, marginTop: spacing.xs, color: colors.textPrimary};
  const sheet: React.CSSProperties = {borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.card, marginBottom: spacing.xl};
  const emptyTxt: React.CSSProperties = {fontSize: typography.sizes.base, fontWeight: typography.weights.semibold, padding: spacing.xl, textAlign: 'center', color: colors.textMuted};
  const trackBg = isDark ? '#2A2A2A' : '#EBEBEB';

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40}}>
      {/* Header — circular avatar (Uber never uses a rounded-square), plain
          bold name, status as a small dot rather than a boxed badge. */}
      <div style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '20px 16px 18px', backgroundColor: colors.background}}>
        <div style={{
          width: 44, height: 44, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.primary,
        }}>
          <span style={{fontSize: typography.sizes.base, fontWeight: typography.weights.bold, color: colors.textOnPrimary}}>
            {(user?.name ?? 'Admin').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, letterSpacing: -0.5, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{user?.name ?? 'Admin'}</div>
          <div style={{fontSize: typography.sizes.sm, marginTop: 2, color: colors.textMuted}}>{today}</div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: radius.full, backgroundColor: colors.card, border: `1px solid ${colors.border}`}}>
          <span style={{width: 6, height: 6, borderRadius: 3, backgroundColor: colors.success}} />
          <span style={{fontSize: typography.sizes.xs, fontWeight: typography.weights.bold, color: colors.textSecondary}}>Live</span>
        </div>
      </div>

      {/* Metrics 2x2 — one restrained accent (a small dot, not a big tinted
          icon block) instead of four different hues; the number itself is
          what should read first, the way a fare or an ETA does in Uber. */}
      <div style={{padding: `0 ${spacing.base}px`, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: spacing.md, marginBottom: spacing.md}}>
        {[
          {n: String(parkedCars), l: 'Vehicles Parked', c: colors.primary, ic: 'parking' as IconName},
          {n: String(busyDrivers), l: 'Drivers On Duty', c: colors.info, ic: 'people' as IconName},
          {n: String(liveTasks.length), l: 'Tasks Active', c: colors.warning, ic: 'bolt' as IconName},
          {n: String(pendingRetrieval), l: 'Retrieval Pending', c: colors.success, ic: 'refresh' as IconName},
        ].map(m => (
          <div key={m.l} style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, padding: '20px 18px', backgroundColor: colors.card}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md}}>
              <Icon name={m.ic} size={18} color={colors.textMuted} />
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: m.c}} />
            </div>
            <div style={{fontSize: typography.sizes['3xl'], fontWeight: typography.weights.black, letterSpacing: -1, color: colors.textPrimary, lineHeight: 1.1}}>{m.n}</div>
            <div style={{fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold, marginTop: 4, color: colors.textMuted}}>{m.l}</div>
          </div>
        ))}
      </div>

      <div style={{padding: 16}}>
        {/* Parking occupancy */}
        <div style={sec}>PARKING OCCUPANCY</div>
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

        {/* Drivers on duty */}
        <div style={sec}>DRIVERS ON DUTY</div>
        <div style={sheet}>
          {drivers.length === 0 ? (
            <div style={emptyTxt}>No drivers added yet</div>
          ) : drivers.map((d, i) => {
            const initials = d.name.split(' ').map(w => w[0]).join('').slice(0, 2);
            const busy = d.status === 'busy';
            return (
              <div key={d.id} style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '14px 16px', borderBottom: i === drivers.length - 1 ? 'none' : `1px solid ${colors.divider}`}}>
                <div style={{width: 38, height: 38, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.cardAlt}}>
                  <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>{initials}</span>
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

        {/* Live activity */}
        <div style={sec}>LIVE ACTIVITY</div>
        <div style={{...sheet, marginBottom: 4}}>
          {liveActivity.length === 0 ? (
            <div style={emptyTxt}>No activity yet today</div>
          ) : liveActivity.map((a, i) => (
            <div key={i} style={{display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: i === liveActivity.length - 1 ? 'none' : `1px solid ${colors.divider}`, gap: 10}}>
              <span style={{width: 8, height: 8, borderRadius: 4, flexShrink: 0, backgroundColor: actColor[a.type], marginLeft: 16}} />
              <div style={{
                width: 32, height: 32, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                backgroundColor: colors.cardAlt,
              }}>
                <Icon name={a.icon} size={15} color={colors.textPrimary} />
              </div>
              <div style={{flex: 1, paddingRight: 16}}>
                <div style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>{a.text}</div>
                <div style={{fontSize: 11, marginTop: 2, color: colors.textMuted}}>{a.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
