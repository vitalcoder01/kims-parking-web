import React, {useState, useEffect, useRef} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useAppState} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {LiveTrackingScreen} from './LiveTrackingScreen';
import {useRetrievalRequest} from '../hooks/useRetrievalRequest';
import {computeTrip} from '../utils/geo';
import {BRAND_GRADIENT, BRAND_GRADIENT_DARK, gradientCss} from '../theme/colors';
import {Icon} from '../components/Icon';
import {useDialog} from '../components/AppDialog';
import {
  PLANNED_DEPARTURE_OPTIONS, ARRIVAL_ETA_OPTIONS, clockToMinutes, fmtClock12, to12, to24,
  enRouteSeconds,
} from '../utils/retrievalClocks';

// Direct port of the mobile app's DoctorHomeScreen — Arrival/Departure
// launcher cards, popup pickers, a live GPS-derived "time away" countdown
// (not a static timer), and a cancel-departure flow, all sharing the exact
// same backend-tracked state via useAppState/useRetrievalRequest.

const DEPARTURE_OPTIONS = PLANNED_DEPARTURE_OPTIONS;
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = Array.from({length: 12}, (_, i) => i * 5);
const ETA_OPTIONS_ARRIVAL = ARRIVAL_ETA_OPTIONS;

function nextFiveMinuteMark(): Date {
  const d = new Date();
  d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
  return d;
}

