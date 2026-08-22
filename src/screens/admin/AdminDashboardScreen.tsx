import React, {useEffect, useState} from 'react';
import {useTheme} from '../../context/ThemeContext';
import {useAuth} from '../../context/AuthContext';
import {useAppState} from '../../context/AppStateContext';
import {PressableScale} from '../../components/PressableScale';
import {useDialog} from '../../components/AppDialog';
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

function taskStatusLabel(t: {type: string; status: string}): {label: string; tone: StatusTone} {
  if (t.status === 'requested' || t.status === 'accepted' || t.status === 'assigned') {
    return {label: 'Awaiting driver', tone: 'warning'};
  }
  if (t.status === 'key_collected') return {label: 'Key collected', tone: 'info'};
  if (t.status === 'in_transit') return {label: t.type === 'park' ? 'Parking' : 'Retrieving', tone: 'info'};
  if (t.status === 'delivered') return {label: 'Delivered', tone: 'success'};
  return {label: t.type === 'park' ? 'Parked' : 'Retrieved', tone: 'success'};
}

export function AdminDashboardScreen({onOpenMap, onOpenDrivers}: {onOpenMap: (block?: string) => void; onOpenDrivers: () => void}) {
  const {colors} = useTheme();
  const {user} = useAuth();
  const dialog = useDialog();
  const {tasks, drivers, slots, addVisitor} = useAppState();

  const [quickPark, setQuickPark] = useState(false);
  const [pName, setPName] = useState('');
  const [pCar, setPCar] = useState('');
  const [pMobile, setPMobile] = useState('');
  const [parking, setParking] = useState(false);
  const [showAllOps, setShowAllOps] = useState(false);

  const liveTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
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

  const closeQuickPark = () => { setQuickPark(false); setPName(''); setPCar(''); setPMobile(''); };
  const handleQuickPark = async () => {
    if (!pCar.trim() || !pMobile.trim() || parking) return;
    setParking(true);
    try {
      await addVisitor({name: pName.trim() || 'Visitor', carNumber: pCar.trim().toUpperCase(), mobile: pMobile.trim()});
      dialog.alert('Check-in created — assign a driver from the Jobs queue.', {tone: 'success', title: 'Vehicle logged'});
      closeQuickPark();
    } catch (err: any) {
      dialog.alert(err.message || 'Could not log this vehicle');
    } finally {
      setParking(false);
    }
  };

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

        {/* Primary actions — the two things an admin does most, one tap away. */}
        <div style={{display: 'flex', gap: 10, marginBottom: spacing.lg}}>
          <PressableScale onClick={() => setQuickPark(true)} style={{flex: 1, ...card, padding: '16px 14px', textAlign: 'left', display: 'block'}}>
            <img src="/assets/admin/icons/park.svg" width={34} height={34} alt="" style={{marginBottom: 10, display: 'block'}} />
            <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>Park Vehicle</div>
          </PressableScale>
          <PressableScale onClick={() => onOpenMap()} style={{flex: 1, ...card, padding: '16px 14px', textAlign: 'left', display: 'block'}}>
            <img src="/assets/admin/icons/retrieve.svg" width={34} height={34} alt="" style={{marginBottom: 10, display: 'block'}} />
            <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>Retrieve Vehicle</div>
          </PressableScale>
        </div>

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
            return (
              <div key={t.id} style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '13px 16px', borderBottom: i === arr.length - 1 ? 'none' : `1px solid ${colors.divider}`}}>
                <div style={{width: 34, height: 34, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.cardAlt}}>
                  <Icon name={t.type === 'park' ? 'car' : 'refresh'} size={15} color={colors.textPrimary} />
                </div>
                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary, letterSpacing: 0.3}}>{t.carNumber}</div>
                  <div style={{fontSize: 11, marginTop: 2, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                    {t.doctorName}{t.slotId ? ` · ${t.slotId}` : ''}{t.driverName ? ` · ${t.driverName}` : ''}
                  </div>
                </div>
                <span style={{flexShrink: 0, fontSize: 10.5, fontWeight: 800, color: toneColor}}>{st.label.toUpperCase()}</span>
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

      {/* Quick Park — minimal intake (name/car/mobile), same call the public
          visitor check-in flow already uses. Assigning a driver still
          happens from the Jobs queue, same as every other check-in. */}
      {quickPark && (
        <div style={{position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'}} onClick={closeQuickPark}>
          <div onClick={e => e.stopPropagation()} style={{width: '100%', maxWidth: 480, margin: '0 auto', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28}}>
            <div style={{width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, margin: '0 auto 18px'}} />
            <div style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary, marginBottom: 4}}>Park a Vehicle</div>
            <div style={{fontSize: 12, color: colors.textMuted, marginBottom: 18}}>Logs a new check-in — a driver is assigned next from the Jobs queue.</div>
            {[
              {v: pName, set: setPName, ph: 'Visitor name (optional)', type: 'text'},
              {v: pCar, set: setPCar, ph: 'Car number', type: 'text'},
              {v: pMobile, set: setPMobile, ph: 'Mobile number', type: 'tel'},
            ].map((f, i) => (
              <input key={i} value={f.v} onChange={e => f.set(e.target.value)} placeholder={f.ph} type={f.type}
                style={{width: '100%', boxSizing: 'border-box', border: `1.5px solid ${colors.border}`, borderRadius: 12, padding: '0 14px', height: 50, fontSize: 15, fontWeight: 600, backgroundColor: colors.card, color: colors.textPrimary, marginBottom: 10}} />
            ))}
            <PressableScale onClick={handleQuickPark} disabled={!pCar.trim() || !pMobile.trim() || parking}
              style={{width: '100%', borderRadius: radius.full, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 8, backgroundColor: colors.primary, opacity: (!pCar.trim() || !pMobile.trim()) ? 0.4 : 1}}>
              {parking ? <span className="spinner" style={{width: 18, height: 18, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} /> : <span style={{color: colors.textOnPrimary, fontSize: 15, fontWeight: 700}}>Log Check-in</span>}
            </PressableScale>
          </div>
        </div>
      )}
    </div>
  );
}
