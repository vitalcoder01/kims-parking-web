import React, {useState} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useAppState} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {LiveTrackingScreen} from './LiveTrackingScreen';
import {useRetrievalRequest} from '../hooks/useRetrievalRequest';
import {BRAND_GRADIENT, BRAND_GRADIENT_DARK, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';

const ETA_OPTIONS = [10, 20, 30, 40];

export function DoctorHomeScreen({onOpenCard}: {onOpenCard: () => void}) {
  const {user} = useAuth();
  const {tasks} = useAppState();
  const {colors, isDark} = useTheme();
  const {activeRetrieve, remainingSeconds, requestRetrieval} = useRetrievalRequest();
  const [selectedEta, setSelectedEta]   = useState<number | null>(null);
  const [requesting, setRequesting]     = useState(false);
  const [showTracking, setShowTracking] = useState(false);

  // `tasks` comes back from the backend newest-first (createdAt desc) — the
  // most recent task for this doctor is index 0.
  const myTasks   = tasks.filter(t => t.doctorId === user?.id);
  const activeTask = myTasks.find(t => t.status !== 'completed');
  const latestTask = myTasks[0];
  const displayTask = activeTask ?? latestTask;
  const carIsParked = displayTask?.type === 'park' && displayTask.status === 'completed';
  // 'delivered' — driver's brought the car back to the valet counter, but
  // the valet hasn't confirmed handover yet.
  const carJustRetrieved = displayTask?.type === 'retrieve' && displayTask.status === 'delivered';

  const handleDeparture = async () => {
    if (!selectedEta) return;
    setRequesting(true);
    try {
      await requestRetrieval(selectedEta);
    } catch (err: any) {
      window.alert(err.message || 'Could not request retrieval');
    } finally {
      setRequesting(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;
  const fmtClock = (ms: number) => new Date(ms).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});

  // 'assigned' is the task's status from the moment it's *created* — whether
  // a driver has been picked is driverId being set, not the status string.
  const statusMap: Record<string,{label:string;color:string}> = {
    assigned:      {label: 'Driver Assigned',      color: colors.warning},
    key_collected: {label: 'Key Collected',         color: colors.info},
    in_transit:    {label: activeTask?.type === 'retrieve' ? 'En Route to You' : 'En Route to Parking', color: colors.primary},
    delivered:     {label: 'Car Arrived — Confirm at Counter', color: colors.success},
    completed:     {label: 'Safely Parked',         color: colors.success},
  };
  const statusInfo = activeTask
    ? (activeTask.status === 'assigned' && !activeTask.driverId
        ? {label: 'Awaiting Driver', color: colors.textMuted}
        : statusMap[activeTask.status])
    : null;

  if (showTracking && displayTask) {
    return <LiveTrackingScreen task={displayTask} onBack={() => setShowTracking(false)} />;
  }

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40}}>

      {/* Gradient header */}
      <div style={{
        background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT),
        padding: '20px 20px 32px',
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div style={{flex: 1}}>
            <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 500}}>Good day,</div>
            <div style={{color: '#fff', fontSize: 22, fontWeight: 900, marginTop: 2}}>{user?.name}</div>
            <div style={{color: 'rgba(255,255,255,0.65)', fontSize: 12, marginTop: 2}}>{user?.department}</div>
          </div>
          <PressableScale
            onClick={onOpenCard}
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 16, padding: '10px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.25)',
            }}>
            <span style={{color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: 6}}>{user?.cardCode ?? '---'}</span>
            <span style={{display: 'flex', alignItems: 'center', gap: 2, marginTop: 2}}>
              <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: 700, letterSpacing: 1.5}}>VALET CODE</span>
              <Icon name="chevronRight" size={11} color="rgba(255,255,255,0.7)" />
            </span>
          </PressableScale>
        </div>
      </div>

      <div style={{padding: '20px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12}}>
        {/* Car Status Card */}
        <div style={{borderRadius: 20, border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.surface}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 12px'}}>
            <span style={{fontSize: 15, fontWeight: 800, color: colors.textPrimary}}>Vehicle Status</span>
            {statusInfo && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 20,
                border: `1px solid ${statusInfo.color}40`, padding: '4px 10px',
                backgroundColor: statusInfo.color + '18',
              }}>
                <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: statusInfo.color}} />
                <span style={{fontSize: 11, fontWeight: 700, color: statusInfo.color}}>{statusInfo.label}</span>
              </span>
            )}
          </div>

          {displayTask ? (
            <>
              {carIsParked && displayTask.slotId && (
                <div style={{
                  background: isDark ? 'linear-gradient(90deg,#162040,#1C2A50)' : 'linear-gradient(90deg,#EEF2FF,#DBEAFE)',
                  padding: 16, margin: '0 16px 12px', borderRadius: 14,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <span style={{fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: colors.textMuted}}>PARKED AT SLOT</span>
                  <span style={{fontSize: 36, fontWeight: 900, marginTop: 2, color: colors.primary}}>{displayTask.slotId}</span>
                </div>
              )}
              {carJustRetrieved && (
                <div style={{
                  background: isDark ? 'linear-gradient(90deg,#0D2A1C,#0F3323)' : 'linear-gradient(90deg,#ECFDF5,#D1FAE5)',
                  padding: 16, margin: '0 16px 12px', borderRadius: 14,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                }}>
                  <span style={{display: 'flex', alignItems: 'center', gap: 6}}>
                    <Icon name="car" size={13} color={colors.success} />
                    <span style={{fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: colors.success}}>CAR READY AT ENTRANCE</span>
                  </span>
                  <span style={{fontSize: 22, fontWeight: 900, marginTop: 2, color: colors.success}}>Please collect at the gate</span>
                </div>
              )}
              <div style={{display: 'flex', borderTop: '1px solid rgba(0,0,0,0.05)'}}>
                {[
                  {label: 'Vehicle', value: displayTask.carNumber ?? '—'},
                  {label: 'Driver', value: displayTask.driverName ?? 'Unassigned'},
                ].map(m => (
                  <div key={m.label} style={{flex: 1, padding: 14, border: `0px solid ${colors.border}`}}>
                    <div style={{fontSize: 9, fontWeight: 700, letterSpacing: 1, marginBottom: 4, color: colors.textMuted}}>{m.label.toUpperCase()}</div>
                    <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>{m.value}</div>
                  </div>
                ))}
              </div>
              {!carJustRetrieved && (
                <PressableScale
                  onClick={() => setShowTracking(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    margin: '4px 12px 12px', borderRadius: 12,
                    border: `1px solid ${colors.primary}30`, padding: 12,
                    backgroundColor: colors.primary + '10',
                    width: 'calc(100% - 24px)',
                  }}>
                  <Icon name="map" size={18} color={colors.primary} />
                  <span style={{flex: 1, fontSize: 13, fontWeight: 700, textAlign: 'left', color: colors.primary}}>View Live Tracking Map</span>
                  <Icon name="arrowRight" size={18} color={colors.primary} />
                </PressableScale>
              )}
            </>
          ) : (
            <div style={{
              margin: 16, borderRadius: 14, border: `1px dashed ${colors.border}`, padding: 28,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}>
              <Icon name="carSide" size={40} color={colors.textMuted} />
              <div style={{fontSize: 13, textAlign: 'center', lineHeight: '19px', color: colors.textMuted, whiteSpace: 'pre-line'}}>
                {'No active parking session.\nHand your keys to the valet at the entrance.'}
              </div>
            </div>
          )}
        </div>

        {/* Departure — only offered while the car is actually parked and
            waiting; once a retrieval is requested there's nothing more to ask. */}
        {carIsParked && !activeRetrieve && (
          <div style={{borderRadius: 20, border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.surface}}>
            <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT, '90deg'), padding: 18}}>
              <div style={{color: '#fff', fontSize: 17, fontWeight: 900}}>Ready to Leave?</div>
              <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3}}>Valet will assign a driver to bring your car to you</div>
            </div>
            <div style={{padding: 16}}>
              <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12, color: colors.textMuted}}>WHEN DO YOU NEED YOUR CAR?</div>
              <div style={{display: 'flex', gap: 10}}>
                {ETA_OPTIONS.map(opt => {
                  const on = selectedEta === opt;
                  return (
                    <PressableScale
                      key={opt}
                      onClick={() => setSelectedEta(opt)}
                      disabled={requesting}
                      style={{
                        flex: 1, borderRadius: 14, padding: '16px 0',
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        border: `1.5px solid ${on ? colors.textPrimary : colors.border}`,
                        backgroundColor: on ? colors.textPrimary : colors.cardAlt,
                      }}>
                      <span style={{fontSize: 22, fontWeight: 900, lineHeight: '26px', color: on ? colors.background : colors.textPrimary}}>{opt}</span>
                      <span style={{fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3, color: on ? colors.background + 'AA' : colors.textMuted}}>min</span>
                    </PressableScale>
                  );
                })}
              </div>

              {selectedEta != null && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderRadius: 14, border: `1px solid ${colors.success}30`, padding: 14, marginTop: 14,
                  backgroundColor: colors.success + '10',
                }}>
                  <div>
                    <div style={{fontSize: 10, fontWeight: 600, color: colors.textMuted}}>Car ready by</div>
                    <div style={{fontSize: 22, fontWeight: 900, marginTop: 2, color: colors.success}}>{fmtClock(Date.now() + selectedEta * 60000)}</div>
                  </div>
                  <Icon name="car" size={24} color={colors.success} />
                </div>
              )}

              <PressableScale
                onClick={handleDeparture}
                disabled={!selectedEta || requesting}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  borderRadius: 14, padding: '15px 0', marginTop: 14, width: '100%',
                  backgroundColor: selectedEta ? colors.primary : colors.border,
                  opacity: requesting ? 0.6 : 1,
                }}>
                <span style={{fontSize: 14, fontWeight: 900, color: selectedEta ? colors.textOnPrimary : colors.textMuted}}>
                  {requesting ? 'Requesting…' : selectedEta ? `Confirm — Leaving in ${selectedEta} min` : 'Select a time above'}
                </span>
                {selectedEta && !requesting && <Icon name="arrowRight" size={15} color={colors.textOnPrimary} />}
              </PressableScale>
            </div>
          </div>
        )}

        {/* Countdown — real backend-tracked retrieval state, shared with the
            "My Parking" tab via useRetrievalRequest. Hidden once 'delivered'. */}
        {activeRetrieve && activeRetrieve.status !== 'delivered' && (
          <div className="pulse">
            <div style={{
              background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT),
              borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <Icon
                  name={activeRetrieve.status === 'requested' ? 'timer' : activeRetrieve.status === 'assigned' ? 'bell' : 'car'}
                  size={13} color="rgba(255,255,255,0.8)"
                />
                <span style={{color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700}}>
                  {activeRetrieve.status === 'requested' && 'Waiting for Valet'}
                  {activeRetrieve.status === 'assigned' && `${activeRetrieve.driverName ?? 'Driver'} Assigned`}
                  {activeRetrieve.status === 'in_transit' && `${activeRetrieve.driverName ?? 'Driver'} On The Way`}
                </span>
              </div>
              {remainingSeconds != null && (
                <div style={{color: '#fff', fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', margin: '6px 0'}}>
                  {fmt(remainingSeconds)}
                </div>
              )}
              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: 12}}>Your car is being retrieved</div>
              {activeRetrieve.status === 'in_transit' && (
                <PressableScale
                  onClick={() => setShowTracking(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
                    backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                    padding: '12px 20px', border: '1px solid rgba(255,255,255,0.3)',
                  }}>
                  <Icon name="map" size={15} color="#fff" />
                  <span style={{color: '#fff', fontSize: 13, fontWeight: 800}}>View Live Tracking Map</span>
                </PressableScale>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