// Slide-up popup over Home — Home itself never unmounts underneath it.
function BottomSheetModal({visible, onClose, children}: {visible: boolean; onClose: () => void; children: React.ReactNode}) {
  const {colors} = useTheme();
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
    <div style={{position: 'absolute', inset: 0, zIndex: 100}}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          opacity: entered ? 1 : 0, transition: 'opacity 220ms ease',
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, display: 'flex', justifyContent: 'center'}}>
        <div style={{
          width: '100%',
          transform: `translateY(${entered ? 0 : 100}%)`,
          transition: 'transform 280ms cubic-bezier(0.2,0.8,0.2,1)',
        }}>
          <div style={{
            borderTopLeftRadius: 20, borderTopRightRadius: 20, borderWidth: 1, borderStyle: 'solid',
            borderColor: colors.border, borderBottom: 'none', overflow: 'hidden',
            backgroundColor: colors.surface,
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
  const {tasks, sendArrivalNotice, cancelMyRetrieval, hydrated,
    myArrivalNotice, cancelMyArrival} = useAppState();
  const [cancellingArrival, setCancellingArrival] = useState(false);

  // Plans changed before they set off — take the heads-up back so the valet
  // isn't holding a spot for someone who isn't coming.
  const handleCancelArrival = async () => {
    if (!myArrivalNotice || cancellingArrival) return;
    const ok = await dialog.confirm({
      title: 'Not coming after all?',
      message: 'This clears the heads-up you sent the valet team.',
      confirmText: 'Cancel arrival', destructive: true,
    });
    if (!ok) return;
    setCancellingArrival(true);
    try {
      await cancelMyArrival(myArrivalNotice.id);
      setArrivalSent(null);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not cancel');
    } finally {
      setCancellingArrival(false);
    }
  };
  const {colors, isDark} = useTheme();
  const dialog = useDialog();
  const {activeRetrieve, now, requestRetrieval} = useRetrievalRequest();

  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [showDepartureModal, setShowDepartureModal] = useState(false);
  const [selectedEta, setSelectedEta]     = useState<number | null>(null);
  const [customOn, setCustomOn]           = useState(false);
  const [customH, setCustomH]             = useState(() => nextFiveMinuteMark().getHours());
  const [customM, setCustomM]             = useState(() => nextFiveMinuteMark().getMinutes());
  const [cancelling, setCancelling]       = useState(false);
  const [requesting, setRequesting]       = useState(false);
  const [showTracking, setShowTracking]   = useState(false);
  const [arrivalEta, setArrivalEta]       = useState<number | null>(null);
  const [sendingArrival, setSendingArrival] = useState(false);
  const [arrivalSent, setArrivalSent]     = useState<number | null>(null);

  const displayTask = tasks.find(t => t.doctorId === user?.id);
  const activeTask = displayTask && displayTask.status !== 'completed' && displayTask.status !== 'cancelled' ? displayTask : undefined;
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
      setCustomOn(false); setSelectedEta(null);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not request retrieval');
    } finally {
      setRequesting(false);
    }
  };

  const handleCancelRetrieval = async () => {
    if (!activeRetrieve) return;
    const ok = await dialog.confirm({
      title: 'Cancel Your Request?',
      message: `The valet will be told you no longer need ${activeRetrieve.carNumber}. Your car stays parked.`,
      confirmText: 'Cancel Request', destructive: true,
    });
    if (!ok) return;
    setCancelling(true);
    try {
      await cancelMyRetrieval(activeRetrieve.id);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not cancel');
    } finally {
      setCancelling(false);
    }
  };

  const statusMap: Record<string,{label:string;color:string}> = {
    assigned:      {label: 'Driver Assigned',      color: colors.warning},
    key_collected: {label: 'Key Collected',         color: colors.info},
    // A retrieval's destination is the valet counter, NOT the doctor — the
    // driver brings the car back there and the doctor collects it.
    in_transit:    {label: activeTask?.type === 'retrieve' ? 'Coming to Valet Counter' : 'En Route to Parking', color: colors.primary},
    delivered:     {label: 'Ready at the counter', color: colors.success},
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
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40, position: 'relative'}}>

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

        {/* Countdown — hidden once 'delivered', the CAR READY banner below
            already covers that. */}
        {activeRetrieve && activeRetrieve.status !== 'delivered' && (() => {
          const enRoute = enRouteSeconds(activeRetrieve, now);
          const onTheWay = activeRetrieve.status === 'in_transit' && enRoute != null;
          const trip = onTheWay
            ? computeTrip({
                startLat: activeRetrieve.driverStartLat, startLng: activeRetrieve.driverStartLng,
                lat: activeRetrieve.driverLat, lng: activeRetrieve.driverLng,
                destinationLat: activeRetrieve.destinationLat, destinationLng: activeRetrieve.destinationLng,
                mode: 'drive',
              })
            : null;
          return (
            <div className={onTheWay ? 'pulse' : undefined}>
              <div style={{
                background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT),
                borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center',
              }}>
                {onTheWay ? (
                  <>
                    <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                      <Icon name="car" size={13} color="rgba(255,255,255,0.8)" />
                      <span style={{color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 700}}>Vehicle on the way</span>
                    </div>
                    {trip ? (
                      <>
                        <div style={{color: '#fff', fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums', margin: '6px 0'}}>
                          {trip.etaMinutes <= 0 ? 'Now' : `~${trip.etaMinutes}`}
                        </div>
                        {trip.etaMinutes > 0 && <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: 800, marginTop: -6, marginBottom: 6}}>min away</div>}
                      </>
                    ) : (
                      <div style={{color: '#fff', fontSize: 22, fontWeight: 900, margin: '14px 0'}}>Locating your car…</div>
                    )}
                    <div style={{color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center'}}>
                      {activeRetrieve.driverName ?? 'Your driver'} is bringing it to the valet counter
                    </div>
                    <PressableScale
                      onClick={() => setShowTracking(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
                        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                        padding: '12px 20px', border: '1px solid rgba(255,255,255,0.3)',
                      }}>
                      <Icon name="map" size={15} color="#fff" />
                      <span style={{color: '#fff', fontSize: 13, fontWeight: 800}}>Track live</span>
                    </PressableScale>
                  </>
                ) : (
                  <>
                    <div style={{
                      width: 52, height: 52, borderRadius: 26, marginBottom: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.18)',
                    }}>
                      <Icon name="checkBold" size={26} color="#fff" />
                    </div>
                    <div style={{color: '#fff', fontSize: 18, fontWeight: 900, marginBottom: 8, textAlign: 'center'}}>Departure request sent</div>
                    <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: '19px'}}>The valet team has been notified.</div>
                    <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: '19px'}}>We'll notify you when your vehicle is on the way.</div>
                    <PressableScale
                      onClick={handleCancelRetrieval}
                      disabled={cancelling}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14,
                        padding: '10px 18px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.35)',
                        backgroundColor: 'rgba(0,0,0,0.14)', opacity: cancelling ? 0.6 : 1,
                      }}>
                      <Icon name="close" size={13} color="#fff" />
                      <span style={{color: '#fff', fontSize: 13, fontWeight: 800}}>
                        {cancelling ? 'Cancelling…' : 'Cancel request'}
                      </span>
                    </PressableScale>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Park job in motion — no ETA to count down to, just a live-track link. */}
        {parkInMotion && (
          <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column', gap: 14}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <Icon name="carKey" size={15} color="rgba(255,255,255,0.85)" />
              <span style={{flex: 1, color: '#fff', fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                {displayTask?.status === 'key_collected'
                  ? `${displayTask?.driverName ?? 'Driver'} has your key`
                  : `${displayTask?.driverName ?? 'Driver'} is parking your car`}
              </span>
            </div>
            <PressableScale
              onClick={() => setShowTracking(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                padding: '12px 20px', border: '1px solid rgba(255,255,255,0.3)',
              }}>
              <Icon name="map" size={15} color="#fff" />
              <span style={{color: '#fff', fontSize: 13, fontWeight: 800}}>Track live</span>
            </PressableScale>
          </div>
        )}

        {/* Arrival / Departure launcher card — mutually exclusive states, so
            at most one ever renders. Same visual DNA as the valet's action
            grid (rounded 22px, soft shadow, icon in a rounded square), but a
            horizontal solo-card layout rather than a centered vertical
            stack — a square grid tile sitting alone in a wide row would
            leave visible empty space next to it. */}
        {!hydrated && (
          <SkeletonBlock height={82} radius={22} />
        )}
        {hydrated && showEmptyState && (
          <PressableScale
            onClick={() => setShowArrivalModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, borderRadius: 22, padding: 18,
              backgroundColor: colors.primary, boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}>
              <Icon name="bellAlert" size={24} color="#fff" />
            </div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{color: '#fff', fontSize: 15, fontWeight: 800}}>Arrival</div>
              <div style={{color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2}}>Let the valet know you're coming</div>
            </div>
            <Icon name="arrowRight" size={18} color="rgba(255,255,255,0.6)" />
          </PressableScale>
        )}
        {hydrated && carIsParked && !activeRetrieve && (
          <PressableScale
            onClick={() => setShowDepartureModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, borderRadius: 22, padding: 18,
              backgroundColor: colors.primary, boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
            }}>
            <div style={{
              width: 46, height: 46, borderRadius: 14, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}>
              <Icon name="car" size={24} color="#fff" />
            </div>
            <div style={{flex: 1, textAlign: 'left'}}>
              <div style={{color: '#fff', fontSize: 15, fontWeight: 800}}>Departure</div>
              <div style={{color: 'rgba(255,255,255,0.65)', fontSize: 11.5, marginTop: 2}}>Request your car back</div>
            </div>
            <Icon name="arrowRight" size={18} color="rgba(255,255,255,0.6)" />
          </PressableScale>
        )}

        {/* Driven by myArrivalNotice (the server's own record) rather than
            the local arrivalSent flag alone — that flag is lost on every
            reload, which meant a heads-up you'd already sent quietly
            disappeared from your side while still sitting in the valet's
            queue. With the real record here, plans changing has an answer:
            take it back. */}
        {(myArrivalNotice || arrivalSent) && showEmptyState && (
          <div style={{display: 'flex', alignItems: 'center', gap: 8, borderRadius: 14, border: `1px solid ${colors.success}30`, padding: 12, backgroundColor: colors.success + '10'}}>
            <Icon name="bellAlert" size={16} color={colors.success} />
            <span style={{flex: 1, fontSize: 12, fontWeight: 700, color: colors.success}}>
              {(() => {
                const eta = myArrivalNotice?.eta ?? arrivalSent ?? 0;
                return `Valet notified — arriving in ~${eta >= 60 ? `${eta / 60} hr` : `${eta} min`}`;
              })()}
            </span>
            {!!myArrivalNotice && (
              <PressableScale
                onClick={handleCancelArrival}
                disabled={cancellingArrival}
                style={{background: 'transparent', border: 'none', padding: 0, flexShrink: 0}}>
                {cancellingArrival
                  ? <span className="spinner" style={{width: 13, height: 13, borderColor: colors.success + '40', borderTopColor: colors.success}} />
                  : <span style={{fontSize: 12.5, fontWeight: 800, color: colors.success, textDecoration: 'underline'}}>Cancel</span>}
              </PressableScale>
            )}
          </div>
        )}

        {/* Vehicle status card — the slot number IS the answer when parked. */}
        <div style={{borderRadius: 20, border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.surface}}>
          {!hydrated ? (
            <div style={{padding: 20}}>
              <SkeletonBlock height={12} width="35%" />
              <SkeletonBlock height={34} width="55%" style={{marginTop: 12}} />
              <SkeletonBlock height={12} width="70%" style={{marginTop: 14}} />
            </div>
          ) : showEmptyState || !displayTask ? (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: colors.textMuted}}>VEHICLE STATUS</span>
                <span style={{fontSize: 12, fontWeight: 800, color: colors.textMuted}}>No active session</span>
              </div>
              <div style={{fontSize: 18, fontWeight: 800, marginTop: 6, color: colors.textMuted}}>No car parked</div>
              <div style={{fontSize: 13, fontWeight: 600, marginTop: 8, color: colors.textMuted}}>Hand your keys to the valet at the entrance.</div>
            </div>
          ) : carIsParked ? (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: colors.textMuted}}>PARKED AT</span>
                <span style={{fontSize: 12, fontWeight: 800, color: colors.success}}>Safely parked</span>
              </div>
              <div style={{fontSize: 40, fontWeight: 900, letterSpacing: -0.5, marginTop: 6, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary}}>{displayTask.slotId ?? '—'}</div>
              <div style={{fontSize: 13, fontWeight: 600, marginTop: 8, color: colors.textSecondary}}>
                {displayTask.carNumber}
                {displayTask.driverName ? `  ·  Parked by ${displayTask.driverName}` : ''}
              </div>
            </div>
          ) : carJustRetrieved ? (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: colors.textMuted}}>RETRIEVING</span>
                <span style={{fontSize: 12, fontWeight: 800, color: colors.success}}>Ready for pickup</span>
              </div>
              <div style={{fontSize: 18, fontWeight: 800, marginTop: 6, color: colors.textPrimary}}>Collect at the valet counter</div>
              <div style={{fontSize: 13, fontWeight: 600, marginTop: 8, color: colors.textSecondary}}>{displayTask.carNumber}</div>
            </div>
          ) : (
            <div style={{padding: 20}}>
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
                <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1.4, color: colors.textMuted}}>
                  {displayTask.type === 'park' ? 'PARKING' : 'RETRIEVING'}
                </span>
                {!!statusInfo && <span style={{fontSize: 12, fontWeight: 800, color: statusInfo.color}}>{statusInfo.label}</span>}
              </div>
              <div style={{fontSize: 18, fontWeight: 800, marginTop: 6, color: colors.textPrimary}}>
                {displayTask.driverName ? `${displayTask.driverName} has your car` : 'Waiting for a driver'}
              </div>
              <div style={{fontSize: 13, fontWeight: 600, marginTop: 8, color: colors.textSecondary}}>
                {displayTask.carNumber}
                {displayTask.driverName ? `  ·  ${displayTask.driverName}` : ''}
              </div>
            </div>
          )}
        </div>

        {/* Past sessions */}
        <PressableScale
          onClick={onOpenHistory}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            borderRadius: 16, border: `1px solid ${colors.border}`, padding: 14,
            backgroundColor: colors.surface, width: '100%',
          }}>
          <Icon name="history" size={18} color={colors.textPrimary} />
          <span style={{flex: 1, fontSize: 13, fontWeight: 700, textAlign: 'left', color: colors.textPrimary}}>View Parking History</span>
          <Icon name="arrowRight" size={16} color={colors.textMuted} />
        </PressableScale>
      </div>

      {/* Arrival popup */}
      <BottomSheetModal visible={showArrivalModal} onClose={() => setShowArrivalModal(false)}>
        <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), padding: 18, position: 'relative'}}>
          <PressableScale
            onClick={() => setShowArrivalModal(false)}
            style={{position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="close" size={16} color="#fff" />
          </PressableScale>
          <div style={{color: '#fff', fontSize: 17, fontWeight: 900}}>{arrivalSent ? 'Valet Notified' : 'On Your Way?'}</div>
          <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3}}>
            {arrivalSent
              ? `We told the valet you'll arrive in ~${arrivalSent >= 60 ? `${arrivalSent / 60} hr` : `${arrivalSent} min`}`
              : 'Let the valet know before you get here so a driver is ready'}
          </div>
        </div>
        {!arrivalSent && (
          <div style={{padding: 16}}>
            <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12, color: colors.textMuted}}>WHEN WILL YOU ARRIVE?</div>
            <div style={{display: 'flex', gap: 10}}>
              {ETA_OPTIONS_ARRIVAL.map(opt => {
                const on = arrivalEta === opt;
                return (
                  <PressableScale
                    key={opt}
                    onClick={() => setArrivalEta(opt)}
                    disabled={sendingArrival}
                    style={{
                      flex: 1, borderRadius: 14, padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                      border: `1.5px solid ${on ? colors.textPrimary : colors.border}`,
                      backgroundColor: on ? colors.textPrimary : colors.cardAlt,
                    }}>
                    <span style={{fontSize: 22, fontWeight: 900, lineHeight: '26px', color: on ? colors.background : colors.textPrimary}}>
                      {opt >= 60 ? opt / 60 : opt}
                    </span>
                    <span style={{fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3, color: on ? colors.background + 'AA' : colors.textMuted}}>
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
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                borderRadius: 14, padding: '15px 0', marginTop: 14, width: '100%',
                backgroundColor: arrivalEta ? colors.primary : colors.border, opacity: sendingArrival ? 0.6 : 1,
              }}>
              <span style={{fontSize: 14, fontWeight: 900, color: arrivalEta ? colors.textOnPrimary : colors.textMuted}}>
                {sendingArrival ? 'Notifying…' : arrivalEta ? 'Notify the valet' : 'Select a time above'}
              </span>
              {arrivalEta && !sendingArrival && <Icon name="arrowRight" size={15} color={colors.textOnPrimary} />}
            </PressableScale>
          </div>
        )}
      </BottomSheetModal>

      {/* Departure popup */}
      <BottomSheetModal visible={showDepartureModal} onClose={() => setShowDepartureModal(false)}>
        <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), padding: 18, position: 'relative'}}>
          <PressableScale
            onClick={() => setShowDepartureModal(false)}
            style={{position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="close" size={16} color="#fff" />
          </PressableScale>
          <div style={{color: '#fff', fontSize: 17, fontWeight: 900}}>Ready to Leave?</div>
          <div style={{color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 3}}>We'll notify the valet team so they can plan your retrieval</div>
        </div>
        <div style={{padding: 16}}>
          <div style={{fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 12, color: colors.textMuted}}>WHEN ARE YOU LEAVING?</div>
          <div style={{display: 'flex', gap: 10}}>
            {DEPARTURE_OPTIONS.map(opt => {
              const on = !customOn && selectedEta === opt;
              return (
                <PressableScale
                  key={opt}
                  onClick={() => { setCustomOn(false); setSelectedEta(opt); }}
                  disabled={requesting}
                  style={{
                    flex: 1, borderRadius: 14, padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                    border: `1.5px solid ${on ? colors.textPrimary : colors.border}`,
                    backgroundColor: on ? colors.textPrimary : colors.cardAlt,
                  }}>
                  <span style={{fontSize: 22, fontWeight: 900, lineHeight: '26px', color: on ? colors.background : colors.textPrimary}}>
                    {opt === 0 ? 'Now' : opt}
                  </span>
                  {opt !== 0 && (
                    <span style={{fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3, color: on ? colors.background + 'AA' : colors.textMuted}}>min</span>
                  )}
                </PressableScale>
              );
            })}
            <PressableScale
              onClick={() => { setCustomOn(true); setSelectedEta(null); }}
              disabled={requesting}
              style={{
                flex: 1, borderRadius: 14, padding: '16px 0', display: 'flex', flexDirection: 'column', alignItems: 'center',
                border: `1.5px solid ${customOn ? colors.textPrimary : colors.border}`,
                backgroundColor: customOn ? colors.textPrimary : colors.cardAlt,
              }}>
              <Icon name="timer" size={19} color={customOn ? colors.background : colors.textPrimary} />
              <span style={{fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginTop: 3, color: customOn ? colors.background + 'AA' : colors.textMuted}}>custom</span>
            </PressableScale>
          </div>

          {customOn && (() => {
            const {h12, pm} = to12(customH);
            return (
              <div style={{marginTop: 14, border: `1px solid ${colors.border}`, borderRadius: 14, padding: 12, backgroundColor: colors.cardAlt}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 150}}>
                  <div style={{width: 66, height: '100%', overflowY: 'auto'}}>
                    {HOURS_12.map(h => {
                      const on = h12 === h;
                      return (
                        <PressableScale key={h} onClick={() => setCustomH(to24(h, pm))}
                          style={{width: '100%', padding: '9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, margin: '2px 0', backgroundColor: on ? colors.primary : 'transparent'}}>
                          <span style={{fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: on ? colors.textOnPrimary : colors.textPrimary}}>{h}</span>
                        </PressableScale>
                      );
                    })}
                  </div>
                  <span style={{fontSize: 20, fontWeight: 800, color: colors.textPrimary}}>:</span>
                  <div style={{width: 66, height: '100%', overflowY: 'auto'}}>
                    {MINUTES.map(m => (
                      <PressableScale key={m} onClick={() => setCustomM(m)}
                        style={{width: '100%', padding: '9px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 9, margin: '2px 0', backgroundColor: customM === m ? colors.primary : 'transparent'}}>
                        <span style={{fontSize: 17, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: customM === m ? colors.textOnPrimary : colors.textPrimary}}>
                          {String(m).padStart(2, '0')}
                        </span>
                      </PressableScale>
                    ))}
                  </div>
                  <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, marginLeft: 4}}>
                    {[false, true].map(isPm => {
                      const on = pm === isPm;
                      return (
                        <PressableScale key={String(isPm)} onClick={() => setCustomH(to24(h12, isPm))}
                          style={{padding: '10px 14px', borderRadius: 10, border: `1px solid ${on ? colors.primary : colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: on ? colors.primary : 'transparent'}}>
                          <span style={{fontSize: 17, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textPrimary}}>{isPm ? 'PM' : 'AM'}</span>
                        </PressableScale>
                      );
                    })}
                  </div>
                </div>
                <div style={{marginTop: 10, textAlign: 'center', fontSize: 12, fontWeight: 700, color: colors.textSecondary}}>
                  Leaving at {fmtClock12(customH, customM)}
                  {departureMinutes != null && departureMinutes >= 720 ? ' tomorrow' : ''}
                  {departureMinutes != null && `  ·  in ${Math.floor(departureMinutes / 60)}h ${departureMinutes % 60}m`}
                </div>
              </div>
            );
          })()}

          <PressableScale
            onClick={handleDeparture}
            disabled={departureMinutes == null || requesting}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderRadius: 14, padding: '15px 0', marginTop: 14, width: '100%',
              backgroundColor: departureMinutes != null ? colors.primary : colors.border, opacity: requesting ? 0.6 : 1,
            }}>
            <span style={{fontSize: 14, fontWeight: 900, color: departureMinutes != null ? colors.textOnPrimary : colors.textMuted}}>
              {requesting ? 'Sending…' : departureMinutes != null ? 'Send departure request' : 'Select a time above'}
            </span>
            {departureMinutes != null && !requesting && <Icon name="arrowRight" size={15} color={colors.textOnPrimary} />}
          </PressableScale>
        </div>
      </BottomSheetModal>
    </div>
  );
}
