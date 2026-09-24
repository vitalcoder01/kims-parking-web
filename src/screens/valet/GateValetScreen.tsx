import React, {useState, useRef, useEffect} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useTheme} from '../../context/ThemeContext';
import {Icon, IconName} from '../../components/Icon';
import {DriverPickerList} from '../../components/DriverPickerList';
import {usersApi} from '../../services/api';
import {VehicleNumberInput} from '../../components/VehicleNumberInput';
import {useValetActions} from './useValetActions';
import type {ParkingTask} from '../../context/AppStateContext';
import {useAppState} from '../../context/AppStateContext';
import {useDialog} from '../../components/AppDialog';
import {EnRouteTimer} from '../../components/EnRouteTimer';
import {deriveJobAction} from '../../core/valet/state/JobAction';

type GateSubView = 'dashboard' | 'scan' | 'visitor' | 'assign';

interface GateValetScreenProps {
  onSwitchStation?: () => void;
  isSupervisor?: boolean;
}

export function GateValetScreen({onSwitchStation, isSupervisor}: GateValetScreenProps) {
  const {user} = useAuth();
  const dialog = useDialog();
  const {colors, isDark} = useTheme();
  const {hydrated} = useAppState();

  const {
    tasks,
    visitors,
    drivers,
    arrivalNotices,
    dismissArrivalNotice,
    availableDrivers,
    addVisitor,
    assignVisitorPickupDriver,
    confirmTaskDelivered,
    cancelTask,
    recallTask,
    confirmArrivedByValet,
    gateHandoff,
  } = useValetActions();

  // Navigation sub-views inside Gate Workstation
  const [subView, setSubView] = useState<GateSubView>('dashboard');

  // Intake State: Staff / Doctor Key Collection
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [foundUser, setFoundUser] = useState<any | null>(null);
  const [carNumber, setCarNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingGateJob, setPendingGateJob] = useState<{
    doctorId: number;
    doctorName: string;
    carNumber: string;
  } | null>(null);

  // Intake State: Visitor Check-In
  const [vName, setVName] = useState('');
  const [vCar, setVCar] = useState('');
  const [vMobile, setVMobile] = useState('');
  const [vVehicleType, setVVehicleType] = useState<'car' | 'bike'>('car');
  const [mobileTouched, setMobileTouched] = useState(false);
  const [carTouched, setCarTouched] = useState(false);
  const [pendingVisitorId, setPendingVisitorId] = useState<number | null>(null);

  // Curbside Handover & Action Tracking
  const [confirmingArrivedId, setConfirmingArrivedId] = useState<number | null>(null);
  const [confirmingHandoverId, setConfirmingHandoverId] = useState<number | null>(null);
  const [arrivingId, setArrivingId] = useState<number | null>(null);
  const [dismissingArrivalId, setDismissingArrivalId] = useState<number | null>(null);

  // Driver Assignment State
  const [driverSearch, setDriverSearch] = useState('');
  const [assigningDriverId, setAssigningDriverId] = useState<number | null>(null);

  // Form focus helpers
  const [focused, setFocused] = useState<string | null>(null);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const now = Date.now();
  const todayLabel = new Date().toLocaleDateString(undefined, {weekday: 'short', month: 'short', day: 'numeric'});
  const vMobileDigits = vMobile.replace(/\D/g, '');
  const mobileValid = vMobileDigits.length === 10;
  const canCheckIn = mobileValid && vCar.trim().length > 0;

  // Curbside Queue: Vehicles returning from the lot or sitting at the front curb!
  const curbsideVehicles = tasks.filter(t =>
    t.type === 'retrieve' &&
    (t.status === 'assigned' || t.status === 'in_transit' || t.status === 'delivered')
  );

  // In-flight dispatches from gate: cars handed off to runners on their way down to the lot
  const inboundDispatches = tasks.filter(t =>
    t.type === 'park' &&
    (t.status === 'assigned' || t.status === 'key_collected')
  );

  // ── Auto-lookup doctor 3-digit badge code ──
  useEffect(() => {
    if (code.length === 3 && subView === 'scan') {
      let cancelled = false;
      setCodeError('');
      usersApi.lookupByCardCode(code)
        .then((u: any) => {
          if (cancelled) return;
          setFoundUser(u);
          if (u.carNumber) {
            setCarNumber(u.carNumber);
          }
        })
        .catch((err: any) => {
          if (cancelled) return;
          setCodeError(err.message || 'No staff member matches code ' + code);
          setCode('');
        });
      return () => { cancelled = true; };
    }
  }, [code, subView]);

  // ── Handlers ──
  const handleKeyReceived = () => {
    if (!foundUser || !carNumber.trim()) return;
    setPendingGateJob({
      doctorId: foundUser.id,
      doctorName: foundUser.name,
      carNumber: carNumber.trim().toUpperCase(),
    });
    setFoundUser(null);
    setCode('');
    setCarNumber('');
    setSubView('assign');
  };

  const handleAddVisitor = async () => {
    if (!canCheckIn || submitting) return;
    setSubmitting(true);
    try {
      const visitor = await addVisitor({
        name: vName.trim(),
        carNumber: vCar.trim().toUpperCase(),
        mobile: vMobileDigits,
        vehicleType: vVehicleType,
      });

      setVName('');
      setVCar('');
      setVMobile('');
      setVVehicleType('car');
      setMobileTouched(false);
      setCarTouched(false);

      dialog.show({
        title: 'Visitor Checked In',
        tone: 'success',
        message: `Token: #${visitor.token}\nVehicle: ${visitor.carNumber || 'Car'}\nMobile: ${vMobileDigits}\n\nWhatsApp tracking link has been sent. Hand this token to the visitor.`,
        buttons: [{
          text: 'Assign Runner Driver',
          onPress: () => {
            setPendingGateJob(null);
            setPendingVisitorId(visitor.id);
            setSubView('assign');
          },
        }],
      });
    } catch (err: any) {
      dialog.alert(err.message || 'Could not check in visitor', {title: 'Error'});
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssignDriver = async (driverId: number) => {
    if (assigningDriverId != null) return;
    setAssigningDriverId(driverId);
    try {
      if (pendingGateJob) {
        // Fast Gate Handoff: creates park task + assigns driver + marks key collected in 1 tap!
        await gateHandoff({
          doctorId: pendingGateJob.doctorId,
          carNumber: pendingGateJob.carNumber,
          driverId,
        });
        setPendingGateJob(null);
        setSubView('dashboard');
      } else if (pendingVisitorId) {
        await assignVisitorPickupDriver(pendingVisitorId, driverId);
        setPendingVisitorId(null);
        setSubView('dashboard');
      }
    } catch (err: any) {
      dialog.alert(err.message || 'Could not assign driver', {title: 'Assignment Failed'});
    } finally {
      setAssigningDriverId(null);
    }
  };

  const handleConfirmArrived = async (taskId: number) => {
    if (confirmingArrivedId != null) return;
    setConfirmingArrivedId(taskId);
    try {
      await confirmArrivedByValet(taskId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not confirm arrival', {title: 'Error'});
    } finally {
      setConfirmingArrivedId(null);
    }
  };

  const handleConfirmHandover = async (taskId: number) => {
    if (confirmingHandoverId != null) return;
    setConfirmingHandoverId(taskId);
    try {
      await confirmTaskDelivered(taskId);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not confirm handover', {title: 'Error'});
    } finally {
      setConfirmingHandoverId(null);
    }
  };

  const handleArrivalArrived = async (a: any) => {
    if (arrivingId != null) return;
    if (!a.doctorCarNumber?.trim()) {
      setFoundUser({id: a.doctorId, name: a.doctorName, department: a.doctorDepartment, employeeId: a.doctorEmployeeId});
      setCarNumber('');
      setSubView('scan');
      return;
    }
    setPendingGateJob({
      doctorId: a.doctorId,
      doctorName: a.doctorName,
      carNumber: a.doctorCarNumber.trim().toUpperCase(),
    });
    setSubView('assign');
  };

  const handleDismissArrival = async (id: number) => {
    if (dismissingArrivalId != null) return;
    setDismissingArrivalId(id);
    try {
      await dismissArrivalNotice(id);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not dismiss arrival', {title: 'Error'});
    } finally {
      setDismissingArrivalId(null);
    }
  };

  const handleRecallTask = async (taskId: number, plate: string) => {
    const ok = await dialog.confirm({
      title: 'Recall Vehicle?',
      message: `The driver will be commanded NOT to park ${plate} and to bring it back to the gate counter immediately.`,
      confirmText: 'Recall Car',
      destructive: true,
    });
    if (!ok) return;
    recallTask(taskId).catch(err => dialog.alert(err.message || 'Could not recall vehicle'));
  };

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-VIEW 1: STAFF KEY COLLECTION (SCAN / 3-DIGIT CODE)
  // ══════════════════════════════════════════════════════════════════════════
  if (subView === 'scan') {
    return (
      <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
        <div className="valet-container" style={{maxWidth: 580}}>
          {/* Top Bar */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <button
              type="button"
              className="pressable"
              onClick={() => { setSubView('dashboard'); setFoundUser(null); setCode(''); setCodeError(''); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
              }}
            >
              <Icon name="back" size={16} color={colors.textPrimary} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>Back to Gate Desk</span>
            </button>
            <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted}}>
              Intake Desk
            </span>
          </div>

          <div
            className="valet-glass-card"
            style={{
              padding: '28px 24px',
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.88)',
            }}
          >
            {!foundUser ? (
              <>
                <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12}}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      backgroundColor: 'rgba(37, 99, 235, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="key" size={17} color="#2563EB" />
                  </div>
                  <div>
                    <h2 style={{fontSize: 17, fontWeight: 700, color: colors.textPrimary, margin: 0}}>
                      Staff Key Handover
                    </h2>
                    <p style={{fontSize: 12.5, color: colors.textSecondary, margin: '2px 0 0 0'}}>
                      Enter 3-digit card code shown on doctor's pass
                    </p>
                  </div>
                </div>

                {/* 3-Digit Code Entry */}
                <div
                  style={{
                    position: 'relative',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 12,
                    margin: '28px 0',
                    cursor: 'text',
                  }}
                  onClick={() => hiddenInputRef.current?.focus()}
                >
                  {[0, 1, 2].map(i => {
                    const digit = code[i];
                    const isActive = focused === 'code' && code.length === i;
                    return (
                      <div
                        key={i}
                        style={{
                          width: 58,
                          height: 68,
                          borderRadius: 12,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 28,
                          fontWeight: 800,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                          border: `1.5px solid ${
                            isActive
                              ? '#2563EB'
                              : digit
                              ? isDark ? 'rgba(255,255,255,0.2)' : '#94A3B8'
                              : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'
                          }`,
                          boxShadow: isActive ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none',
                          color: colors.textPrimary,
                        }}
                      >
                        {digit ?? ''}
                      </div>
                    );
                  })}
                  <input
                    ref={hiddenInputRef}
                    type="tel"
                    maxLength={3}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    onFocus={() => setFocused('code')}
                    onBlur={() => setFocused(null)}
                    style={{position: 'absolute', opacity: 0, width: 0, height: 0}}
                    autoFocus
                  />
                </div>

                {!!codeError && (
                  <div
                    style={{
                      borderRadius: 8,
                      padding: '9px 12px',
                      backgroundColor: 'rgba(225, 29, 72, 0.08)',
                      border: '1px solid rgba(225, 29, 72, 0.25)',
                      color: '#E11D48',
                      fontSize: 12.5,
                      fontWeight: 600,
                      textAlign: 'center',
                      marginBottom: 14,
                    }}
                  >
                    {codeError}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Doctor Verified Card */}
                <div
                  style={{
                    padding: 16,
                    borderRadius: 10,
                    backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : 'rgba(37,99,235,0.04)',
                    border: '1px solid rgba(37,99,235,0.2)',
                    marginBottom: 20,
                  }}
                >
                  <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.6, color: '#2563EB', textTransform: 'uppercase'}}>
                    Doctor Identified
                  </div>
                  <div style={{fontSize: 18, fontWeight: 800, color: colors.textPrimary, marginTop: 4}}>
                    {foundUser.name}
                  </div>
                  <div style={{fontSize: 12.5, color: colors.textSecondary, marginTop: 2}}>
                    {foundUser.department || 'Department not listed'} &bull; ID: {foundUser.employeeId || 'N/A'}
                  </div>
                </div>

                {/* Plate input */}
                <div style={{marginBottom: 20}}>
                  <label style={{display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary, marginBottom: 6}}>
                    Vehicle Registration Plate
                  </label>
                  <input
                    style={{
                      width: '100%',
                      height: 44,
                      borderRadius: 8,
                      border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}`,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      padding: '0 14px',
                      fontSize: 15,
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.04em',
                      color: colors.textPrimary,
                    }}
                    value={carNumber}
                    onChange={e => setCarNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. TS 09 AB 1234"
                    autoFocus
                  />
                </div>

                <button
                  type="button"
                  className="pressable"
                  onClick={handleKeyReceived}
                  disabled={!carNumber.trim()}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 8,
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    cursor: carNumber.trim() ? 'pointer' : 'default',
                    opacity: carNumber.trim() ? 1 : 0.6,
                  }}
                >
                  <Icon name="check" size={16} color="#FFFFFF" />
                  <span>Assign Runner Driver &rarr;</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-VIEW 2: VISITOR CHECK-IN FORM
  // ══════════════════════════════════════════════════════════════════════════
  if (subView === 'visitor') {
    return (
      <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
        <div className="valet-container" style={{maxWidth: 580}}>
          {/* Top Bar */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <button
              type="button"
              className="pressable"
              onClick={() => { setSubView('dashboard'); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
              }}
            >
              <Icon name="back" size={16} color={colors.textPrimary} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>Back to Gate Desk</span>
            </button>
            <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted}}>
              Visitor Intake
            </span>
          </div>

          <div
            className="valet-glass-card"
            style={{
              padding: '28px 24px',
              backgroundColor: isDark ? 'rgba(15, 23, 42, 0.82)' : 'rgba(255, 255, 255, 0.88)',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18}}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  backgroundColor: 'rgba(15, 23, 42, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name="ticket" size={17} color={colors.textPrimary} />
              </div>
              <div>
                <h2 style={{fontSize: 17, fontWeight: 700, color: colors.textPrimary, margin: 0}}>
                  Visitor &amp; Patient Check-In
                </h2>
                <p style={{fontSize: 12.5, color: colors.textSecondary, margin: '2px 0 0 0'}}>
                  Issues 3-digit physical token and automated WhatsApp tracking link
                </p>
              </div>
            </div>

            {/* Mobile number */}
            <div style={{marginBottom: 14}}>
              <label style={{display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary, marginBottom: 6}}>
                Mobile Number <span style={{color: '#E11D48'}}>*</span>
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  height: 44,
                  borderRadius: 8,
                  border: `1px solid ${mobileTouched && !mobileValid ? '#E11D48' : isDark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  padding: '0 12px',
                }}
              >
                <Icon name="phone" size={16} color={colors.textMuted} />
                <input
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.textPrimary,
                  }}
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={vMobile}
                  onChange={e => setVMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  onBlur={() => setMobileTouched(true)}
                  autoFocus
                />
                {mobileValid && <Icon name="check" size={16} color="#059669" />}
              </div>
              {mobileTouched && !mobileValid && (
                <div style={{fontSize: 11.5, color: '#E11D48', marginTop: 4, fontWeight: 600}}>
                  Enter all 10 digits ({vMobileDigits.length}/10)
                </div>
              )}
            </div>

            {/* Vehicle plate */}
            <div style={{marginBottom: 14}}>
              <VehicleNumberInput
                value={vCar}
                onChange={setVCar}
                touched={carTouched}
                onTouch={() => setCarTouched(true)}
                required
              />
            </div>

            {/* Vehicle Type Toggle */}
            <div style={{marginBottom: 16}}>
              <label style={{display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary, marginBottom: 6}}>
                Vehicle Type
              </label>
              <div style={{display: 'flex', gap: 10}}>
                {(['car', 'bike'] as const).map(t => {
                  const isSel = vVehicleType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      className="pressable"
                      onClick={() => setVVehicleType(t)}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        backgroundColor: isSel ? (isDark ? '#F8FAFC' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'),
                        color: isSel ? (isDark ? '#0F172A' : '#FFFFFF') : colors.textPrimary,
                        border: `1px solid ${isSel ? 'transparent' : isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name={t === 'car' ? 'car' : 'bike'} size={16} color={isSel ? (isDark ? '#0F172A' : '#FFFFFF') : colors.textSecondary} />
                      <span style={{textTransform: 'capitalize'}}>{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Visitor Name (Optional) */}
            <div style={{marginBottom: 20}}>
              <label style={{display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary, marginBottom: 6}}>
                Visitor Name <span style={{fontSize: 10, color: colors.textMuted}}>(Optional)</span>
              </label>
              <input
                style={{
                  width: '100%',
                  height: 44,
                  borderRadius: 8,
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.14)' : '#CBD5E1'}`,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  padding: '0 14px',
                  fontSize: 14,
                  color: colors.textPrimary,
                }}
                placeholder="Patient / guest name"
                value={vName}
                onChange={e => setVName(e.target.value)}
              />
            </div>

            {/* Submit Action */}
            <button
              type="button"
              className="pressable"
              onClick={handleAddVisitor}
              disabled={!canCheckIn || submitting}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 8,
                backgroundColor: canCheckIn ? (isDark ? '#F8FAFC' : '#0F172A') : (isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'),
                color: canCheckIn ? (isDark ? '#0F172A' : '#FFFFFF') : colors.textMuted,
                border: 'none',
                fontSize: 14,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: canCheckIn && !submitting ? 'pointer' : 'default',
              }}
            >
              {submitting ? (
                <span className="spinner" style={{width: 16, height: 16}} />
              ) : (
                <>
                  <Icon name="check" size={16} color={canCheckIn ? (isDark ? '#0F172A' : '#FFFFFF') : colors.textMuted} />
                  <span>Issue Token &amp; Pick Runner &rarr;</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-VIEW 3: DRIVER RUNNER PICKER (Fewest jobs today first)
  // ══════════════════════════════════════════════════════════════════════════
  if (subView === 'assign') {
    const visibleDrivers = availableDrivers
      .filter(d => d.name.toLowerCase().includes(driverSearch.trim().toLowerCase()))
      .slice()
      .sort((a, b) => (a.completedToday ?? 0) - (b.completedToday ?? 0) || a.name.localeCompare(b.name));

    return (
      <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
        <div className="valet-container" style={{maxWidth: 620}}>
          {/* Top Bar */}
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
            <button
              type="button"
              className="pressable"
              onClick={() => { setSubView('dashboard'); setPendingGateJob(null); setPendingVisitorId(null); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
              }}
            >
              <Icon name="back" size={16} color={colors.textPrimary} />
              <span style={{fontSize: 13, fontWeight: 600, color: colors.textPrimary}}>Cancel Handoff</span>
            </button>
            <span style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: colors.textMuted}}>
              Runner Dispatch
            </span>
          </div>

          {/* Context Card: Who is being parked */}
          {pendingGateJob && (
            <div
              className="valet-glass-card"
              style={{
                padding: 16,
                backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.05)',
                border: '1px solid rgba(37,99,235,0.22)',
              }}
            >
              <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <div>
                  <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: '#2563EB', textTransform: 'uppercase'}}>
                    Doctor Key Handover
                  </div>
                  <div style={{fontSize: 17, fontWeight: 800, color: colors.textPrimary, marginTop: 2}}>
                    {pendingGateJob.doctorName}
                  </div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.04em',
                      padding: '4px 8px',
                      borderRadius: 6,
                      backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                      color: isDark ? '#0F172A' : '#FFFFFF',
                    }}
                  >
                    {pendingGateJob.carNumber}
                  </span>
                </div>
              </div>
            </div>
          )}

          {pendingVisitorId && (
            (() => {
              const v = visitors.find(vis => vis.id === pendingVisitorId);
              return (
                <div
                  className="valet-glass-card"
                  style={{
                    padding: 16,
                    backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : 'rgba(37,99,235,0.05)',
                    border: '1px solid rgba(37,99,235,0.22)',
                  }}
                >
                  <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                    <div>
                      <div style={{fontSize: 11, fontWeight: 700, letterSpacing: 0.8, color: '#2563EB', textTransform: 'uppercase'}}>
                        Visitor Key Handover &bull; Token #{v?.token || 'N/A'}
                      </div>
                      <div style={{fontSize: 17, fontWeight: 800, color: colors.textPrimary, marginTop: 2}}>
                        {v?.name || 'Visitor'}
                      </div>
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 800,
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '0.04em',
                          padding: '4px 8px',
                          borderRadius: 6,
                          backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                          color: isDark ? '#0F172A' : '#FFFFFF',
                        }}
                      >
                        {v?.carNumber || 'Vehicle'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()
          )}

          {/* Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 44,
              borderRadius: 8,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
              padding: '0 12px',
            }}
          >
            <Icon name="search" size={16} color={colors.textMuted} />
            <input
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: 13.5,
                color: colors.textPrimary,
              }}
              placeholder="Filter available runners…"
              value={driverSearch}
              onChange={e => setDriverSearch(e.target.value)}
            />
          </div>

          {/* Driver List */}
          <DriverPickerList
            drivers={visibleDrivers}
            onAssign={handleAssignDriver}
            assigningId={assigningDriverId}
          />
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-VIEW 4: THE GATE WORKSTATION DASHBOARD (MAIN SCREEN)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="valet-workstation-viewport" style={{backgroundColor: isDark ? '#0B0F17' : '#F8FAFC'}}>
      <div className="valet-container">
        {/* Workstation Header */}
        <div
          className="valet-glass-card"
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: isDark ? '#FFFFFF' : '#0F172A',
                color: isDark ? '#0F172A' : '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="parking" size={22} color={isDark ? '#0F172A' : '#FFFFFF'} />
            </div>
            <div>
              <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                <h1 style={{fontSize: 17, fontWeight: 800, color: colors.textPrimary, margin: 0, letterSpacing: -0.2}}>
                  Gate Intake &amp; Curbside Handover
                </h1>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: 9999,
                    backgroundColor: 'rgba(37,99,235,0.1)',
                    color: '#2563EB',
                    border: '1px solid rgba(37,99,235,0.25)',
                  }}
                >
                  Gate Station
                </span>
              </div>
              <div style={{fontSize: 12, color: colors.textSecondary, marginTop: 2}}>
                Operator: <strong style={{color: colors.textPrimary}}>{user?.name}</strong> &bull; {todayLabel}
              </div>
            </div>
          </div>

          {/* Supervisor station toggle button (if unassigned or supervisor) */}
          {(isSupervisor || onSwitchStation) && (
            <button
              type="button"
              className="pressable"
              onClick={onSwitchStation}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 8,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                cursor: 'pointer',
              }}
            >
              <Icon name="map" size={14} color={colors.textSecondary} />
              <span style={{fontSize: 12, fontWeight: 600, color: colors.textPrimary}}>
                Switch to Lot Station
              </span>
            </button>
          )}
        </div>

        {/* Rapid Action Bar (The Gate Counter's Primary CTAs) */}
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12}}>
          {/* Quick Staff Key Handover */}
          <button
            type="button"
            className="pressable"
            onClick={() => setSubView('scan')}
            style={{
              height: 48,
              borderRadius: 10,
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
            }}
          >
            <Icon name="key" size={18} color="#FFFFFF" />
            <span style={{fontSize: 14, fontWeight: 700}}>+ Staff Key Handover</span>
          </button>

          {/* Quick Visitor Check-in */}
          <button
            type="button"
            className="pressable"
            onClick={() => setSubView('visitor')}
            style={{
              height: 48,
              borderRadius: 10,
              backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
              color: isDark ? '#0F172A' : '#FFFFFF',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
            }}
          >
            <Icon name="ticket" size={18} color={isDark ? '#0F172A' : '#FFFFFF'} />
            <span style={{fontSize: 14, fontWeight: 700}}>+ Check-in Visitor</span>
          </button>
        </div>

        {/* SECTION 1: EXPECTED ARRIVALS RADAR (Doctors pre-announced on the way) */}
        {arrivalNotices.length > 0 && (
          <div
            className="valet-glass-card"
            style={{
              padding: '16px 18px',
              backgroundColor: isDark ? 'rgba(37,99,235,0.06)' : 'rgba(37,99,235,0.03)',
              border: '1px solid rgba(37,99,235,0.2)',
            }}
          >
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
              <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
                <Icon name="bellAlert" size={16} color="#2563EB" />
                <span style={{fontSize: 13, fontWeight: 800, color: '#2563EB', textTransform: 'uppercase', letterSpacing: 0.6}}>
                  Expected Arrivals Radar ({arrivalNotices.length})
                </span>
              </div>
              <span style={{fontSize: 11, color: colors.textMuted}}>
                Doctors heading to hospital
              </span>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10}}>
              {arrivalNotices.map(a => (
                <div
                  key={a.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 8,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'}`,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                    <div>
                      <div style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary}}>{a.doctorName}</div>
                      <div style={{fontSize: 12, fontWeight: 600, color: colors.textSecondary, fontVariantNumeric: 'tabular-nums'}}>
                        {a.doctorCarNumber?.trim() || 'Plate on file'}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 6,
                        backgroundColor: 'rgba(37,99,235,0.1)',
                        color: '#2563EB',
                      }}
                    >
                      ~{a.eta >= 60 ? `${Math.round(a.eta / 6) / 10} hr` : `${a.eta} min`}
                    </span>
                  </div>

                  <div style={{display: 'flex', gap: 8}}>
                    <button
                      type="button"
                      className="pressable"
                      onClick={() => handleArrivalArrived(a)}
                      disabled={arrivingId === a.id}
                      style={{
                        flex: 1,
                        height: 34,
                        borderRadius: 6,
                        backgroundColor: '#2563EB',
                        color: '#FFFFFF',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        cursor: 'pointer',
                      }}
                    >
                      <Icon name="key" size={13} color="#FFFFFF" />
                      <span>They've Arrived</span>
                    </button>
                    <button
                      type="button"
                      className="pressable"
                      onClick={() => handleDismissArrival(a.id)}
                      disabled={dismissingArrivalId === a.id}
                      style={{
                        padding: '0 12px',
                        height: 34,
                        borderRadius: 6,
                        backgroundColor: 'transparent',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#CBD5E1'}`,
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: CURBSIDE HANDOVER QUEUE (Top Gate Priority: Returned cars sitting at curb or approaching) */}
        <div>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <Icon name="car" size={16} color={colors.textPrimary} />
              <h2 style={{fontSize: 15, fontWeight: 800, color: colors.textPrimary, margin: 0}}>
                Curbside Pickups &amp; Handovers ({curbsideVehicles.length})
              </h2>
            </div>
            <span style={{fontSize: 11.5, color: colors.textMuted}}>
              Vehicles returning from lot bays
            </span>
          </div>

          {curbsideVehicles.length === 0 ? (
            <div
              className="valet-glass-card"
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                backgroundColor: isDark ? 'rgba(15,23,42,0.5)' : 'rgba(255,255,255,0.6)',
              }}
            >
              <Icon name="check" size={24} color="#059669" />
              <div style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary, marginTop: 8}}>
                Curbside is clear
              </div>
              <div style={{fontSize: 12, color: colors.textMuted, marginTop: 2}}>
                No cars waiting at the entrance counter right now.
              </div>
            </div>
          ) : (
            <div className="valet-queue-grid">
              {curbsideVehicles.map(t => {
                const isDelivered = t.status === 'delivered';
                const driverName = t.driverName || 'Runner Driver';
                const visitorInfo = t.visitorId ? visitors.find(v => v.id === t.visitorId) : null;
                const guestLabel = visitorInfo ? `${visitorInfo.name} (Token #${visitorInfo.token})` : (t.doctorName || 'Guest');

                return (
                  <div
                    key={t.id}
                    className="valet-glass-card"
                    style={{
                      padding: 16,
                      border: isDelivered ? '1.5px solid #059669' : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {/* Header */}
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <div>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '0.04em',
                            color: colors.textPrimary,
                          }}
                        >
                          {t.carNumber}
                        </span>
                        <div style={{fontSize: 12.5, fontWeight: 600, color: colors.textSecondary, marginTop: 2}}>
                          {guestLabel}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          padding: '3px 8px',
                          borderRadius: 6,
                          backgroundColor: isDelivered ? 'rgba(5, 150, 105, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: isDelivered ? '#059669' : '#D97706',
                          border: `1px solid ${isDelivered ? 'rgba(5, 150, 105, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                        }}
                      >
                        {isDelivered ? 'Waiting at Curb' : 'En Route to Gate'}
                      </span>
                    </div>

                    {/* Metadata: Bay + Runner */}
                    <div
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(248,250,252,0.8)',
                        fontSize: 11.5,
                        color: colors.textSecondary,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>From Bay: <strong style={{color: colors.textPrimary}}>{t.slotId || 'Lot'}</strong></span>
                      <span>Runner: <strong style={{color: colors.textPrimary}}>{driverName}</strong></span>
                    </div>

                    {/* Decisive Curbside Actions */}
                    {!isDelivered ? (
                      <button
                        type="button"
                        className="pressable"
                        onClick={() => handleConfirmArrived(t.id)}
                        disabled={confirmingArrivedId === t.id}
                        style={{
                          width: '100%',
                          height: 40,
                          borderRadius: 8,
                          backgroundColor: '#059669',
                          color: '#FFFFFF',
                          border: 'none',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        {confirmingArrivedId === t.id ? (
                          <span className="spinner" style={{width: 14, height: 14}} />
                        ) : (
                          <>
                            <Icon name="check" size={14} color="#FFFFFF" />
                            <span>Car Arrived at Curb</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="pressable"
                        onClick={() => handleConfirmHandover(t.id)}
                        disabled={confirmingHandoverId === t.id}
                        style={{
                          width: '100%',
                          height: 42,
                          borderRadius: 8,
                          backgroundColor: isDark ? '#F8FAFC' : '#0F172A',
                          color: isDark ? '#0F172A' : '#FFFFFF',
                          border: 'none',
                          fontSize: 13,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          cursor: 'pointer',
                        }}
                      >
                        {confirmingHandoverId === t.id ? (
                          <span className="spinner" style={{width: 14, height: 14}} />
                        ) : (
                          <>
                            <Icon name="checkBold" size={14} color={isDark ? '#0F172A' : '#FFFFFF'} />
                            <span>Confirm Handover to Guest</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 3: IN-FLIGHT DISPATCHES (Cars recently handed to runners heading to lot) */}
        {inboundDispatches.length > 0 && (
          <div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
              <h2 style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary, margin: 0}}>
                Inbound Dispatches to Lot ({inboundDispatches.length})
              </h2>
              <span style={{fontSize: 11, color: colors.textMuted}}>
                Keys handed over &bull; heading to bays
              </span>
            </div>

            <div className="valet-queue-grid">
              {inboundDispatches.map(t => (
                <div
                  key={t.id}
                  className="valet-glass-card"
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <span style={{fontSize: 14, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary}}>
                      {t.carNumber}
                    </span>
                    <div style={{fontSize: 11.5, color: colors.textSecondary, marginTop: 1}}>
                      Runner: {t.driverName ?? 'Assigned'}
                    </div>
                  </div>

                  <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: 'rgba(37,99,235,0.08)',
                        color: '#2563EB',
                      }}
                    >
                      En Route
                    </span>
                    <button
                      type="button"
                      className="pressable"
                      onClick={() => handleRecallTask(t.id, t.carNumber)}
                      title="Recall vehicle back to gate"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                        fontSize: 11,
                        fontWeight: 600,
                        color: colors.textMuted,
                        background: 'transparent',
                        cursor: 'pointer',
                      }}
                    >
                      Recall
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
