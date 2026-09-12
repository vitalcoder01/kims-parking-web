import React from 'react';
import {PressableScale} from '../components/PressableScale';
import {useTheme} from '../context/ThemeContext';
import {ParkingTask} from '../context/AppStateContext';
import {Icon} from '../components/Icon';

// No driver GPS any more (drivers don't get an app at all — see the
// two-station handoff model's follow-up: valets assign a driver, confirm
// each end themselves, and that's the whole trip). This used to be a live
// Leaflet map with a moving car marker, an ETA, and a distance-remaining
// readout, all computed from a continuous GPS feed. With no feed, that map
// would show a permanent "Waiting for driver's location…" badge that never
// resolves — worse than no map at all. Replaced with what the task record
// actually still has: real status transitions with real timestamps, pushed
// live over the same socket this screen already re-renders from — "LIVE"
// still means something, it's just a status feed now, not a position one.

// How many of the 3 checklist steps (Key Collected / In Transit /
// Parked-or-Delivered) are done, purely from the task's real status. A job
// now skips 'in_transit' entirely (nothing left to advance it there without
// GPS — see task.service.js's widened assertTransition), so this is a
// threshold check, not an exact match: reaching the final status marks
// every earlier step done too, which is the correct picture for a trip
// that had no separate "en route" stage to actually observe.
const STAGE_ORDER: Record<string, number> = {
  requested: -1,
  assigned: -1,
  key_collected: 0,
  in_transit: 1,
  delivered: 2,
  completed: 2,
};

function fmtTime(iso?: string | number | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'});
}

interface Props {
  task?: ParkingTask;
  onBack?: () => void;
}

export function LiveTrackingScreen({task, onBack}: Props) {
  const {colors} = useTheme();

  // 'delivered' (retrieve trips only) already means the car physically
  // arrived at the valet counter — the trip visually "arrives" there.
  const arrived = task?.status === 'completed' || task?.status === 'delivered';

  if (!task) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, gap: 8, backgroundColor: colors.background,
      }}>
        <Icon name="parking" size={40} color={colors.textMuted} style={{marginBottom: 8}} />
        <div style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary}}>No Active Task</div>
        <div style={{fontSize: 13, textAlign: 'center', lineHeight: '19px', color: colors.textMuted}}>
          Tracking will appear here once you have an assigned task.
        </div>
      </div>
    );
  }

  // Each checklist step's real timestamp, where one exists. 'In Transit'
  // has none of its own any more (see STAGE_ORDER's comment) — it just
  // inherits "done" from whichever later step actually happened.
  const stepTimes: (string | null)[] = [
    fmtTime(task.keyCollectedAt),
    null,
    fmtTime(task.type === 'park' ? task.completedAt : task.deliveredAt),
  ];

  return (
    <div style={{flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: colors.background, minHeight: 0}}>
      {onBack && (
        <div style={{display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px 4px'}}>
          <PressableScale
            onClick={onBack}
            style={{
              width: 42, height: 42, borderRadius: 21, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.surface, border: `1px solid ${colors.border}`,
            }}>
            <Icon name="back" size={20} color={colors.textPrimary} />
          </PressableScale>
          {!arrived && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              borderRadius: 20, padding: '6px 12px', backgroundColor: colors.error,
            }}>
              <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff'}} />
              <span style={{color: '#fff', fontSize: 11, fontWeight: 900, letterSpacing: 1}}>LIVE</span>
            </div>
          )}
        </div>
      )}

      <div style={{flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px 32px'}}>
        <div style={{
          borderRadius: 28, padding: '8px 20px 28px', backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
        }}>
          {arrived ? (
            <div style={{display: 'flex', alignItems: 'center', gap: 14, padding: '20px 0 8px'}}>
              <div style={{
                width: 52, height: 52, borderRadius: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: colors.successLight,
              }}>
                <Icon name="check" size={24} color={colors.success} />
              </div>
              <div>
                <div style={{fontSize: 17, fontWeight: 800, color: colors.success}}>
                  {task.type === 'park'
                    ? 'Car Parked Successfully!'
                    : task.status === 'delivered'
                    ? 'Car Has Arrived!'
                    : 'Car Retrieved!'}
                </div>
                <div style={{fontSize: 12, marginTop: 4, color: colors.textMuted}}>
                  {task.type === 'retrieve'
                    ? (task.status === 'delivered' ? 'Please collect it at the entrance' : 'Delivered to you')
                    : task.slotId ? `Slot: ${task.slotId}` : 'Delivered to valet counter'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{padding: '20px 0 4px'}}>
              <div style={{fontSize: 17, fontWeight: 800, color: colors.textPrimary}}>
                {task.type === 'park' ? 'Parking your car' : 'Retrieving your car'}
              </div>
              <div style={{fontSize: 12, marginTop: 3, color: colors.textMuted}}>
                {task.carNumber ?? 'Vehicle'} · {task.driverName ?? 'Driver assigned'}
              </div>
            </div>
          )}

          <div style={{display: 'flex', alignItems: 'flex-start', margin: '20px 0 16px'}}>
            {['Key Collected', 'In Transit', task.type === 'park' ? 'Parked' : 'Delivered'].map((step, i) => {
              const done = (STAGE_ORDER[task.status ?? ''] ?? -1) >= i;
              return (
                <div key={step} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative'}}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14, marginBottom: 6, zIndex: 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: done ? colors.success : colors.border,
                  }}>
                    {done && <Icon name="checkBold" size={12} color="#fff" />}
                  </div>
                  <div style={{fontSize: 10, fontWeight: 700, textAlign: 'center', color: done ? colors.textPrimary : colors.textMuted}}>{step}</div>
                  {done && stepTimes[i] && (
                    <div style={{fontSize: 9, fontWeight: 600, marginTop: 2, color: colors.textMuted}}>{stepTimes[i]}</div>
                  )}
                  {i < 2 && (
                    <div style={{
                      position: 'absolute', top: 14, left: '50%', width: '100%', height: 2,
                      backgroundColor: done ? colors.success : colors.border,
                    }} />
                  )}
                </div>
              );
            })}
          </div>

          {task.slotId && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              borderRadius: 12, border: `1px solid ${colors.primary}30`, padding: 12,
              backgroundColor: colors.primary + '12',
            }}>
              <Icon name={task.type === 'retrieve' ? 'pin' : 'parking'} size={14} color={colors.primary} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.primary}}>
                {task.type === 'retrieve' ? 'Retrieving from' : 'Destination'}: <b style={{fontWeight: 900}}>{task.slotId}</b>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
