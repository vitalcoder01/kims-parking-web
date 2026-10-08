import React, {useState, useEffect} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useAppState} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {LiveTrackingScreen} from './LiveTrackingScreen';
import {useRetrievalRequest} from '../hooks/useRetrievalRequest';
import {BRAND_GRADIENT, BRAND_GRADIENT_DARK, gradientCss} from '../theme/colors';
import {shadow} from '../theme';
import {Icon, IconName} from '../components/Icon';
import {Surface, Text, Button} from '../components/ui';
import {useDialog} from '../components/AppDialog';
import {
  PLANNED_DEPARTURE_OPTIONS, ARRIVAL_ETA_OPTIONS, clockToMinutes, fmtClock12, to12, to24,
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
    <div style={{position: 'absolute', inset: 0, zIndex: 100}}>
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0, backgroundColor: colors.overlay,
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
            borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderStyle: 'solid',
            borderColor: colors.border, borderBottom: 'none', overflow: 'hidden',
            backgroundColor: colors.surface, boxShadow: shadow(isDark, 'e4'),
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

// Arrival / Departure both present the same shape: an ink card with an icon
// chip, a title + one line of context, and a forward chevron. One component
// so the two launchers can never drift apart.
function LauncherCard({icon, title, subtitle, onClick}: {icon: IconName; title: string; subtitle: string; onClick: () => void}) {
  const {colors, isDark} = useTheme();
  return (
    <PressableScale
      onClick={onClick}
      className="ui-surface ui-surface--interactive"
      style={{
        ['--ui-shadow' as any]: shadow(isDark, 'e2'),
        ['--ui-shadow-hover' as any]: shadow(isDark, 'e3'),
        ['--ui-ring' as any]: isDark ? 'rgba(243,243,241,0.45)' : 'rgba(21,22,26,0.5)',
        display: 'flex', alignItems: 'center', gap: 14, borderRadius: 22, padding: 18,
        backgroundColor: colors.primary, border: '1px solid transparent', width: '100%',
      }}>
      <span style={{
        width: 46, height: 46, borderRadius: 14, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
      }}>
        <Icon name={icon} size={24} color={colors.textOnPrimary} />
      </span>
      <span style={{flex: 1, textAlign: 'left'}}>
        <Text variant="subhead" color={colors.textOnPrimary} as="div">{title}</Text>
        <Text variant="caption" color={colors.textOnPrimary + 'A6'} as="div" style={{marginTop: 2}}>{subtitle}</Text>
      </span>
      <Icon name="arrowRight" size={18} color={colors.textOnPrimary + '99'} />
    </PressableScale>
  );
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
  const {activeRetrieve, requestRetrieval} = useRetrievalRequest();

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

  // The vehicle-status card header label (eyebrow + right-aligned status).
  const StatusRow = ({eyebrow, status, statusColor}: {eyebrow: string; status: string; statusColor: string}) => (
    <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10}}>
      <Text variant="overline" tone="muted" uppercase>{eyebrow}</Text>
      <Text variant="caption" color={statusColor} style={{fontWeight: 800}}>{status}</Text>
    </div>
  );

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40, position: 'relative'}}>

      {/* Gradient header */}
      <div style={{
        background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT),
        padding: '22px 20px 34px',
      }}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <div style={{flex: 1, minWidth: 0}}>
            <Text variant="caption" color="rgba(255,255,255,0.72)" as="div" style={{fontWeight: 500}}>Good day,</Text>
            <Text variant="title" color="#fff" as="div" numberOfLines={1} style={{marginTop: 2}}>{user?.name}</Text>
            <Text variant="caption" color="rgba(255,255,255,0.62)" as="div" style={{marginTop: 2}}>{user?.department}</Text>
          </div>
          <PressableScale
            onClick={onOpenCard}
            style={{
              backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 16, padding: '10px 16px',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              border: '1px solid rgba(255,255,255,0.22)',
            }}>
            <span style={{color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: 6}}>{user?.cardCode ?? '---'}</span>
            <span style={{display: 'flex', alignItems: 'center', gap: 2, marginTop: 2}}>
              <span style={{color: 'rgba(255,255,255,0.7)', fontSize: 8, fontWeight: 800, letterSpacing: 1.5}}>VALET CODE</span>
              <Icon name="chevronRight" size={11} color="rgba(255,255,255,0.7)" />
            </span>
          </PressableScale>
        </div>
      </div>

      <div style={{padding: '18px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12}}>

        {/* Countdown — hidden once 'delivered', the CAR READY banner below
            already covers that. */}
        {activeRetrieve && activeRetrieve.status !== 'delivered' && (() => {
          // No driver GPS any more (no driver app at all — see the
          // two-station handoff follow-up), so there's no ETA to compute.
          const onTheWay = (activeRetrieve.status === 'assigned' || activeRetrieve.status === 'in_transit')
            && activeRetrieve.driverId != null;
          return (
            <div className={onTheWay ? 'pulse' : undefined}>
              <div style={{
                background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT),
                borderRadius: 22, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center',
                boxShadow: shadow(isDark, 'e2'),
              }}>
                {onTheWay ? (
                  <>
                    <div style={{
                      width: 52, height: 52, borderRadius: 26, marginBottom: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      backgroundColor: 'rgba(255,255,255,0.18)',
                    }}>
                      <Icon name="car" size={24} color="#fff" />
                    </div>
                    <Text variant="heading" color="#fff" align="center" style={{marginBottom: 6}}>Vehicle on the way</Text>
                    <Text variant="bodySm" color="rgba(255,255,255,0.75)" align="center">
                      {activeRetrieve.driverName ?? 'Your driver'} is bringing it to the valet counter
                    </Text>
                    <PressableScale
                      onClick={() => setShowTracking(true)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 16,
                        backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                        padding: '12px 20px', border: '1px solid rgba(255,255,255,0.3)',
                      }}>
                      <Icon name="map" size={15} color="#fff" />
                      <Text variant="label" color="#fff">Track status</Text>
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
                    <Text variant="heading" color="#fff" align="center" style={{marginBottom: 8}}>Departure request sent</Text>
                    <Text variant="bodySm" color="rgba(255,255,255,0.75)" align="center">The valet team has been notified.</Text>
                    <Text variant="bodySm" color="rgba(255,255,255,0.75)" align="center">We'll notify you when your vehicle is on the way.</Text>
                    <PressableScale
                      onClick={handleCancelRetrieval}
                      disabled={cancelling}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 14,
                        padding: '10px 18px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.35)',
                        backgroundColor: 'rgba(0,0,0,0.14)', opacity: cancelling ? 0.6 : 1,
                      }}>
                      <Icon name="close" size={13} color="#fff" />
                      <Text variant="label" color="#fff">{cancelling ? 'Cancelling…' : 'Cancel request'}</Text>
                    </PressableScale>
                  </>
                )}
              </div>
            </div>
          );
        })()}

        {/* Park job in motion — no ETA to count down to, just a live-track link. */}
        {parkInMotion && (
          <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), borderRadius: 22, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: shadow(isDark, 'e2')}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <Icon name="carKey" size={15} color="rgba(255,255,255,0.85)" />
              <Text variant="subhead" color="#fff" numberOfLines={1} style={{flex: 1}}>
                {displayTask?.status === 'key_collected'
                  ? `${displayTask?.driverName ?? 'Driver'} has your key`
                  : `${displayTask?.driverName ?? 'Driver'} is parking your car`}
              </Text>
            </div>
            <PressableScale
              onClick={() => setShowTracking(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12,
                padding: '12px 20px', border: '1px solid rgba(255,255,255,0.3)',
              }}>
              <Icon name="map" size={15} color="#fff" />
              <Text variant="label" color="#fff">Track live</Text>
            </PressableScale>
          </div>
        )}

        {/* Arrival / Departure launcher — mutually exclusive states, so at
            most one ever renders (shared LauncherCard). */}
        {!hydrated && (
          <SkeletonBlock height={82} radius={22} />
        )}
        {hydrated && showEmptyState && (
          <LauncherCard icon="bellAlert" title="Arrival" subtitle="Let the valet know you're coming" onClick={() => setShowArrivalModal(true)} />
        )}
        {hydrated && carIsParked && !activeRetrieve && (
          <LauncherCard icon="car" title="Departure" subtitle="Request your car back" onClick={() => setShowDepartureModal(true)} />
        )}

        {/* Arrival-notified strip — driven by the server record so a reload
            can't lose it, with "take it back" when plans change. */}
        {(myArrivalNotice || arrivalSent) && showEmptyState && (
          <div style={{display: 'flex', alignItems: 'center', gap: 8, borderRadius: 14, border: `1px solid ${colors.success}30`, padding: 12, backgroundColor: colors.successLight}}>
            <Icon name="bellAlert" size={16} color={colors.success} />
            <Text variant="caption" color={colors.success} style={{flex: 1, fontWeight: 700}}>
              {(() => {
                const eta = myArrivalNotice?.eta ?? arrivalSent ?? 0;
                return `Valet notified — arriving in ~${eta >= 60 ? `${eta / 60} hr` : `${eta} min`}`;
              })()}
            </Text>
            {!!myArrivalNotice && (
              <PressableScale
                onClick={handleCancelArrival}
                disabled={cancellingArrival}
                style={{background: 'transparent', border: 'none', padding: 0, flexShrink: 0}}>
                {cancellingArrival
                  ? <span className="spinner" style={{width: 13, height: 13, borderColor: colors.success + '40', borderTopColor: colors.success}} />
                  : <Text variant="caption" color={colors.success} style={{fontWeight: 800, textDecoration: 'underline'}}>Cancel</Text>}
              </PressableScale>
            )}
          </div>
        )}

        {/* Vehicle status card — the slot number IS the answer when parked. */}
        <Surface elevation="e2" radius={20} padding={0}>
          {!hydrated ? (
            <div style={{padding: 20}}>
              <SkeletonBlock height={12} width="35%" />
              <SkeletonBlock height={34} width="55%" style={{marginTop: 12}} />
              <SkeletonBlock height={12} width="70%" style={{marginTop: 14}} />
            </div>
          ) : showEmptyState || !displayTask ? (
            <div style={{padding: 20}}>
              <StatusRow eyebrow="Vehicle status" status="No active session" statusColor={colors.textMuted} />
              <div style={{display: 'flex', alignItems: 'center', gap: 12, marginTop: 10}}>
                <span style={{width: 44, height: 44, borderRadius: 13, backgroundColor: colors.cardAlt, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                  <Icon name="carSide" size={22} color={colors.textMuted} />
                </span>
                <div>
                  <Text variant="heading" tone="secondary" as="div">No car parked</Text>
                  <Text variant="bodySm" tone="muted" as="div" style={{marginTop: 4}}>Hand your keys to the valet at the entrance.</Text>
                </div>
              </div>
            </div>
          ) : carIsParked ? (
            <div style={{padding: 20}}>
              <StatusRow eyebrow="Parked at" status="Safely parked" statusColor={colors.success} />
              <Text variant="display" as="div" style={{fontSize: 40, marginTop: 8, fontVariantNumeric: 'tabular-nums'}}>{displayTask.slotId ?? '—'}</Text>
              <Text variant="bodySm" tone="secondary" as="div" style={{marginTop: 10}}>
                {displayTask.carNumber}
                {displayTask.driverName ? `  ·  Parked by ${displayTask.driverName}` : ''}
              </Text>
            </div>
          ) : carJustRetrieved ? (
            <div style={{padding: 20}}>
              <StatusRow eyebrow="Retrieving" status="Ready for pickup" statusColor={colors.success} />
              <Text variant="heading" as="div" style={{marginTop: 8}}>Collect at the valet counter</Text>
              <Text variant="bodySm" tone="secondary" as="div" style={{marginTop: 8}}>{displayTask.carNumber}</Text>
            </div>
          ) : (
            <div style={{padding: 20}}>
              <StatusRow
                eyebrow={displayTask.type === 'park' ? 'Parking' : 'Retrieving'}
                status={statusInfo?.label ?? ''}
                statusColor={statusInfo?.color ?? colors.textMuted}
              />
              <Text variant="heading" as="div" style={{marginTop: 8}}>
                {displayTask.driverName ? `${displayTask.driverName} has your car` : 'Waiting for a driver'}
              </Text>
              <Text variant="bodySm" tone="secondary" as="div" style={{marginTop: 8}}>
                {displayTask.carNumber}
                {displayTask.driverName ? `  ·  ${displayTask.driverName}` : ''}
              </Text>
            </div>
          )}
        </Surface>

        {/* Past sessions */}
        <Surface interactive onClick={onOpenHistory} elevation="e1" radius={16} padding={14}>
          <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <Icon name="history" size={18} color={colors.textPrimary} />
            <Text variant="label" style={{flex: 1, textAlign: 'left'}}>View parking history</Text>
            <Icon name="arrowRight" size={16} color={colors.textMuted} />
          </div>
        </Surface>
      </div>

      {/* Arrival popup */}
      <BottomSheetModal visible={showArrivalModal} onClose={() => setShowArrivalModal(false)}>
        <div style={{background: gradientCss(isDark ? BRAND_GRADIENT_DARK : BRAND_GRADIENT), padding: 18, position: 'relative'}}>
          <PressableScale
            onClick={() => setShowArrivalModal(false)}
            style={{position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <Icon name="close" size={16} color="#fff" />
          </PressableScale>
          <Text variant="heading" color="#fff" as="div">{arrivalSent ? 'Valet Notified' : 'On Your Way?'}</Text>
          <Text variant="caption" color="rgba(255,255,255,0.75)" as="div" style={{marginTop: 3}}>
            {arrivalSent
              ? `We told the valet you'll arrive in ~${arrivalSent >= 60 ? `${arrivalSent / 60} hr` : `${arrivalSent} min`}`
              : 'Let the valet know before you get here so a driver is ready'}
          </Text>
        </div>
        {!arrivalSent && (
          <div style={{padding: 16}}>
            <Text variant="overline" tone="muted" uppercase as="div" style={{marginBottom: 12}}>When will you arrive?</Text>
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
            <Button
              onClick={handleArrival}
              disabled={!arrivalEta}
              loading={sendingArrival}
              fullWidth
              size="lg"
              shape="rounded"
              rightIcon={arrivalEta ? 'arrowRight' : undefined}
              style={{marginTop: 14}}>
              {arrivalEta ? 'Notify the valet' : 'Select a time above'}
            </Button>
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
          <Text variant="heading" color="#fff" as="div">Ready to Leave?</Text>
          <Text variant="caption" color="rgba(255,255,255,0.75)" as="div" style={{marginTop: 3}}>We'll notify the valet team so they can plan your retrieval</Text>
        </div>
        <div style={{padding: 16}}>
          <Text variant="overline" tone="muted" uppercase as="div" style={{marginBottom: 12}}>When are you leaving?</Text>
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
                <div style={{marginTop: 10, textAlign: 'center'}}>
                  <Text variant="caption" tone="secondary" style={{fontWeight: 700}}>
                    Leaving at {fmtClock12(customH, customM)}
                    {departureMinutes != null && departureMinutes >= 720 ? ' tomorrow' : ''}
                    {departureMinutes != null && `  ·  in ${Math.floor(departureMinutes / 60)}h ${departureMinutes % 60}m`}
                  </Text>
                </div>
              </div>
            );
          })()}

          <Button
            onClick={handleDeparture}
            disabled={departureMinutes == null}
            loading={requesting}
            fullWidth
            size="lg"
            shape="rounded"
            rightIcon={departureMinutes != null ? 'arrowRight' : undefined}
            style={{marginTop: 14}}>
            {departureMinutes != null ? 'Send departure request' : 'Select a time above'}
          </Button>
        </div>
      </BottomSheetModal>
    </div>
  );
}
