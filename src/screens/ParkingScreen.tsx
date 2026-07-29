import React, {useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {useAuth} from '../context/AuthContext';
import {useAppState} from '../context/AppStateContext';
import {useRetrievalRequest} from '../hooks/useRetrievalRequest';
import {Badge} from '../components/Badge';
import {LiveTrackingScreen} from './LiveTrackingScreen';
import {Icon} from '../components/Icon';
import {PressableScale} from '../components/PressableScale';

function formatDuration(sinceMs: number) {
  const mins = Math.max(0, Math.round((Date.now() - sinceMs) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}min` : `${m} min`;
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
}

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function ParkingScreen() {
  const {colors} = useTheme();
  const {user} = useAuth();
  const {tasks} = useAppState();
  const {activeRetrieve, remainingSeconds} = useRetrievalRequest();
  const [showTracking, setShowTracking] = useState(false);

  // `tasks` only ever contains this doctor's single current session — no
  // more "active vs latest" search needed.
  const rawTask = tasks.find(t => t.doctorId === user?.id);
  const task = rawTask?.status === 'cancelled' ? undefined : rawTask;
  const isParked = task?.status === 'completed' && task.type === 'park';

  if (showTracking && activeRetrieve) {
    return <LiveTrackingScreen task={activeRetrieve} onBack={() => setShowTracking(false)} />;
  }

  // 'delivered' — car's back at the counter but the valet hasn't confirmed
  // handover yet; that's still "come get it," not "already done."
  const justRetrieved = task?.type === 'retrieve' && task.status === 'delivered';

  if (!task || !task.slotId || justRetrieved) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 40, gap: 8, backgroundColor: colors.background,
      }}>
        <Icon name={justRetrieved ? 'car' : 'parking'} size={40} color={colors.textMuted} />
        <div style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary}}>{justRetrieved ? 'Car Ready at Entrance' : 'No Active Parking Session'}</div>
        <div style={{fontSize: 13, textAlign: 'center', lineHeight: '19px', color: colors.textMuted}}>
          {justRetrieved ? 'Please collect your vehicle at the gate.' : 'Hand your keys to the valet at the entrance to get started.'}
        </div>
      </div>
    );
  }

  const vehicleRows: [string, string][] = [
    ['Reg. Number', task.carNumber],
    ['Parked By',   task.driverName ?? 'Unassigned'],
    ['Location',    task.slotId],
    ...(task.completedAt ? [['Duration', formatDuration(task.completedAt)] as [string, string]] : []),
  ];

  const secStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase',
    marginBottom: 8, marginTop: 10, color: colors.textMuted,
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40}}>

      {/* Session strip */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}>
        <span style={{fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.textMuted}}>
          SESSION · {task.carNumber}
        </span>
        <Badge label={isParked ? 'Parked' : 'In Progress'} variant={isParked ? 'success' : 'warning'} dot />
      </div>

      {/* Slot hero — neutral surface tint, matching the app's monochrome brand */}
      <div style={{
        borderBottom: `1px solid ${colors.border}`, padding: '28px 16px 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        backgroundColor: colors.cardAlt,
      }}>
        <div style={{fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10, color: colors.textMuted}}>PARKING SLOT</div>
        <div style={{fontSize: 64, fontWeight: 900, letterSpacing: -2, lineHeight: '68px', color: colors.textPrimary}}>{task.slotId}</div>
        {task.completedAt && (
          <div style={{fontSize: 12, marginTop: 8, color: colors.textSecondary}}>Parked at {formatTime(task.completedAt)}</div>
        )}
        <div style={{width: 40, height: 3, borderRadius: 2, marginTop: 18, backgroundColor: colors.textPrimary}} />
      </div>

      <div style={{padding: 16}}>

        {/* Vehicle info */}
        <div style={secStyle}>VEHICLE INFO</div>
        <div style={{borderRadius: 18, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 4, backgroundColor: colors.card}}>
          {vehicleRows.map(([lbl, val], i) => (
            <div
              key={lbl}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 14px',
                borderBottom: i === vehicleRows.length - 1 ? 'none' : `1px solid ${colors.divider}`,
              }}>
              <span style={{fontSize: 12, color: colors.textSecondary}}>{lbl}</span>
              <span style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>{val}</span>
            </div>
          ))}
        </div>

        {/* Requesting retrieval lives on the Home tab only. */}
        {isParked && !activeRetrieve && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14,
            border: `1px solid ${colors.primary}2A`, padding: 14, marginBottom: 4, marginTop: 12,
            backgroundColor: colors.primary + '0C',
          }}>
            <Icon name="info" size={18} color={colors.primary} />
            <span style={{flex: 1, fontSize: 13, lineHeight: '18px', color: colors.textSecondary}}>
              Ready to leave? Request your car from the <b style={{fontWeight: 800, color: colors.textPrimary}}>Home</b> tab.
            </span>
          </div>
        )}

        {/* Live retrieval status — same backend-tracked state as Home. */}
        {activeRetrieve && (
          <>
            <div style={secStyle}>RETRIEVAL STATUS</div>
            <div style={{borderRadius: 18, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 4, backgroundColor: colors.card}}>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 24, gap: 4}}>
                {remainingSeconds != null ? (
                  <>
                    <div style={{fontSize: 40, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: colors.primary}}>{formatCountdown(remainingSeconds)}</div>
                    <div style={{fontSize: 11, fontWeight: 600, marginBottom: 4, color: colors.textMuted}}>until requested departure</div>
                  </>
                ) : (
                  <div style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>Retrieval requested</div>
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, borderTop: `1px solid ${colors.divider}`,
                  paddingTop: 16, marginTop: 12, alignSelf: 'stretch',
                }}>
                  <Icon
                    name={activeRetrieve.status === 'requested' ? 'timer' : activeRetrieve.status === 'assigned' ? 'bell' : 'car'}
                    size={18} color={colors.textSecondary}
                  />
                  <span style={{flex: 1, fontSize: 13, fontWeight: 700, textAlign: 'left', color: colors.textSecondary}}>
                    {activeRetrieve.status === 'requested' && 'Waiting for valet to assign a driver'}
                    {activeRetrieve.status === 'assigned' && `${activeRetrieve.driverName ?? 'A driver'} assigned — heading to your car`}
                    {activeRetrieve.status === 'in_transit' && `${activeRetrieve.driverName ?? 'Driver'} is bringing your car to you`}
                  </span>
                </div>
                {activeRetrieve.status === 'in_transit' && (
                  <PressableScale
                    onClick={() => setShowTracking(true)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      margin: '8px 14px 0', borderRadius: 14, padding: '15px 0', alignSelf: 'stretch',
                      backgroundColor: colors.primary,
                      boxShadow: `0 6px 12px ${colors.shadow}`,
                    }}>
                    <Icon name="map" size={16} color={colors.textOnPrimary} />
                    <span style={{fontSize: 14, fontWeight: 900, color: colors.textOnPrimary}}>View Live Tracking Map</span>
                  </PressableScale>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
