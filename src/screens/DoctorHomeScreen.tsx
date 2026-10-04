import React, {useState, useEffect} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useAppState} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {LiveTrackingScreen} from './LiveTrackingScreen';
import {useRetrievalRequest} from '../hooks/useRetrievalRequest';
import {Icon} from '../components/Icon';
import {useDialog} from '../components/AppDialog';
import {
  PLANNED_DEPARTURE_OPTIONS, ARRIVAL_ETA_OPTIONS, clockToMinutes, fmtClock12, to12, to24,
} from '../utils/retrievalClocks';

const DEPARTURE_OPTIONS = PLANNED_DEPARTURE_OPTIONS;
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({length: 12}, (_, i) => i * 5);
const ETA_OPTIONS_ARRIVAL = ARRIVAL_ETA_OPTIONS;

function nextFiveMinuteMark(): Date {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

// Slide-up bottom sheet over Home with backdrop blur
function BottomSheetModal({visible, onClose, children}: {visible: boolean; onClose: () => void; children: React.ReactNode}) {
  const {colors, isDark} = useTheme();
  const [rendered, setRendered] = useState(visible);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setEntered(false);
      const t = setTimeout(() => setRendered(false), 220);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <div style={{position: 'fixed', inset: 0, zIndex: 100, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center'}}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: entered ? 1 : 0,
          transition: 'opacity 220ms ease',
        }}
      />
      <div style={{position: 'relative', width: '100%', maxWidth: 480, zIndex: 1}}>
        <div style={{
          width: '100%',
          transform: `translateY(${entered ? 0 : 100}%)`,
          transition: 'transform 280ms cubic-bezier(0.2,0.8,0.2,1)',
        }}>
          <div style={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.border,
            borderBottom: 'none',
            overflow: 'hidden',
            backgroundColor: colors.surface,
            boxShadow: isDark ? '0 -8px 30px rgba(0,0,0,0.5)' : '0 -4px 20px rgba(0,0,0,0.1)',
          }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonBlock({height, width = '100%', radius = 10, style}: {height: number; width?: number | string; radius?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return <div className="pulse" style={{height, width, borderRadius: radius, backgroundColor: colors.cardAlt, ...style}} />;
}

export function DoctorHomeScreen({onOpenCard, onOpenHistory}: {onOpenCard: () => void; onOpenHistory: () => void}) {
  const {user} = useAuth();
  const {tasks, sendArrivalNotice, cancelMyRetrieval, hydrated, myArrivalNotice, cancelMyArrival} = useAppState();
  const [cancellingArrival, setCancellingArrival] = useState(false);

  const handleCancelArrival = async () => {
    if (!myArrivalNotice || cancellingArrival) return;
    const ok = await dialog.confirm({
      title: 'Cancel Arrival Notice?',
      message: 'This clears the arrival heads-up you sent to the valet desk.',
      confirmText: 'Cancel Arrival',
      destructive: true,
    });
    if (!ok) return;
    setCancellingArrival(true);
    try {
      await cancelMyArrival(myArrivalNotice.id);
      setArrivalSent(null);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not cancel arrival');
    } finally {
      setCancellingArrival(false);
    }
  };

  const {colors, isDark} = useTheme();
  const dialog = useDialog();
  const {activeRetrieve, requestRetrieval} = useRetrievalRequest();

  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [selectedEta, setSelectedEta] = useState<number | null>(null);
  const [customOn, setCustomOn] = useState(false);
  const [customH, setCustomH] = useState(() => nextFiveMinuteMark().getHours());
  const [customM, setCustomM] = useState(() => nextFiveMinuteMark().getMinutes());
  const [cancelling, setCancelling] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [arrivalEta, setArrivalEta] = useState<number | null>(null);
  const [sendingArrival, setSendingArrival] = useState(false);
  const [arrivalSent, setArrivalSent] = useState<number | null>(null);

  const doctorTasks = tasks.filter(t => t.doctorId === user?.id);
  const activeTask = doctorTasks.find(t => t.status !== 'completed' && t.status !== 'cancelled');
  const displayTask = activeTask ?? doctorTasks.slice().sort((a, b) => (b.completedAt ?? b.requestedAt ?? 0) - (a.completedAt ?? a.requestedAt ?? 0))[0];
  const carIsParked = displayTask?.type === 'park' && displayTask.status === 'completed';
  const carJustRetrieved = displayTask?.type === 'retrieve' && displayTask.status === 'delivered';
  const showEmptyState = !displayTask || displayTask.status === 'cancelled'
    || (displayTask.status === 'completed' && displayTask.type === 'retrieve');
  const parkInMotion = displayTask?.type === 'park'
    && (displayTask.status === 'key_collected' || displayTask.status === 'in_transit');

  useEffect(() => {
    if (!showEmptyState) { setArrivalSent(null); setArrivalEta(null); }
  }, [showEmptyState]);

  const handleArrival = async () => {
    if (!arrivalEta) return;
    setSendingArrival(true);
    try {
      await sendArrivalNotice(arrivalEta);
      setArrivalSent(arrivalEta);
      setShowArrivalModal(false);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not notify the valet');
    } finally {
      setSendingArrival(false);
    }
  };

  const departureMinutes = customOn ? clockToMinutes(customH, customM, Date.now()) : selectedEta;

  const handleDeparture = async () => {
    if (departureMinutes == null) return;
    setRequesting(true);
    try {
      await requestRetrieval(departureMinutes);
      setShowDepartureModal(false);
      setCustomOn(false);
      setSelectedEta(null);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not request retrieval');
    } finally {
      setRequesting(false);
    }
  };

  const handleCancelRetrieval = async () => {
    if (!activeRetrieve) return;
    const ok = await dialog.confirm({
      title: 'Cancel Retrieval Request?',
      message: `The valet will be notified that you no longer need ${activeRetrieve.carNumber}. Your vehicle remains safely parked.`,
      confirmText: 'Cancel Request',
      destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await cancelMyRetrieval(activeRetrieve.id);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not cancel retrieval');
    } finally {
      setCancelling(false);
    }
  };

  const statusMap: Record<string, {label: string; color: string}> = {
    assigned: {label: 'Driver Assigned', color: '#D97706'},
    key_collected: {label: 'Key Collected', color: colors.primary},
    in_transit: {label: activeTask?.type === 'retrieve' ? 'En Route to Counter' : 'En Route to Bay', color: colors.primary},
    delivered: {label: 'Ready at Valet Counter', color: colors.success},
    completed: {label: 'Safely Parked', color: colors.success},
  };

  const statusInfo = activeTask
    ? (activeTask.status === 'assigned' && !activeTask.driverId
        ? {label: 'Awaiting Driver', color: colors.textMuted}
        : statusMap[activeTask.status])
    : null;

  if (showTracking && displayTask) {
    return <LiveTrackingScreen task={displayTask} onBack={() => setShowTracking(false)} />;
  }

  const glassCardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 20,
    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 72, position: 'relative'}}>
      {/* 1. Restrained Executive Hospital Header */}
      <div style={{
        padding: '16px 18px',
        backgroundColor: colors.surface,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}>
        <div style={{minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: 11, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: colors.primary}}>
              KIMS MEDICAL STAFF
            </span>
          </div>
          <div style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary, letterSpacing: -0.3, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            {user?.name ?? 'Doctor Portal'}
          </div>
          {user?.department && (
            <div style={{fontSize: 11.5, fontWeight: 600, color: colors.textSecondary, marginTop: 1}}>
              {user.department}
            </div>
          )}
        </div>

        {/* Valet Code Digital Pass Pill */}
        <PressableScale
          onClick={onOpenCard}
          style={{
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
            borderRadius: 14,
            padding: '8px 14px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: `1.5px solid ${colors.primary}`,
            cursor: 'pointer',
            flexShrink: 0,
          }}>
          <span style={{
            color: colors.primary,
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: 4,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {user?.cardCode ?? '---'}
          </span>
          <span style={{display: 'flex', alignItems: 'center', gap: 3, marginTop: 1}}>
            <span style={{color: colors.primary, fontSize: 8.5, fontWeight: 800, letterSpacing: 1}}>
              VALET CODE
            </span>
            <Icon name="chevronRight" size={10} color={colors.primary} />
          </span>
        </PressableScale>
      </div>

      <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 14}}>
        {/* 2. Active Retrieval Mission Banner */}
        {activeRetrieve && activeRetrieve.status !== 'delivered' && (() => {
          const onTheWay = (activeRetrieve.status === 'assigned' || activeRetrieve.status === 'in_transit') && activeRetrieve.driverId != null;
          return (
            <div style={{
              ...glassCardStyle,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              border: `1.5px solid ${onTheWay ? colors.primary : '#F59E0B'}`,
              backgroundColor: onTheWay ? (isDark ? 'rgba(59, 130, 246, 0.08)' : '#F0F9FF') : colors.surface,
            }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: onTheWay ? colors.primary : '#F59E0B',
              }}>
                <Icon name={onTheWay ? 'car' : 'clock'} size={22} color="#fff" />
              </div>

              <div style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary, marginBottom: 4}}>
                {onTheWay ? 'Vehicle Turnaround En Route' : 'Departure Request Submitted'}
              </div>

              <div style={{fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, maxWidth: 300, lineHeight: '18px'}}>
                {onTheWay
                  ? `${activeRetrieve.driverName ?? 'Your valet runner'} is bringing your vehicle to the front counter`
                  : 'The valet team has received your retrieval request and is queuing dispatch.'}
              </div>

              {onTheWay ? (
                <PressableScale
                  onClick={() => setShowTracking(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 14,
                    backgroundColor: colors.primary,
                    borderRadius: 12,
                    padding: '10px 20px',
                    cursor: 'pointer',
                  }}>
                  <Icon name="map" size={15} color={colors.textOnPrimary} />
                  <span style={{color: colors.textOnPrimary, fontSize: 13, fontWeight: 800}}>
                    Track Live Position
                  </span>
                </PressableScale>
              ) : (
                <PressableScale
                  onClick={handleCancelRetrieval}
                  disabled={cancelling}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    marginTop: 14,
                    padding: '8px 16px',
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.cardAlt,
                    opacity: cancelling ? 0.6 : 1,
                    cursor: 'pointer',
                  }}>
                  <Icon name="close" size={13} color={colors.textSecondary} />
                  <span style={{color: colors.textSecondary, fontSize: 12, fontWeight: 800}}>
                    {cancelling ? 'Cancelling…' : 'Cancel Request'}
                  </span>
                </PressableScale>
              )}
            </div>
          );
        })()}

        {/* 3. Park Job In Motion Banner */}
        {parkInMotion && (
          <div style={{
            ...glassCardStyle,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: `1px solid ${colors.primary}`,
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <div style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Icon name="carKey" size={17} color={colors.primary} />
              </div>
              <div>
                <div style={{fontSize: 13.5, fontWeight: 800, color: colors.textPrimary}}>
                  {displayTask?.status === 'key_collected'
                    ? `${displayTask?.driverName ?? 'Runner'} has your key`
                    : `${displayTask?.driverName ?? 'Runner'} is parking your car`}
                </div>
                <div style={{fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginTop: 1}}>
                  Securing parking slot
                </div>
              </div>
            </div>

            <PressableScale
              onClick={() => setShowTracking(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: colors.primary,
                borderRadius: 10,
                padding: '8px 14px',
                cursor: 'pointer',
              }}>
              <Icon name="map" size={13} color={colors.textOnPrimary} />
              <span style={{color: colors.textOnPrimary, fontSize: 12, fontWeight: 800}}>
                Track
              </span>
            </PressableScale>
          </div>
        )}

        {/* 4. Curbside Action Launchers (Arrival vs. Departure) */}
        {!hydrated && (
          <SkeletonBlock height={76} radius={18} />
        )}
        {hydrated && showEmptyState && (
          <PressableScale
            onClick={() => setShowArrivalModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              borderRadius: 18,
              padding: 16,
              backgroundColor: colors.primary,
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
              cursor: 'pointer',
            }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}>
              <Icon name="bellAlert" size={22} color="#fff" />
            </div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{color: '#fff', fontSize: 15, fontWeight: 900}}>
                Curbside Arrival Notice
              </div>
              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: 11.5, marginTop: 1}}>
                Notify valet counter before you reach hospital entrance
              </div>
            </div>
            <Icon name="arrowRight" size={16} color="rgba(255,255,255,0.7)" />
          </PressableScale>
        )}

        {hydrated && carIsParked && !activeRetrieve && (
          <PressableScale
            onClick={() => setShowDepartureModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              borderRadius: 18,
              padding: 16,
              backgroundColor: colors.primary,
              boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.08)',
              cursor: 'pointer',
            }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}>
              <Icon name="car" size={22} color="#fff" />
            </div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{color: '#fff', fontSize: 15, fontWeight: 900}}>
                Request Vehicle Departure
              </div>
              <div style={{color: 'rgba(255,255,255,0.7)', fontSize: 11.5, marginTop: 1}}>
                Valet runner will retrieve your car to front gate
              </div>
            </div>
            <Icon name="arrowRight" size={16} color="rgba(255,255,255,0.7)" />
          </PressableScale>
        )}

        {/* 5. Arrival Notice Confirmation Pill */}
        {(myArrivalNotice || arrivalSent) && showEmptyState && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderRadius: 14,
            border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0'}`,
            padding: '12px 14px',
            backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ECFDF5',
          }}>
            <Icon name="bellAlert" size={16} color={colors.success} />
            <span style={{flex: 1, fontSize: 12, fontWeight: 800, color: colors.success}}>
              {(() => {
                const eta = myArrivalNotice?.eta ?? arrivalSent ?? 0;
                return `Valet desk alerted — Expected arrival in ~${eta >= 60 ? `${eta / 60} hr` : `${eta} min`}`;
              })()}
            </span>
            {!!myArrivalNotice && (
              <PressableScale
                onClick={handleCancelArrival}
                disabled={cancellingArrival}
                style={{background: 'transparent', border: 'none', padding: 0, flexShrink: 0, cursor: 'pointer'}}>
                {cancellingArrival ? (
                  <span className="spinner" style={{width: 13, height: 13, borderColor: colors.success + '40', borderTopColor: colors.success}} />
                ) : (
                  <span style={{fontSize: 12, fontWeight: 800, color: colors.success, textDecoration: 'underline'}}>
                    Cancel
                  </span>
                )}
              </PressableScale>
            )}
          </div>
        )}

        {/* 6. Vehicle Session Status Card */}
        <div style={{...glassCardStyle, overflow: 'hidden'}}>
          {!hydrated ? (
            <div style={{padding: 18}}>
              <SkeletonBlock height={12} width="35%" />
              <SkeletonBlock height={34} width="55%" style={{marginTop: 12}} />
              <SkeletonBlock height={12} width="70%" style={{marginTop: 14}} />
            </div>
          ) : showEmptyState || !displayTask ? (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: colors.textMuted, textTransform: 'uppercase'}}>
                  PARKING STATUS
                </span>
                <span style={{fontSize: 11, fontWeight: 800, color: colors.textMuted}}>
                  NO ACTIVE SESSION
                </span>
              </div>
              <div style={{fontSize: 18, fontWeight: 900, marginTop: 8, color: colors.textPrimary}}>
                No Vehicle Currently Parked
              </div>
              <div style={{fontSize: 12.5, fontWeight: 600, marginTop: 4, color: colors.textSecondary, lineHeight: '18px'}}>
                Hand your vehicle keys to the valet operator at the hospital entrance to initiate check-in.
              </div>
            </div>
          ) : carIsParked ? (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: colors.textSecondary, textTransform: 'uppercase'}}>
                  ALLOCATED PARKING BAY
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  color: colors.success,
                  letterSpacing: 0.3,
                }}>
                  SAFELY PARKED
                </span>
              </div>
              <div style={{
                fontSize: 38,
                fontWeight: 900,
                letterSpacing: -0.5,
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
                color: colors.primary,
              }}>
                BAY {displayTask.slotId ?? '—'}
              </div>
              <div style={{fontSize: 12.5, fontWeight: 700, marginTop: 6, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 6}}>
                <span style={{fontFamily: 'monospace', fontWeight: 800, color: colors.textPrimary}}>{displayTask.carNumber}</span>
                {displayTask.driverName ? ` · Parked by ${displayTask.driverName}` : ''}
              </div>
            </div>
          ) : carJustRetrieved ? (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: colors.textSecondary, textTransform: 'uppercase'}}>
                  VEHICLE AT COUNTER
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                  color: colors.success,
                  letterSpacing: 0.3,
                }}>
                  READY FOR COLLECTION
                </span>
              </div>
              <div style={{fontSize: 18, fontWeight: 900, marginTop: 8, color: colors.textPrimary}}>
                Collect Key at Curbside Valet Desk
              </div>
              <div style={{fontSize: 12.5, fontWeight: 700, marginTop: 4, color: colors.textSecondary}}>
                Plate: <span style={{fontFamily: 'monospace', fontWeight: 800, color: colors.textPrimary}}>{displayTask.carNumber}</span>
              </div>
            </div>
          ) : (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.2, color: colors.textSecondary, textTransform: 'uppercase'}}>
                  {displayTask.type === 'park' ? 'PARKING IN PROGRESS' : 'RETRIEVAL IN PROGRESS'}
                </span>
                {!!statusInfo && (
                  <span style={{fontSize: 11, fontWeight: 800, color: statusInfo.color}}>
                    {statusInfo.label}
                  </span>
                )}
              </div>
              <div style={{fontSize: 18, fontWeight: 900, marginTop: 8, color: colors.textPrimary}}>
                {displayTask.driverName ? `${displayTask.driverName} handling your car` : 'Waiting for valet runner assignment'}
              </div>
              <div style={{fontSize: 12.5, fontWeight: 700, marginTop: 4, color: colors.textSecondary}}>
                Plate: <span style={{fontFamily: 'monospace', fontWeight: 800, color: colors.textPrimary}}>{displayTask.carNumber}</span>
              </div>
            </div>
          )}
        </div>

        {/* 7. Parking History Navigation Link */}
        <PressableScale
          onClick={onOpenHistory}
          style={{
            ...glassCardStyle,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 14,
            cursor: 'pointer',
          }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            backgroundColor: colors.cardAlt,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="history" size={17} color={colors.primary} />
          </div>
          <span style={{flex: 1, fontSize: 13.5, fontWeight: 800, textAlign: 'left', color: colors.textPrimary}}>
            View Parking Session History
          </span>
          <Icon name="chevronRight" size={16} color={colors.textMuted} />
        </PressableScale>
      </div>

      {/* 8. Arrival Bottom Sheet Modal */}
      <BottomSheetModal visible={showArrivalModal} onClose={() => setShowArrivalModal(false)}>
        <div style={{
          padding: 18,
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          position: 'relative',
        }}>
          <PressableScale
            onClick={() => setShowArrivalModal(false)}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 10,
              backgroundColor: colors.cardAlt,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <Icon name="close" size={15} color={colors.textPrimary} />
          </PressableScale>
          <div style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary}}>
            {arrivalSent ? 'Valet Desk Notified' : 'Expected Arrival Notice'}
          </div>
          <div style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
            {arrivalSent
              ? `Arrival ETA set to ~${arrivalSent >= 60 ? `${arrivalSent / 60} hr` : `${arrivalSent} min`}`
              : 'Alert the curbside counter so a runner is on standby upon arrival'}
          </div>
        </div>

        {!arrivalSent && (
          <div style={{padding: 16}}>
            <div style={{fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, marginBottom: 12, color: colors.textSecondary, textTransform: 'uppercase'}}>
              Select Estimated Travel Time
            </div>
            <div style={{display: 'flex', gap: 8}}>
              {ETA_OPTIONS_ARRIVAL.map(opt => {
                const on = arrivalEta === opt;
                return (
                  <PressableScale
                    key={opt}
                    onClick={() => setArrivalEta(opt)}
                    disabled={sendingArrival}
                    style={{
                      flex: 1,
                      borderRadius: 14,
                      padding: '14px 0',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      border: `1.5px solid ${on ? colors.primary : colors.border}`,
                      backgroundColor: on ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF') : colors.cardAlt,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}>
                    <span style={{fontSize: 20, fontWeight: 900, color: on ? colors.primary : colors.textPrimary}}>
                      {opt >= 60 ? opt / 60 : opt}
                    </span>
                    <span style={{fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2, color: on ? colors.primary : colors.textMuted}}>
                      {opt >= 60 ? 'hr' : 'min'}
                    </span>
                  </PressableScale>
                );
              })}
            </div>

            <PressableScale
              onClick={handleArrival}
              disabled={!arrivalEta || sendingArrival}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderRadius: 14,
                height: 48,
                marginTop: 16,
                width: '100%',
                backgroundColor: arrivalEta ? colors.primary : colors.border,
                opacity: sendingArrival ? 0.6 : 1,
                cursor: arrivalEta ? 'pointer' : 'default',
              }}>
              <span style={{fontSize: 13.5, fontWeight: 900, color: arrivalEta ? colors.textOnPrimary : colors.textMuted}}>
                {sendingArrival ? 'Alerting Desk…' : arrivalEta ? 'Send Curbside Notice' : 'Choose an ETA above'}
              </span>
              {arrivalEta && !sendingArrival && <Icon name="arrowRight" size={14} color={colors.textOnPrimary} />}
            </PressableScale>
          </div>
        )}
      </BottomSheetModal>

      {/* 9. Departure Bottom Sheet Modal */}
      <BottomSheetModal visible={showDepartureModal} onClose={() => setShowDepartureModal(false)}>
        <div style={{
          padding: 18,
          backgroundColor: colors.surface,
          borderBottom: `1px solid ${colors.border}`,
          position: 'relative',
        }}>
          <PressableScale
            onClick={() => setShowDepartureModal(false)}
            style={{
              position: 'absolute',
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 10,
              backgroundColor: colors.cardAlt,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}>
            <Icon name="close" size={15} color={colors.textPrimary} />
          </PressableScale>
          <div style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary}}>
            Request Vehicle Retrieval
          </div>
          <div style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
            Valet will dispatch a runner to fetch your car from parking
          </div>
        </div>

        <div style={{padding: 16}}>
          <div style={{fontSize: 10.5, fontWeight: 800, letterSpacing: 0.8, marginBottom: 12, color: colors.textSecondary, textTransform: 'uppercase'}}>
            When will you be at the front desk?
          </div>
          <div style={{display: 'flex', gap: 8}}>
            {DEPARTURE_OPTIONS.map(opt => {
              const on = !customOn && selectedEta === opt;
              return (
                <PressableScale
                  key={opt}
                  onClick={() => { setCustomOn(false); setSelectedEta(opt); }}
                  disabled={requesting}
                  style={{
                    flex: 1,
                    borderRadius: 14,
                    padding: '14px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    border: `1.5px solid ${on ? colors.primary : colors.border}`,
                    backgroundColor: on ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF') : colors.cardAlt,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}>
                  <span style={{fontSize: 20, fontWeight: 900, color: on ? colors.primary : colors.textPrimary}}>
                    {opt === 0 ? 'Now' : opt}
                  </span>
                  {opt !== 0 && (
                    <span style={{fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2, color: on ? colors.primary : colors.textMuted}}>
                      min
                    </span>
                  )}
                </PressableScale>
              );
            })}
            <PressableScale
              onClick={() => { setCustomOn(true); setSelectedEta(null); }}
              disabled={requesting}
              style={{
                flex: 1,
                borderRadius: 14,
                padding: '14px 0',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                border: `1.5px solid ${customOn ? colors.primary : colors.border}`,
                backgroundColor: customOn ? (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF') : colors.cardAlt,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}>
              <Icon name="timer" size={18} color={customOn ? colors.primary : colors.textPrimary} />
              <span style={{fontSize: 9.5, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2, color: customOn ? colors.primary : colors.textMuted}}>
                custom
              </span>
            </PressableScale>
          </div>

          {customOn && (() => {
            const {h12, pm} = to12(customH);
            return (
              <div style={{marginTop: 14, border: `1px solid ${colors.border}`, borderRadius: 16, padding: 14, backgroundColor: colors.cardAlt}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 140}}>
                  <div style={{width: 64, height: '100%', overflowY: 'auto'}}>
                    {HOURS_12.map(h => {
                      const on = h12 === h;
                      return (
                        <PressableScale
                          key={h}
                          onClick={() => setCustomH(to24(h, pm))}
                          style={{
                            width: '100%',
                            padding: '8px 0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 8,
                            margin: '2px 0',
                            backgroundColor: on ? colors.primary : 'transparent',
                            cursor: 'pointer',
                          }}>
                          <span style={{fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: on ? colors.textOnPrimary : colors.textPrimary}}>
                            {h}
                          </span>
                        </PressableScale>
                      );
                    })}
                  </div>
                  <span style={{fontSize: 20, fontWeight: 900, color: colors.textPrimary}}>:</span>
                  <div style={{width: 64, height: '100%', overflowY: 'auto'}}>
                    {MINUTES.map(m => (
                      <PressableScale
                        key={m}
                        onClick={() => setCustomM(m)}
                        style={{
                          width: '100%',
                          padding: '8px 0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 8,
                          margin: '2px 0',
                          backgroundColor: customM === m ? colors.primary : 'transparent',
                          cursor: 'pointer',
                        }}>
                        <span style={{fontSize: 16, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: customM === m ? colors.textOnPrimary : colors.textPrimary}}>
                          {String(m).padStart(2, '0')}
                        </span>
                      </PressableScale>
                    ))}
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, marginLeft: 4}}>
                    {[false, true].map(isPm => {
                      const on = pm === isPm;
                      return (
                        <PressableScale
                          key={String(isPm)}
                          onClick={() => setCustomH(to24(h12, isPm))}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 8,
                            border: `1px solid ${on ? colors.primary : colors.border}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: on ? colors.primary : 'transparent',
                            cursor: 'pointer',
                          }}>
                          <span style={{fontSize: 14, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textPrimary}}>
                            {isPm ? 'PM' : 'AM'}
                          </span>
                        </PressableScale>
                      );
                    })}
                  </div>
                </div>

                <div style={{marginTop: 8, textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: colors.textSecondary}}>
                  Retrieval scheduled for {fmtClock12(customH, customM)}
                  {departureMinutes != null && departureMinutes >= 720 ? ' tomorrow' : ''}
                  {departureMinutes != null && ` (in ${Math.floor(departureMinutes / 60)}h ${departureMinutes % 60}m)`}
                </div>
              </div>
            );
          })()}

          <PressableScale
            onClick={handleDeparture}
            disabled={departureMinutes == null || requesting}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderRadius: 14,
              height: 48,
              marginTop: 16,
              width: '100%',
              backgroundColor: departureMinutes != null ? colors.primary : colors.border,
              opacity: requesting ? 0.6 : 1,
              cursor: departureMinutes != null ? 'pointer' : 'default',
            }}>
            <span style={{fontSize: 13.5, fontWeight: 900, color: departureMinutes != null ? colors.textOnPrimary : colors.textMuted}}>
              {requesting ? 'Dispatching Request…' : departureMinutes != null ? 'Submit Retrieval Request' : 'Select a time above'}
            </span>
            {departureMinutes != null && !requesting && <Icon name="arrowRight" size={14} color={colors.textOnPrimary} />}
          </PressableScale>
        </div>
      </BottomSheetModal>
    </div>
  );
}
