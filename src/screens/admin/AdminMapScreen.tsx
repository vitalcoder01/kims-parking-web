import React, {useState, useMemo} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useTheme} from '../../context/ThemeContext';
import {useAppState} from '../../context/AppStateContext';
import {Icon} from '../../components/Icon';

// Direct port of the mobile app's ParkingMapScreen (admin's "Live Map" tab —
// actually a slot occupancy grid, not a GPS map).
export function AdminMapScreen() {
  const {colors} = useTheme();
  const {slots} = useAppState();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const pickedSlot = picked ? slots.find(sl => sl.id === picked) : undefined;

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
      {/* Occupancy summary */}
      <div style={{borderRadius: 20, padding: 18, marginBottom: 16, backgroundColor: colors.primary}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14}}>
          <div>
            <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: colors.textOnPrimary + '99'}}>OCCUPANCY</div>
            <div style={{fontSize: 30, fontWeight: 900, marginTop: 2, color: colors.textOnPrimary}}>
              {occupied}<span style={{fontSize: 18, fontWeight: 700, color: colors.textOnPrimary + '88'}}> / {total}</span>
            </div>
          </div>
          <div style={{textAlign: 'right'}}>
            <div style={{fontSize: 24, fontWeight: 900, color: colors.textOnPrimary}}>{occupancyPct}%</div>
            <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: colors.textOnPrimary + '99'}}>{available} FREE</div>
          </div>
        </div>
        <div style={{height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.2)'}}>
          <div style={{height: '100%', borderRadius: 4, width: `${occupancyPct}%`, backgroundColor: colors.textOnPrimary, transition: 'width 0.4s ease'}} />
        </div>
      </div>

      {/* Legend */}
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '0 2px'}}>
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
        {pickedSlot && (
          <div style={{display: 'flex', alignItems: 'center', gap: 4, borderRadius: 10, border: `1.5px solid ${colors.textPrimary}`, padding: '5px 10px', backgroundColor: colors.surface}}>
            <Icon name="pin" size={12} color={colors.textPrimary} />
            <span style={{fontSize: 11, fontWeight: 800, color: colors.textPrimary}}>{pickedSlot.id}{pickedSlot.carNumber ? ` · ${pickedSlot.carNumber}` : ''}</span>
          </div>
        )}
      </div>

      {/* Blocks */}
      {blocks.length === 0 ? (
        <div style={{borderRadius: 14, border: `1px dashed ${colors.border}`, padding: 24, textAlign: 'center'}}>
          <Icon name="parking" size={26} color={colors.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: 8, color: colors.textMuted}}>No parking slots configured yet</div>
        </div>
      ) : blocks.map(bl => (
        <div key={bl.name} style={{borderRadius: 18, border: `1px solid ${colors.border}`, marginBottom: 14, overflow: 'hidden', backgroundColor: colors.surface}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10, padding: 14, borderBottom: `1px solid ${colors.divider}`}}>
            <div style={{width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}>
              <span style={{fontSize: 14, fontWeight: 900, color: colors.textPrimary}}>{bl.name}</span>
            </div>
            <span style={{flex: 1, fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>Block {bl.name}</span>
            <span style={{fontSize: 12, fontWeight: 700, color: bl.free > 0 ? colors.success : colors.error}}>{bl.free > 0 ? `${bl.free} free` : 'Full'}</span>
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
                  onClick={() => setPicked(sl.id)}
                  style={{width: 44, height: 40, borderRadius: 10, border: `2px solid ${isSel ? colors.textPrimary : 'transparent'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: bg}}
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
