import React, {useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';
import {useAppState} from '../../context/AppStateContext';
import {PressableScale} from '../../components/PressableScale';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';

// Redesigned per the Mobbin-researched brief: "understand the whole
// operation in 3-5 seconds, details only after tapping." The old version put
// a 2x2 metric grid, a full block-by-block progress list AND a full driver
// list on this one screen — all real data, but arranged so nothing read
// faster than scrolling to the bottom. This version shows one compact
// occupancy card (overall + per-block chips, no 90-slot render), two
// prominent primary actions, at most 3 live operations with a way to see
// more, and a compact driver strip — everything else lives one tap away
// (Map for the full slot grid, Staff for the full driver list).
type StatusTone = 'success' | 'info' | 'warning' | 'muted';

function taskStatusLabel(t: {type: string; status: string}): {label: string; tone: StatusTone; isLive: boolean} {
  if (t.status === 'requested' || t.status === 'accepted' || t.status === 'assigned') {
    return {label: 'Awaiting driver', tone: 'warning', isLive: true};
  }
  if (t.status === 'key_collected') return {label: 'Key collected', tone: 'info', isLive: true};
  if (t.status === 'in_transit') return {label: t.type === 'park' ? 'Parking' : 'Retrieving', tone: 'info', isLive: true};
  if (t.status === 'delivered') return {label: 'Delivered', tone: 'success', isLive: true};
  // Terminal, but still worth showing for a while — a car that just got
  // parked or handed back is exactly what "PARKED"/"RETRIEVAL" meant in the
  // reference examples this section was designed against. Not pulsing:
  // isLive false is what tells the row apart from something still moving.
  return {label: t.type === 'park' ? 'Parked' : 'Retrieved', tone: 'success', isLive: false};
}

// A job's most recent moment of activity, whichever field that actually is
// for its current status — this is what "Live Operations" sorts by, so a
// job that just moved (even a terminal one, like just having been parked)
// always outranks one that's been sitting untouched.
function taskActivityTime(t: {completedAt?: number; startedAt?: number; keyCollectedAt?: number; assignedAt?: number; requestedAt?: number}): number {
  return t.completedAt ?? t.startedAt ?? t.keyCollectedAt ?? t.assignedAt ?? t.requestedAt ?? 0;
}

function relativeAgo(ms: number): string {
  if (!ms) return '';
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// How long a completed job still counts as "live" — long enough that a
// valet glancing at the dashboard sees what just happened, short enough
// that the section stays a snapshot of right-now instead of turning into
// a history log (that's what Analytics is for).
const RECENT_COMPLETION_MS = 2 * 60 * 60 * 1000;

// Admin is oversight, not dispatch: parking/retrieving a car and picking a
// driver is the VALET's job (ValetHomeScreen/ValetRecordsScreen already do
// this) — this screen shows what's happening, it doesn't do it. An earlier
// version put Park/Retrieve action cards and a driver-assignment picker
// here; removed at the user's explicit correction.
export function AdminDashboardScreen({onOpenMap, onOpenDrivers}: {onOpenMap: (block?: string) => void; onOpenDrivers: () => void}) {
  const {colors} = useTheme();
  const {user} = useAuth();
  const {tasks, drivers, slots} = useAppState();

  const [showAllOps, setShowAllOps] = useState(false);

  // Was `status !== 'completed'` — excluded the exact "PARKED"/"RETRIEVAL"
  // snapshot this section is supposed to show (a completed job IS the
  // live-operations moment right after it happens), so the list read empty
  // almost all the time even with real activity going on. Now: anything
  // still in progress, plus anything completed within the last couple
  // hours, newest first.
  const liveTasks = tasks
    .filter(t => t.status !== 'cancelled')
    .filter(t => t.status !== 'completed' || (t.completedAt != null && Date.now() - t.completedAt < RECENT_COMPLETION_MS))
    .sort((a, b) => taskActivityTime(b) - taskActivityTime(a));
  const occupied = slots.filter(s => s.status === 'occupied').length;
  const total = slots.length;
  const free = total - occupied;
  const occupancyPct = total ? Math.round((occupied / total) * 100) : 0;
  const fillColor = occupancyPct > 90 ? colors.error : occupancyPct > 70 ? colors.warning : colors.success;

  const blockStats = React.useMemo(() => {
    const byBlock = new Map<string, {total: number; used: number}>();
    for (const sl of slots) {
      const entry = byBlock.get(sl.block) ?? {total: 0, used: 0};
      entry.total += 1;
      if (sl.status === 'occupied') entry.used += 1;
      byBlock.set(sl.block, entry);
    }
    return [...byBlock.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, v]) => ({name, ...v}));
  }, [slots]);

  const availableDrivers = drivers.filter(d => d.status === 'available');
  const today = new Date().toLocaleDateString(undefined, {weekday: 'long', month: 'long', day: 'numeric'});

  const sec: React.CSSProperties = {fontSize: typography.sizes.base, fontWeight: typography.weights.black, letterSpacing: -0.2, color: colors.textPrimary, display: 'flex', alignItems: 'center', justifyContent: 'space-between'};
  const card: React.CSSProperties = {borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, backgroundColor: colors.card};

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40}}>
      {/* Header */}
      <div style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '20px 16px 16px'}}>
        <div style={{width: 44, height: 44, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary}}>
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

      <div style={{padding: `0 ${spacing.base}px`}}>
        {/* Compact occupancy overview — the ONE number that matters first,
            block breakdown as tappable chips, not a 90-slot render. */}
        <PressableScale onClick={() => onOpenMap()} style={{width: '100%', display: 'block', textAlign: 'left', ...card, padding: 20, marginBottom: spacing.md}}>
          <div style={{display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16}}>
            <div>
              <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 1, color: colors.textMuted, marginBottom: 4}}>PARKING</div>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10}}>
                <span style={{fontSize: typography.sizes['4xl'], fontWeight: typography.weights.black, color: colors.success, lineHeight: 1}}>{free}</span>
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>FREE</span>
              </div>
              <div style={{display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 2}}>
                <span style={{fontSize: typography.sizes.xl, fontWeight: typography.weights.black, color: colors.textPrimary, lineHeight: 1}}>{occupied}</span>
                <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>OCCUPIED</span>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, color: fillColor}}>{occupancyPct}%</div>
              <div style={{fontSize: 10, fontWeight: 700, color: colors.textMuted}}>FULL</div>
            </div>
          </div>
          <div style={{height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.cardAlt, display: 'flex', marginBottom: 14}}>
            {blockStats.map(b => (
              <div key={b.name} style={{width: `${total ? (b.total / total) * 100 : 0}%`, position: 'relative'}}>
                <div style={{position: 'absolute', inset: 0, width: `${b.total ? (b.used / b.total) * 100 : 0}%`, backgroundColor: fillColor}} />
              </div>
            ))}
          </div>
          {blockStats.length === 0 ? (
            <div style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>No parking slots configured yet</div>
          ) : (
            <div className="hscroll" style={{gap: 8}}>
              {blockStats.map(b => (
                <span key={b.name} style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: radius.full, backgroundColor: colors.cardAlt}}>
                  <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>Block {b.name}</span>
                  <span style={{fontSize: 11, fontWeight: 700, color: colors.textMuted, fontVariantNumeric: 'tabular-nums'}}>{b.used}/{b.total}</span>
                </span>
              ))}
            </div>
          )}
        </PressableScale>

        {/* Live operations — 2-3 active jobs, not an endless activity feed. */}
        <div style={{...sec, marginBottom: spacing.sm}}>
          <span>Live Operations</span>
          {liveTasks.length > 3 && (
            <PressableScale onClick={() => setShowAllOps(v => !v)} style={{background: 'none', border: 'none', padding: 0}}>
              <span style={{fontSize: 12, fontWeight: 700, color: colors.primary}}>{showAllOps ? 'Show less' : `View all (${liveTasks.length}) →`}</span>
            </PressableScale>
          )}
        </div>
        <div style={{...card, overflow: 'hidden', marginBottom: spacing.lg}}>
          {liveTasks.length === 0 ? (
            <div style={{padding: spacing.xl, textAlign: 'center', fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No active operations right now</div>
          ) : (showAllOps ? liveTasks : liveTasks.slice(0, 3)).map((t, i, arr) => {
            const st = taskStatusLabel(t);
            const toneColor = st.tone === 'success' ? colors.success : st.tone === 'info' ? colors.info : st.tone === 'warning' ? colors.warning : colors.textMuted;
            const ago = relativeAgo(taskActivityTime(t));
            return (
              <div key={t.id} style={{display: 'flex', alignItems: 'stretch', gap: spacing.md, padding: '13px 16px', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${colors.divider}`}}>
                {/* Left accent bar, colored by status tone — the same
                    "scan the color, not the words" pattern Analytics'
                    stat cards already use, so a valet can read the state
                    of the whole list at a glance before reading any text. */}
                <span style={{width: 3, borderRadius: 2, backgroundColor: toneColor, flexShrink: 0}} />
                <div style={{width: 34, height: 34, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.cardAlt, alignSelf: 'center'}}>
                  <Icon name={t.type === 'park' ? 'car' : 'refresh'} size={15} color={colors.textPrimary} />
                </div>
                <div style={{flex: 1, minWidth: 0, alignSelf: 'center'}}>
                  <div style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary, letterSpacing: 0.3}}>{t.carNumber}</div>
                  <div style={{fontSize: 11, marginTop: 2, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {t.doctorName}{t.slotId ? ` · ${t.slotId}` : ''}{t.driverName ? ` · ${t.driverName}` : ''}
                  </div>
                </div>
                <div style={{flexShrink: 0, alignSelf: 'center', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3}}>
                  <span style={{display: 'flex', alignItems: 'center', gap: 5}}>
                    {/* A genuinely still-moving job gets a pulsing dot — the
                        one thing in this list that should feel "live", as
                        opposed to a completed job sitting here as a recent
                        snapshot. */}
                    {st.isLive && (
                      <span style={{position: 'relative', width: 6, height: 6}}>
                        <span className="ping-dot" style={{position: 'absolute', inset: 0, borderRadius: 3, backgroundColor: toneColor}} />
                        <span style={{position: 'absolute', inset: 0, borderRadius: 3, backgroundColor: toneColor}} />
                      </span>
                    )}
                    <span style={{fontSize: 10.5, fontWeight: 800, color: toneColor}}>{st.label.toUpperCase()}</span>
                  </span>
                  {!!ago && <span style={{fontSize: 10, fontWeight: 600, color: colors.textMuted}}>{ago}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Drivers — compact strip, full roster is one tap away on Staff. */}
        <div style={{...sec, marginBottom: spacing.sm}}>
          <span>Drivers</span>
          <PressableScale onClick={onOpenDrivers} style={{background: 'none', border: 'none', padding: 0}}>
            <span style={{fontSize: 12, fontWeight: 700, color: colors.primary}}>View all →</span>
          </PressableScale>
        </div>
        <div style={{...card, padding: 14, marginBottom: 8}}>
          {drivers.length === 0 ? (
            <div style={{fontSize: 12, fontWeight: 600, color: colors.textMuted, textAlign: 'center', padding: '8px 0'}}>No drivers added yet</div>
          ) : (
            <>
              <div className="hscroll" style={{gap: 14, paddingBottom: 4}}>
                {drivers.map(d => {
                  const tone = d.status === 'off' ? colors.textMuted : d.status === 'busy' ? colors.warning : colors.success;
                  return (
                    <div key={d.id} style={{flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, width: 56}}>
                      <div style={{position: 'relative'}}>
                        <div style={{width: 40, height: 40, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}>
                          <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>{d.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                        </div>
                        <span style={{position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: tone, border: `2px solid ${colors.card}`}} />
                      </div>
                      <span style={{fontSize: 10.5, fontWeight: 700, color: colors.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 56}}>{d.name.split(' ')[0]}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize: 11.5, fontWeight: 700, color: colors.textMuted, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${colors.divider}`}}>
                {availableDrivers.length} of {drivers.length} available
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
