import React, {useState, useMemo, useEffect} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useTheme} from '../../context/ThemeContext';
import {useAppState} from '../../context/AppStateContext';
import {useDialog} from '../../components/AppDialog';
import {Icon} from '../../components/Icon';
import {Badge} from '../../components/Badge';
import {spacing, radius, typography} from '../../theme';

function agoLabel(ms?: number): string | null {
  if (!ms) return null;
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min ago` : `${hrs} hr ago`;
}

// Redesigned per the Mobbin-researched brief. The old version rendered every
// block's full slot grid stacked one after another — three ~30-slot grids
// on one endlessly scrolling page. This shows ONE block at a time (a
// horizontal block selector switches between them, same pattern as an
// airline seat map's cabin selector), so the whole grid fits without
// scrolling on a phone. Slot detail moved from an inline swapped card into
// a real bottom sheet, and it now has an actual action (Retrieve Vehicle,
// via an inline driver picker) instead of being read-only.
export function AdminMapScreen({focusBlock}: {focusBlock?: string} = {}) {
  const {colors} = useTheme();
  const dialog = useDialog();
  const {slots, tasks, drivers, assignRetrievalDriver, assignStaffRetrievalDriver} = useAppState();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [activeBlock, setActiveBlock] = useState<string | undefined>(focusBlock);
  const [pickingDriver, setPickingDriver] = useState(false);
  const [assigning, setAssigning] = useState<number | null>(null);

  useEffect(() => { if (focusBlock) setActiveBlock(focusBlock); }, [focusBlock]);

  const pickedSlot = picked ? slots.find(sl => sl.id === picked) : undefined;
  const pickedOwnerTask = pickedSlot?.taskId ? tasks.find(t => t.id === pickedSlot.taskId) : undefined;
  const alreadyRetrieving = !!pickedOwnerTask && tasks.some(t =>
    t.type === 'retrieve' && t.status !== 'completed' && t.status !== 'cancelled'
    && (pickedOwnerTask.isVisitor ? t.visitorId === pickedOwnerTask.visitorId : t.doctorId === pickedOwnerTask.doctorId));

  const blocks = useMemo(() => {
    const byBlock = new Map<string, typeof slots>();
    for (const sl of slots) {
      const list = byBlock.get(sl.block) ?? [];
      list.push(sl);
      byBlock.set(sl.block, list);
    }
    return [...byBlock.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => ({name, slots: list.slice().sort((a, b) => a.number - b.number), free: list.filter(sl => sl.status === 'free').length}));
  }, [slots]);

  useEffect(() => {
    if (!activeBlock && blocks.length > 0) setActiveBlock(blocks[0].name);
  }, [blocks, activeBlock]);

  const currentBlock = blocks.find(b => b.name === activeBlock);
  const occupied = slots.filter(sl => sl.status === 'occupied').length;
  const total = slots.length;
  const available = total - occupied;
  const occupancyPct = total ? Math.round((occupied / total) * 100) : 0;

  const closeSheet = () => { setPicked(undefined); setPickingDriver(false); };

  const handlePickDriver = async (driverId: number) => {
    if (!pickedOwnerTask || assigning != null) return;
    setAssigning(driverId);
    try {
      if (pickedOwnerTask.isVisitor && pickedOwnerTask.visitorId != null) {
        await assignRetrievalDriver(pickedOwnerTask.visitorId, driverId);
      } else if (pickedOwnerTask.doctorId != null) {
        await assignStaffRetrievalDriver(pickedOwnerTask.doctorId, driverId);
      }
      closeSheet();
    } catch (err: any) {
      dialog.alert(err.message || 'Could not assign a driver');
    } finally {
      setAssigning(null);
    }
  };

  const availableDrivers = drivers.filter(d => d.status === 'available');

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, padding: 16, paddingBottom: 40}}>
      {/* Overall occupancy — compact, always visible regardless of which
          block is selected below. */}
      <div style={{borderRadius: radius['2xl'], padding: 18, marginBottom: spacing.md, backgroundColor: colors.primary}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <div>
            <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: colors.textOnPrimary + '99'}}>OVERALL OCCUPANCY</div>
            <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, marginTop: 2, color: colors.textOnPrimary}}>
              {occupied}<span style={{fontSize: 16, fontWeight: 700, color: colors.textOnPrimary + '88'}}> / {total}</span>
            </div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{fontSize: typography.sizes.xl, fontWeight: typography.weights.black, color: colors.textOnPrimary}}>{occupancyPct}%</div>
            <div style={{fontSize: 10, fontWeight: 700, color: colors.textOnPrimary + '99'}}>{available} FREE</div>
          </div>
        </div>
      </div>

      {/* Block selector — switches which single block's grid is shown below,
          instead of stacking every block's grid on one page. */}
      {blocks.length > 1 && (
        <div className="hscroll" style={{gap: 8, marginBottom: spacing.md}}>
          {blocks.map(bl => {
            const on = bl.name === activeBlock;
            return (
              <PressableScale key={bl.name} onClick={() => { setActiveBlock(bl.name); setPicked(undefined); }}
                style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: radius.full, backgroundColor: on ? colors.primary : colors.card, border: `1px solid ${on ? colors.primary : colors.border}`}}>
                <span style={{fontSize: 13, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textPrimary}}>Block {bl.name}</span>
                <span style={{fontSize: 11, fontWeight: 700, color: on ? colors.textOnPrimary + 'cc' : colors.textMuted}}>{bl.free}/{bl.slots.length}</span>
              </PressableScale>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: spacing.base, padding: '10px 14px', borderRadius: radius.full, backgroundColor: colors.card, border: `1px solid ${colors.border}`}}>
        {[
          {bg: colors.successLight, br: colors.success, lbl: 'Free'},
          {bg: colors.cardAlt, br: colors.border, lbl: 'Occupied'},
        ].map(i => (
          <div key={i.lbl} style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{width: 12, height: 12, borderRadius: 4, border: `1px solid ${i.br}`, backgroundColor: i.bg, display: 'inline-block'}} />
            <span style={{fontSize: 11, fontWeight: 600, color: colors.textSecondary}}>{i.lbl}</span>
          </div>
        ))}
        <div style={{flex: 1}} />
        {currentBlock && <Badge label={currentBlock.free > 0 ? `${currentBlock.free} free` : 'Full'} variant={currentBlock.free > 0 ? 'success' : 'error'} dot />}
      </div>

      {/* One block's grid — compact enough to fit without scrolling. */}
      {!currentBlock ? (
        <div style={{borderRadius: radius['2xl'], border: `1px dashed ${colors.border}`, padding: 28, textAlign: 'center'}}>
          <img src="/assets/admin/illustrations/empty_parking.svg" width={64} height={64} alt="" style={{marginBottom: 8}} />
          <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No parking slots configured yet</div>
        </div>
      ) : (
        <div style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, backgroundColor: colors.card, padding: 16}}>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start'}}>
            {currentBlock.slots.map(sl => {
              const free = sl.status === 'free';
              const bg = free ? colors.successLight : colors.cardAlt;
              const tc = free ? colors.success : colors.textMuted;
              return (
                <PressableScale key={sl.id} onClick={() => setPicked(sl.id)}
                  style={{width: 46, height: 42, borderRadius: radius.lg, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: bg}}>
                  <span style={{fontSize: 12, fontWeight: 800, color: tc}}>{sl.number}</span>
                </PressableScale>
              );
            })}
          </div>
        </div>
      )}

      {/* Slot detail — a real bottom sheet, not an inline swapped card, with
          an actual Retrieve Vehicle action (opens an inline driver picker;
          same assign calls the Jobs queue's driver-picker uses). */}
      {pickedSlot && (
        <div style={{position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)'}} onClick={closeSheet}>
          <div onClick={e => e.stopPropagation()} style={{width: '100%', maxWidth: 480, margin: '0 auto', backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, maxHeight: '75vh', overflowY: 'auto'}}>
            <div style={{width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, margin: '0 auto 18px'}} />
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18}}>
              <div>
                <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 1, color: colors.textMuted}}>SLOT {pickedSlot.id}</div>
                <div style={{fontSize: 19, fontWeight: 900, marginTop: 2, color: colors.textPrimary}}>
                  {pickedSlot.status === 'occupied' ? (pickedOwnerTask?.doctorName ?? pickedSlot.carNumber ?? 'Occupied') : 'Free'}
                </div>
              </div>
              <Badge label={pickedSlot.status === 'occupied' ? 'Occupied' : 'Free'} variant={pickedSlot.status === 'occupied' ? 'muted' : 'success'} dot />
            </div>

            {pickedSlot.status === 'occupied' && (
              <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20}}>
                {([
                  ['Vehicle', pickedSlot.carNumber || pickedOwnerTask?.carNumber || '—'],
                  ...(pickedOwnerTask?.isVisitor ? [['Type', 'Visitor']] as [string, string][] : []),
                  ...(pickedOwnerTask?.doctorDepartment ? [['Department', pickedOwnerTask.doctorDepartment]] as [string, string][] : []),
                  ...(pickedOwnerTask?.driverName ? [['Driver', pickedOwnerTask.driverName]] as [string, string][] : []),
                  ...(agoLabel(pickedOwnerTask?.completedAt) ? [['Parked', agoLabel(pickedOwnerTask?.completedAt)!]] as [string, string][] : []),
                ]).map(([k, v]) => (
                  <div key={k} style={{display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, backgroundColor: colors.cardAlt}}>
                    <span style={{fontSize: 12, fontWeight: 700, color: colors.textMuted}}>{k}</span>
                    <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {pickedSlot.status === 'occupied' && pickedOwnerTask && (
              alreadyRetrieving ? (
                <div style={{width: '100%', borderRadius: radius.full, height: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}>
                  <span style={{fontSize: 14, fontWeight: 700, color: colors.textMuted}}>Retrieval already in progress</span>
                </div>
              ) : !pickingDriver ? (
                <PressableScale onClick={() => setPickingDriver(true)} style={{width: '100%', borderRadius: radius.full, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary}}>
                  <Icon name="refresh" size={16} color={colors.textOnPrimary} />
                  <span style={{color: colors.textOnPrimary, fontSize: 15, fontWeight: 700}}>Retrieve Vehicle</span>
                </PressableScale>
              ) : (
                <div>
                  <div style={{fontSize: 12, fontWeight: 700, color: colors.textMuted, marginBottom: 10}}>Assign a driver</div>
                  {availableDrivers.length === 0 ? (
                    <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted, textAlign: 'center', padding: '16px 0'}}>No drivers available right now</div>
                  ) : (
                    <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                      {availableDrivers.map(d => (
                        <PressableScale key={d.id} onClick={() => handlePickDriver(d.id)} disabled={assigning != null}
                          style={{width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.card, opacity: assigning != null && assigning !== d.id ? 0.5 : 1}}>
                          <div style={{width: 34, height: 34, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt, flexShrink: 0}}>
                            <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>{d.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                          </div>
                          <span style={{flex: 1, fontSize: 13.5, fontWeight: 700, color: colors.textPrimary, textAlign: 'left'}}>{d.name}</span>
                          {assigning === d.id ? <span className="spinner" style={{width: 16, height: 16, borderColor: colors.border, borderTopColor: colors.primary}} /> : <Icon name="arrowRight" size={14} color={colors.textMuted} />}
                        </PressableScale>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
