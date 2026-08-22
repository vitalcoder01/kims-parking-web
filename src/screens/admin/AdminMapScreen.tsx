import React, {useState, useMemo} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useTheme} from '../../context/ThemeContext';
import {useAppState} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';
import {Badge} from '../../components/Badge';
import {spacing, radius, typography} from '../../theme';

// How long a car's been sitting in its slot, since the owner popup shows it
// alongside who it belongs to — "since 2:14 PM" only means something with a
// duration next to it.
function agoLabel(ms?: number): string | null {
  if (!ms) return null;
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min ago` : `${hrs} hr ago`;
}

// Direct port of the mobile app's ParkingMapScreen (admin's "Live Map" tab —
// actually a slot occupancy grid, not a GPS map).
export function AdminMapScreen() {
  const {colors} = useTheme();
  const {slots, tasks} = useAppState();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const pickedSlot = picked ? slots.find(sl => sl.id === picked) : undefined;
  // Cross-referenced against the live task list (already carries the
  // owner's name, department, driver — works uniformly for staff/doctor AND
  // visitor sessions since both run through the same ParkingTask) rather
  // than adding a new backend field just for this popup.
  const pickedOwnerTask = pickedSlot?.taskId ? tasks.find(t => t.id === pickedSlot.taskId) : undefined;
  const showingOwnerDetail = pickedSlot?.status === 'occupied';
  const selectSlot = (id: string) => setPicked(prev => (prev === id ? undefined : id));

  const blocks = useMemo(() => {
    const byBlock = new Map<string, typeof slots>();
    for (const sl of slots) {
      const list = byBlock.get(sl.block) ?? [];
      list.push(sl);
      byBlock.set(sl.block, list);
    }
    return [...byBlock.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => ({
        name,
        slots: list.slice().sort((a, b) => a.number - b.number),
        free: list.filter(sl => sl.status === 'free').length,
      }));
  }, [slots]);

  const occupied = slots.filter(sl => sl.status === 'occupied').length;
  const total = slots.length;
  const available = total - occupied;
  const occupancyPct = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, padding: 16, paddingBottom: 40}}>
      {/* Occupancy summary — swaps to the clicked slot's owner details when
          an occupied slot is selected; clicking that same slot again (see
          selectSlot) clears the selection and this reverts automatically. */}
      {showingOwnerDetail && pickedSlot ? (
        <div style={{borderRadius: radius['2xl'], padding: 20, marginBottom: spacing.base, backgroundColor: colors.primary}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14}}>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: colors.textOnPrimary + '99'}}>
                SLOT {pickedSlot.id}{pickedOwnerTask?.isVisitor ? ' · VISITOR' : ''}
              </div>
              <div style={{fontSize: typography.sizes.xl, fontWeight: typography.weights.black, marginTop: 2, color: colors.textOnPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                {pickedOwnerTask?.doctorName ?? pickedSlot.carNumber ?? 'Occupied'}
              </div>
            </div>
            <PressableScale
              onClick={() => setPicked(undefined)}
              style={{width: 30, height: 30, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.textOnPrimary + '2E'}}
            >
              <Icon name="close" size={16} color={colors.textOnPrimary} />
            </PressableScale>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14}}>
            {([
              ['Car', pickedSlot.carNumber || pickedOwnerTask?.carNumber || '—'],
              ...(pickedOwnerTask?.doctorDepartment ? [['Department', pickedOwnerTask.doctorDepartment]] : []),
              ...(pickedOwnerTask?.driverName ? [['Driver', pickedOwnerTask.driverName]] : []),
              ...(agoLabel(pickedOwnerTask?.completedAt) ? [['Parked', agoLabel(pickedOwnerTask?.completedAt)!]] : []),
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} style={{display: 'flex', justifyContent: 'space-between', gap: 12}}>
                <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: colors.textOnPrimary + '99'}}>{k}</span>
                <span style={{fontSize: 12.5, fontWeight: 800, color: colors.textOnPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{borderRadius: radius['2xl'], padding: 20, marginBottom: spacing.base, backgroundColor: colors.primary}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14}}>
            <div>
              <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: colors.textOnPrimary + '99'}}>OCCUPANCY</div>
              <div style={{fontSize: typography.sizes['3xl'], fontWeight: typography.weights.black, marginTop: 2, color: colors.textOnPrimary}}>
                {occupied}<span style={{fontSize: 18, fontWeight: 700, color: colors.textOnPrimary + '88'}}> / {total}</span>
              </div>
            </div>
            <div style={{textAlign: 'right'}}>
              <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, color: colors.textOnPrimary}}>{occupancyPct}%</div>
              <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: colors.textOnPrimary + '99'}}>{available} FREE</div>
            </div>
          </div>
          <div style={{height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.textOnPrimary + '33'}}>
            <div style={{height: '100%', borderRadius: 4, width: `${occupancyPct}%`, backgroundColor: colors.textOnPrimary, transition: 'width 0.4s ease'}} />
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: spacing.base, padding: '12px 14px', borderRadius: radius.full, backgroundColor: colors.card, border: `1px solid ${colors.border}`}}>
        {[
          {bg: colors.successLight, br: colors.success, lbl: 'Free'},
          {bg: colors.cardAlt, br: colors.border, lbl: 'Occupied'},
          {bg: colors.primary, br: colors.primary, lbl: 'Selected'},
        ].map(i => (
          <div key={i.lbl} style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{width: 14, height: 14, borderRadius: 5, border: `1px solid ${i.br}`, backgroundColor: i.bg, display: 'inline-block'}} />
            <span style={{fontSize: 11, fontWeight: 600, color: colors.textSecondary}}>{i.lbl}</span>
          </div>
        ))}
        <div style={{flex: 1}} />
        {/* Free-slot selection only — an occupied one already shows its full
            detail in the swapped summary card above. */}
        {pickedSlot && !showingOwnerDetail && (
          <div style={{display: 'flex', alignItems: 'center', gap: 4, borderRadius: radius.sm, border: `1.5px solid ${colors.textPrimary}`, padding: '5px 10px', backgroundColor: colors.card}}>
            <Icon name="pin" size={12} color={colors.textPrimary} />
            <span style={{fontSize: 11, fontWeight: 800, color: colors.textPrimary}}>{pickedSlot.id}{pickedSlot.carNumber ? ` · ${pickedSlot.carNumber}` : ''}</span>
          </div>
        )}
      </div>

      {/* Blocks */}
      {blocks.length === 0 ? (
        <div style={{borderRadius: radius['2xl'], border: `1px dashed ${colors.border}`, padding: 28, textAlign: 'center'}}>
          <Icon name="parking" size={26} color={colors.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: spacing.sm, color: colors.textMuted}}>No parking slots configured yet</div>
        </div>
      ) : blocks.map(bl => (
        <div key={bl.name} style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, marginBottom: spacing.md, overflow: 'hidden', backgroundColor: colors.card}}>
          <div style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: 14, borderBottom: `1px solid ${colors.divider}`}}>
            <div style={{width: 34, height: 34, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}>
              <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary}}>{bl.name}</span>
            </div>
            <span style={{flex: 1, fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>Block {bl.name}</span>
            <Badge label={bl.free > 0 ? `${bl.free} free` : 'Full'} variant={bl.free > 0 ? 'success' : 'error'} dot />
          </div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, padding: 14}}>
            {bl.slots.map(sl => {
              const isSel = sl.id === picked;
              const free = sl.status === 'free';
              const bg = isSel ? colors.primary : free ? colors.successLight : colors.cardAlt;
              const tc = isSel ? colors.textOnPrimary : free ? colors.success : colors.textMuted;
              return (
                <PressableScale
                  key={sl.id}
                  onClick={() => selectSlot(sl.id)}
                  style={{width: 44, height: 40, borderRadius: radius.lg, border: `2px solid ${isSel ? colors.textPrimary : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: bg}}
                >
                  <span style={{fontSize: 12, fontWeight: 800, color: tc}}>{sl.number}</span>
                </PressableScale>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
