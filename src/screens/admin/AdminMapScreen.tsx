import React, {useState, useMemo, useEffect} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useAppState} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';
import {useAdminOpsTheme, DarkPill} from './adminDarkTheme';

function agoLabel(ms?: number): string | null {
  if (!ms) return null;
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem ? `${hrs} hr ${rem} min ago` : `${hrs} hr ago`;
}

/*
 * Spatial Bay Map & Occupancy Workstation —
 * Realtime read-only oversight of parking blocks, slots, occupancy ratios,
 * and bay-level vehicle telemetries.
 */
export function AdminMapScreen({focusBlock, searchQuery = ''}: {focusBlock?: string; searchQuery?: string} = {}) {
  const dark = useAdminOpsTheme();
  const {slots, tasks, visitors} = useAppState();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [activeBlock, setActiveBlock] = useState<string | undefined>(focusBlock);

  useEffect(() => {
    if (focusBlock) setActiveBlock(focusBlock);
  }, [focusBlock]);

  useEffect(() => {
    if (!searchQuery?.trim()) return;
    const q = searchQuery.trim().toLowerCase();
    const match = slots.find(s =>
      s.id.toLowerCase().includes(q) ||
      s.block.toLowerCase() === q ||
      (s.carNumber && s.carNumber.toLowerCase().includes(q))
    );
    if (match) {
      setActiveBlock(match.block);
      setPicked(match.id);
    }
  }, [searchQuery, slots]);

  const pickedSlot = picked ? slots.find(sl => sl.id === picked) : undefined;
  const pickedOwnerTask = pickedSlot?.taskId
    ? tasks.find(t => t.id === pickedSlot.taskId)
    : tasks.find(t => t.slotId === pickedSlot?.id && t.status !== 'completed' && t.status !== 'cancelled');
  const pickedVisitor = !pickedOwnerTask && pickedSlot
    ? visitors.find(v => v.slotId === pickedSlot.id && v.status === 'parked')
    : undefined;

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

  useEffect(() => {
    if (!activeBlock && blocks.length > 0) setActiveBlock(blocks[0].name);
  }, [blocks, activeBlock]);

  const currentBlock = blocks.find(b => b.name === activeBlock);
  const occupied = slots.filter(sl => sl.status === 'occupied').length;
  const total = slots.length;
  const available = total - occupied;
  const occupancyPct = total ? Math.round((occupied / total) * 100) : 0;

  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: '16px 14px 48px'}}>
      {/* ── Workstation Top Header ── */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 16,
        backgroundColor: dark.card,
        border: `1px solid ${dark.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: `${dark.accent}1F`,
            border: `1px solid ${dark.accent}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="map" size={19} color={dark.accent} />
          </div>
          <div style={{minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 13, fontWeight: 900, color: dark.textPrimary, letterSpacing: -0.2, textTransform: 'uppercase'}}>
                Spatial Bay Map
              </span>
              <span style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: dark.accent2,
                padding: '2px 6px',
                borderRadius: 999,
                backgroundColor: `${dark.accent2}1A`,
                border: `1px solid ${dark.accent2}33`,
              }}>
                LIVE SENSORS
              </span>
            </div>
            <div style={{fontSize: 10.5, fontWeight: 600, color: dark.textMuted, marginTop: 1}}>
              KIMS Hospital Realtime Parking Grid
            </div>
          </div>
        </div>

        {/* Capacity Pill */}
        <div style={{
          padding: '6px 12px',
          borderRadius: 10,
          backgroundColor: dark.surface,
          border: `1px solid ${dark.border}`,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          <div style={{fontSize: 13, fontWeight: 900, color: dark.success, fontVariantNumeric: 'tabular-nums'}}>
            {available} FREE
          </div>
          <div style={{fontSize: 9, fontWeight: 700, color: dark.textMuted, textTransform: 'uppercase'}}>
            OF {total} BAYS
          </div>
        </div>
      </div>

      {/* ── Overall Occupancy Telemetry Card ── */}
      <div style={{
        borderRadius: 18,
        padding: '18px 20px',
        marginBottom: 12,
        backgroundColor: dark.card,
        border: `1px solid ${dark.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Subtle Ambient Radial Highlight */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: `${dark.accent}14`,
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }} />

        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
              color: dark.textMuted,
              textTransform: 'uppercase',
            }}>
              OVERALL FACILITY OCCUPANCY
            </div>
            <div style={{
              fontSize: 28,
              fontWeight: 900,
              color: dark.textPrimary,
              marginTop: 4,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.5,
            }}>
              {occupied}
              <span style={{fontSize: 16, fontWeight: 700, color: dark.textMuted}}> / {total} bays</span>
            </div>
          </div>

          <div style={{textAlign: 'right'}}>
            <div style={{
              fontSize: 26,
              fontWeight: 900,
              color: occupancyPct > 85 ? dark.danger : occupancyPct > 65 ? dark.warning : dark.accent,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.5,
            }}>
              {occupancyPct}%
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: dark.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              CAPACITY IN USE
            </div>
          </div>
        </div>

        {/* Linear Utilization Track */}
        <div style={{
          marginTop: 14,
          height: 6,
          borderRadius: 3,
          backgroundColor: dark.surface,
          overflow: 'hidden',
          display: 'flex',
        }}>
          <div style={{
            width: `${occupancyPct}%`,
            height: '100%',
            backgroundColor: occupancyPct > 85 ? dark.danger : occupancyPct > 65 ? dark.warning : dark.accent,
            borderRadius: 3,
            transition: 'width 0.4s ease',
          }} />
        </div>
      </div>

      {/* ── Block Selector Scroller Ribbon ── */}
      {blocks.length > 1 && (
        <div className="hscroll" style={{gap: 6, marginBottom: 12}}>
          {blocks.map(bl => {
            const on = bl.name === activeBlock;
            return (
              <PressableScale
                key={bl.name}
                onClick={() => { setActiveBlock(bl.name); setPicked(undefined); }}
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  borderRadius: 999,
                  backgroundColor: on ? dark.accent : dark.card,
                  border: `1px solid ${on ? dark.accent : dark.border}`,
                  boxShadow: on ? `0 2px 10px ${dark.accent}33` : 'none',
                  cursor: 'pointer',
                }}>
                <span style={{fontSize: 12.5, fontWeight: 800, color: on ? '#fff' : dark.textPrimary}}>
                  Block {bl.name}
                </span>
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: on ? '#ffffffcc' : dark.textMuted,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {bl.free}/{bl.slots.length}
                </span>
              </PressableScale>
            );
          })}
        </div>
      )}

      {/* ── Legend Ribbon & Active Block Status ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
        padding: '9px 14px',
        borderRadius: 14,
        backgroundColor: dark.card,
        border: `1px solid ${dark.border}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        {[
          {bg: `${dark.success}22`, br: dark.success, lbl: 'Free Bay'},
          {bg: `${dark.border}44`, br: dark.border, lbl: 'Occupied'},
        ].map(i => (
          <div key={i.lbl} style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              border: `1px solid ${i.br}`,
              backgroundColor: i.bg,
              display: 'inline-block',
            }} />
            <span style={{fontSize: 11, fontWeight: 700, color: dark.textSecondary}}>{i.lbl}</span>
          </div>
        ))}

        <div style={{flex: 1}} />

        {currentBlock && (
          <DarkPill
            label={currentBlock.free > 0 ? `${currentBlock.free} BAYS AVAILABLE` : 'BLOCK AT CAPACITY'}
            color={currentBlock.free > 0 ? dark.success : dark.danger}
          />
        )}
      </div>

      {/* ── Active Block Bay Grid ── */}
      {!currentBlock ? (
        <div style={{
          borderRadius: 18,
          border: `1px dashed ${dark.border}`,
          padding: '36px 20px',
          textAlign: 'center',
          backgroundColor: dark.card,
        }}>
          <Icon name="map" size={24} color={dark.textMuted} />
          <div style={{fontSize: 13, fontWeight: 700, color: dark.textMuted, marginTop: 6}}>
            No parking bays configured in this block.
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: 18,
          border: `1px solid ${dark.border}`,
          backgroundColor: dark.card,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: 16,
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
            gap: 8,
          }}>
            {currentBlock.slots.map(sl => {
              const free = sl.status === 'free';
              const isSelected = sl.id === picked;
              const bg = free ? `${dark.success}1A` : dark.surface;
              const br = isSelected
                ? dark.accent
                : free
                ? `${dark.success}44`
                : dark.border;
              const tc = free ? dark.success : dark.textMuted;

              return (
                <PressableScale
                  key={sl.id}
                  onClick={() => setPicked(sl.id)}
                  style={{
                    height: 48,
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: bg,
                    border: `1px solid ${br}`,
                    boxShadow: isSelected ? `0 0 10px ${dark.accent}66` : 'none',
                    cursor: 'pointer',
                  }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: tc,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {sl.number}
                  </span>
                  <span style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    color: tc,
                    opacity: 0.8,
                    letterSpacing: 0.3,
                  }}>
                    {free ? 'OPEN' : 'PARKED'}
                  </span>
                </PressableScale>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Slot Detail Drawer Sheet (Read-Only) ── */}
      {pickedSlot && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={() => setPicked(undefined)}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 480,
              margin: '0 auto',
              backgroundColor: dark.card,
              borderTop: `1px solid ${dark.border}`,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: '20px 20px 32px',
              maxHeight: '75vh',
              overflowY: 'auto',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)',
            }}>
            {/* Grab Handle */}
            <div style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: `${dark.border}88`,
              margin: '0 auto 16px',
            }} />

            {/* Sheet Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 18,
            }}>
              <div>
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 1,
                  color: dark.textMuted,
                  textTransform: 'uppercase',
                }}>
                  BAY IDENTIFIER {pickedSlot.id}
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 900,
                  marginTop: 2,
                  color: dark.textPrimary,
                  fontFamily: 'monospace',
                }}>
                  {pickedSlot.status === 'occupied'
                    ? (pickedOwnerTask?.doctorName ?? pickedVisitor?.name ?? pickedSlot.carNumber ?? 'OCCUPIED')
                    : 'AVAILABLE BAY'}
                </div>
              </div>

              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <DarkPill
                  label={pickedSlot.status === 'occupied' ? 'OCCUPIED' : 'FREE'}
                  color={pickedSlot.status === 'occupied' ? dark.accent2 : dark.success}
                />
                <PressableScale
                  onClick={() => setPicked(undefined)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: dark.surface,
                    border: `1px solid ${dark.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Icon name="close" size={14} color={dark.textPrimary} />
                </PressableScale>
              </div>
            </div>

            {/* Slot Content */}
            {pickedSlot.status === 'occupied' ? (
              <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                {([
                  ['Vehicle Plate', pickedSlot.carNumber || pickedOwnerTask?.carNumber || pickedVisitor?.carNumber || '—'],
                  ...((pickedOwnerTask?.isVisitor || pickedVisitor) ? [['Pass Classification', 'Visitor Valet Pass']] as [string, string][] : []),
                  ...(pickedVisitor?.mobile ? [['Visitor Mobile', pickedVisitor.mobile]] as [string, string][] : []),
                  ...(pickedVisitor?.vehicleType ? [['Vehicle Type', pickedVisitor.vehicleType.toUpperCase()]] as [string, string][] : []),
                  ...(pickedOwnerTask?.doctorDepartment ? [['Hospital Department', pickedOwnerTask.doctorDepartment]] as [string, string][] : []),
                  ...((pickedOwnerTask?.driverName || pickedVisitor?.driverName) ? [['Assigned Runner', pickedOwnerTask?.driverName || pickedVisitor?.driverName || '']] as [string, string][] : []),
                  ...(agoLabel(pickedOwnerTask?.completedAt) ? [['Parked Timestamp', agoLabel(pickedOwnerTask?.completedAt)!]] as [string, string][] : []),
                ]).map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '11px 14px',
                      borderRadius: 12,
                      backgroundColor: dark.surface,
                      border: `1px solid ${dark.border}`,
                    }}>
                    <span style={{fontSize: 12, fontWeight: 700, color: dark.textMuted}}>{k}</span>
                    <span style={{
                      fontSize: 13,
                      fontWeight: 800,
                      color: dark.textPrimary,
                      fontFamily: k.includes('Plate') ? 'monospace' : 'inherit',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{
                borderRadius: 14,
                padding: '24px 16px',
                textAlign: 'center',
                backgroundColor: `${dark.success}10`,
                border: `1px solid ${dark.success}25`,
              }}>
                <Icon name="check" size={24} color={dark.success} />
                <div style={{fontSize: 13, fontWeight: 800, color: dark.success, marginTop: 6}}>
                  Bay is currently empty and available for incoming vehicles.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
