import React, {useState, useMemo, useEffect} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useAppState} from '../../context/AppStateContext';
import {typography} from '../../theme';
import {dark, darkCard, darkSectionLabel, DarkPill} from './adminDarkTheme';

function agoLabel(ms?: number): string | null {
  if (!ms) return null;
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min ago` : `${hrs} hr ago`;
}

// One block at a time (a horizontal block selector switches between them,
// same pattern as an airline seat map's cabin selector), so the whole
// grid fits without scrolling on a phone.
//
// Read-only, deliberately: admin is oversight, not dispatch — parking/
// retrieving a car and picking a driver is the valet's job. This just
// answers "what's in that slot, whose car is it, who's driving it" —
// nothing to tap into action.
//
// Restyled onto the same dark ops-console tokens as Guard/Dashboard/
// Staff/Attendance (see ./adminDarkTheme) — same logic and data, only
// the surface changed.
export function AdminMapScreen({focusBlock}: {focusBlock?: string} = {}) {
  const {slots, tasks} = useAppState();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [activeBlock, setActiveBlock] = useState<string | undefined>(focusBlock);

  useEffect(() => { if (focusBlock) setActiveBlock(focusBlock); }, [focusBlock]);

  const pickedSlot = picked ? slots.find(sl => sl.id === picked) : undefined;
  const pickedOwnerTask = pickedSlot?.taskId ? tasks.find(t => t.id === pickedSlot.taskId) : undefined;

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

  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: 16, paddingBottom: 40}}>
      {/* Overall occupancy — compact, always visible regardless of which
          block is selected below. */}
      <div style={{
        borderRadius: 20, padding: 18, marginBottom: 12,
        background: `radial-gradient(120% 140% at 15% 0%, ${dark.accent}22 0%, transparent 55%), ${dark.card}`,
        border: `1px solid ${dark.border}`,
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end'}}>
          <div>
            <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: dark.textMuted}}>OVERALL OCCUPANCY</div>
            <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, marginTop: 2, color: dark.textPrimary}}>
              {occupied}<span style={{fontSize: 16, fontWeight: 700, color: dark.textMuted}}> / {total}</span>
            </div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{fontSize: typography.sizes.xl, fontWeight: typography.weights.black, color: dark.accent}}>{occupancyPct}%</div>
            <div style={{fontSize: 10, fontWeight: 700, color: dark.textMuted}}>{available} FREE</div>
          </div>
        </div>
      </div>

      {/* Block selector — switches which single block's grid is shown below,
          instead of stacking every block's grid on one page. */}
      {blocks.length > 1 && (
        <div className="hscroll" style={{gap: 8, marginBottom: 12}}>
          {blocks.map(bl => {
            const on = bl.name === activeBlock;
            return (
              <PressableScale key={bl.name} onClick={() => { setActiveBlock(bl.name); setPicked(undefined); }}
                style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 999, backgroundColor: on ? dark.accent : dark.card, border: `1px solid ${on ? dark.accent : dark.border}`}}>
                <span style={{fontSize: 13, fontWeight: 800, color: on ? '#fff' : dark.textPrimary}}>Block {bl.name}</span>
                <span style={{fontSize: 11, fontWeight: 700, color: on ? '#ffffffcc' : dark.textMuted}}>{bl.free}/{bl.slots.length}</span>
              </PressableScale>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '10px 14px', borderRadius: 999, backgroundColor: dark.card, border: `1px solid ${dark.border}`}}>
        {[
          {bg: dark.success + '22', br: dark.success, lbl: 'Free'},
          {bg: dark.cardAlt, br: dark.border, lbl: 'Occupied'},
        ].map(i => (
          <div key={i.lbl} style={{display: 'flex', alignItems: 'center', gap: 5}}>
            <span style={{width: 12, height: 12, borderRadius: 4, border: `1px solid ${i.br}`, backgroundColor: i.bg, display: 'inline-block'}} />
            <span style={{fontSize: 11, fontWeight: 600, color: dark.textSecondary}}>{i.lbl}</span>
          </div>
        ))}
        <div style={{flex: 1}} />
        {currentBlock && <DarkPill label={currentBlock.free > 0 ? `${currentBlock.free} free` : 'Full'} color={currentBlock.free > 0 ? dark.success : dark.danger} />}
      </div>

      {/* One block's grid — compact enough to fit without scrolling. */}
      {!currentBlock ? (
        <div style={{borderRadius: 20, border: `1px dashed ${dark.border}`, padding: 28, textAlign: 'center'}}>
          <div style={{fontSize: 13, fontWeight: 600, color: dark.textMuted}}>No parking slots configured yet</div>
        </div>
      ) : (
        <div style={{...darkCard, padding: 16}}>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-start'}}>
            {currentBlock.slots.map(sl => {
              const free = sl.status === 'free';
              const bg = free ? dark.success + '1c' : dark.cardAlt;
              const tc = free ? dark.success : dark.textMuted;
              return (
                <PressableScale key={sl.id} onClick={() => setPicked(sl.id)}
                  style={{width: 46, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: bg}}>
                  <span style={{fontSize: 12, fontWeight: 800, color: tc}}>{sl.number}</span>
                </PressableScale>
              );
            })}
          </div>
        </div>
      )}

      {/* Slot detail — read-only info sheet, no actions. */}
      {pickedSlot && (
        <div style={{position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)'}} onClick={() => setPicked(undefined)}>
          <div onClick={e => e.stopPropagation()} style={{width: '100%', maxWidth: 480, margin: '0 auto', backgroundColor: dark.card, borderTop: `1px solid ${dark.border}`, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 28, maxHeight: '75vh', overflowY: 'auto'}}>
            <div style={{width: 36, height: 4, borderRadius: 2, backgroundColor: dark.border, margin: '0 auto 18px'}} />
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18}}>
              <div>
                <div style={darkSectionLabel}>SLOT {pickedSlot.id}</div>
                <div style={{fontSize: 19, fontWeight: 900, marginTop: 2, color: dark.textPrimary}}>
                  {pickedSlot.status === 'occupied' ? (pickedOwnerTask?.doctorName ?? pickedSlot.carNumber ?? 'Occupied') : 'Free'}
                </div>
              </div>
              <DarkPill label={pickedSlot.status === 'occupied' ? 'Occupied' : 'Free'} color={pickedSlot.status === 'occupied' ? dark.accent2 : dark.success} />
            </div>

            {pickedSlot.status === 'occupied' ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                {([
                  ['Vehicle', pickedSlot.carNumber || pickedOwnerTask?.carNumber || '—'],
                  ...(pickedOwnerTask?.isVisitor ? [['Type', 'Visitor']] as [string, string][] : []),
                  ...(pickedOwnerTask?.doctorDepartment ? [['Department', pickedOwnerTask.doctorDepartment]] as [string, string][] : []),
                  ...(pickedOwnerTask?.driverName ? [['Driver', pickedOwnerTask.driverName]] as [string, string][] : []),
                  ...(agoLabel(pickedOwnerTask?.completedAt) ? [['Parked', agoLabel(pickedOwnerTask?.completedAt)!]] as [string, string][] : []),
                ]).map(([k, v]) => (
                  <div key={k} style={{display: 'flex', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 12, backgroundColor: dark.cardAlt}}>
                    <span style={{fontSize: 12, fontWeight: 700, color: dark.textMuted}}>{k}</span>
                    <span style={{fontSize: 13, fontWeight: 800, color: dark.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{fontSize: 13, fontWeight: 600, color: dark.textMuted, textAlign: 'center', padding: '12px 0'}}>This slot is free.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
