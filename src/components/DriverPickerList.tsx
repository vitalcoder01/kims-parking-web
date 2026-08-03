import React from 'react';
import {useTheme} from '../context/ThemeContext';
import {Icon} from './Icon';
import {PressableScale} from './PressableScale';
import {Driver} from '../context/AppStateContext';

interface Props {
  drivers: Driver[];
  onAssign: (driverId: number) => void;
  // Set to the driver id being assigned while that call is in flight —
  // disables every row (not just that one) so a second tap, on the same or
  // a different driver, can't fire a second assignDriver call before the
  // first has even resolved. Without this, a fast double-tap could notify
  // one driver and then immediately bump them for another with no
  // confirmation in between.
  assigningId?: number | null;
}

// Shared "pick an available driver" list — same interaction whether it's
// for a fresh park task, a retrieval request, or a visitor pickup. DOM port
// of the mobile app's identically-named component.
export function DriverPickerList({drivers, onAssign, assigningId}: Props) {
  const {colors} = useTheme();
  const disabled = assigningId != null;

  if (drivers.length === 0) {
    return (
      <div style={{borderRadius: 14, border: `1px dashed ${colors.border}`, padding: 24, textAlign: 'center', marginBottom: 16}}>
        <Icon name="timer" size={26} color={colors.textMuted} style={{marginBottom: 8}} />
        <div style={{fontSize: 13, fontWeight: 600, color: colors.textMuted}}>No drivers available right now</div>
      </div>
    );
  }

  return (
    <>
      {drivers.map(d => {
        // "N done today" is real now — nothing computed it before, so every
        // driver read "0 done today" and the least-busy ordering compared 0
        // to 0 on every pair. Undefined means the server didn't send a count,
        // which is different from a genuine zero and must not read as one.
        const done = d.completedToday;
        const load = done == null ? '' : done === 0 ? 'No jobs yet today' : `${done} ${done === 1 ? 'job' : 'jobs'} today`;
        return (
          <PressableScale
            key={d.id}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 12,
              borderRadius: 16, border: `1px solid ${colors.border}`, padding: 14, marginBottom: 10,
              backgroundColor: colors.surface, opacity: disabled ? 0.5 : 1, textAlign: 'left',
            }}
            onClick={() => { if (!disabled) onAssign(d.id); }}
            disabled={disabled}>
            <div style={{width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.primary + '18'}}>
              <span style={{fontSize: 16, fontWeight: 800, color: colors.primary}}>{d.name[0]}</span>
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 15, fontWeight: 800, color: colors.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{d.name}</div>
              {!!load && <div style={{fontSize: 12, fontWeight: 600, marginTop: 2, color: colors.textSecondary}}>{load}</div>}
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: 6, borderRadius: 12, padding: '10px 14px', backgroundColor: colors.primary, flexShrink: 0}}>
              <span style={{fontSize: 13, fontWeight: 700, color: colors.textOnPrimary}}>
                {assigningId === d.id ? 'Assigning…' : 'Assign'}
              </span>
              {assigningId !== d.id && <Icon name="arrowRight" size={14} color={colors.textOnPrimary} />}
            </div>
          </PressableScale>
        );
      })}
    </>
  );
}
