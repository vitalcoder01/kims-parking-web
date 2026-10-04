import React, {useState, useEffect} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useMyDriverId, isMyJob} from '../../hooks/useMyDriverId';
import {useAppState} from '../../context/AppStateContext';
import {useTheme} from '../../context/ThemeContext';
import {computeTrip} from '../../utils/geo';
import {Icon, IconName} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';
import {useDialog} from '../../components/AppDialog';

function SkeletonBlock({height, width = '100%', radius = 10, style}: {height: number; width?: number | string; radius?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return <div className="pulse" style={{height, width, borderRadius: radius, backgroundColor: colors.cardAlt, ...style}} />;
}

function SkeletonCard({lines = 3, style}: {lines?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return (
    <div style={{borderRadius: 18, border: `1px solid ${colors.border}`, padding: 20, backgroundColor: colors.surface, ...style}}>
      <SkeletonBlock height={14} width="40%" style={{marginBottom: 14}} />
      {Array.from({length: lines}, (_, i) => (
        <SkeletonBlock key={i} height={16} width={i === lines - 1 ? '55%' : '85%'} style={{marginBottom: 10}} />
      ))}
    </div>
  );
}

export function DriverJobsScreen() {
  const {user} = useAuth();
  const {tasks, visitors, markTaskReturned, fetchTaskHistory, hydrated} = useAppState();
  const {colors: c, isDark} = useTheme();
  const dialog = useDialog();

  const [actionBusy, setActionBusy] = useState(false);

  const myDriverId = useMyDriverId();
  const myTasks = tasks.filter(t => isMyJob(t.driverId, myDriverId) && t.status !== 'completed' && t.status !== 'delivered' && t.status !== 'cancelled');
  const activeTask = myTasks[0] ?? null;

  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => {
    if (!myDriverId) return;
    fetchTaskHistory({driverId: myDriverId}).then(setHistory).catch(() => {});
  }, [myDriverId, fetchTaskHistory, tasks]);

  const today = new Date().toDateString();
  const completedToday = history.filter(t => t.status === 'completed' && t.completedAt && new Date(t.completedAt).toDateString() === today);

  const myVisitorJobs = tasks.filter(t =>
    Boolean(t.isVisitor || t.visitorId != null)
    && isMyJob(t.driverId, myDriverId)
    && t.id !== activeTask?.id
    && t.status !== 'completed'
    && t.status !== 'cancelled'
    && t.status !== 'delivered'
  );

  const trip = computeTrip({
    startLat: activeTask?.driverStartLat, startLng: activeTask?.driverStartLng,
    lat: activeTask?.driverLat, lng: activeTask?.driverLng,
    destinationLat: activeTask?.destinationLat, destinationLng: activeTask?.destinationLng,
    mode: 'drive',
  });
  const liveProgress = trip?.progress ?? 0;

  const handleMarkReturned = async () => {
    if (!activeTask || actionBusy) return;
    setActionBusy(true);
    try {
      await markTaskReturned(activeTask.id);
    } catch (err: any) {
      dialog.alert(err.message || 'Could not mark returned');
    } finally {
      setActionBusy(false);
    }
  };

  const statusMeta: Record<string, {label: string; color: string; bg: string; icon: IconName}> = {
    assigned: {
      label: activeTask?.type === 'retrieve' ? 'Go to parking slot' : 'Go to valet counter',
      color: '#D97706',
      bg: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB',
      icon: 'bellAlert',
    },
    key_collected: {
      label: 'Driving vehicle to park',
      color: c.primary,
      bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
      icon: 'carKey',
    },
    in_transit: {
      label: 'Vehicle in transit',
      color: c.primary,
      bg: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
      icon: 'navigate',
    },
    completed: {
      label: 'Trip Completed',
      color: c.success,
      bg: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
      icon: 'check',
    },
  };

  const glassCardStyle: React.CSSProperties = {
    backgroundColor: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.25)' : '0 1px 3px rgba(0, 0, 0, 0.04)',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: c.background, padding: 16, paddingBottom: 80}}>
      {/* 1. Restrained Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
        <div>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: 16, fontWeight: 900, color: c.textPrimary, letterSpacing: -0.2}}>
              Active Tasks
            </span>
            <span style={{
              fontSize: 10,
              fontWeight: 800,
              padding: '2px 7px',
              borderRadius: 6,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
              color: c.primary,
              letterSpacing: 0.4,
            }}>
              RUNNER QUEUE
            </span>
          </div>
          <div style={{fontSize: 11.5, fontWeight: 600, color: c.textSecondary, marginTop: 2}}>
            {user?.name ?? 'Runner Dispatch'} · Real-time task telemetry
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderRadius: 12,
          backgroundColor: c.surface,
          border: `1px solid ${c.border}`,
          flexShrink: 0,
        }}>
          <span style={{fontSize: 15, fontWeight: 900, color: c.primary, fontVariantNumeric: 'tabular-nums'}}>
            {completedToday.length}
          </span>
          <span style={{fontSize: 10.5, fontWeight: 700, color: c.textSecondary}}>
            DONE TODAY
          </span>
        </div>
      </div>

      {/* 2. Active Mission Card */}
      {!hydrated ? (
        <SkeletonCard lines={3} style={{marginBottom: 18}} />
      ) : activeTask ? (
        <div style={{
          ...glassCardStyle,
          overflow: 'hidden',
          marginBottom: 18,
          border: `1.5px solid ${activeTask.type === 'park' ? '#10B981' : '#F59E0B'}`,
        }}>
          {/* Mission Category Banner */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: activeTask.type === 'park' ? '#10B981' : '#F59E0B',
          }}>
            <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
              <Icon
                name={activeTask.type === 'park' ? 'arrowDown' : 'arrowUp'}
                size={16}
                color="#fff"
              />
              <span style={{fontSize: 12, fontWeight: 900, letterSpacing: 0.8, color: '#fff', textTransform: 'uppercase'}}>
                {activeTask.type === 'park' ? 'PARKING TASK' : 'RETRIEVAL TASK'}
              </span>
            </div>
            <span style={{
              fontSize: 10,
              fontWeight: 900,
              padding: '2px 7px',
              borderRadius: 4,
              backgroundColor: 'rgba(255,255,255,0.25)',
              color: '#fff',
              letterSpacing: 0.5,
            }}>
              ACTIVE RUN
            </span>
          </div>

          <div style={{padding: 16, display: 'flex', flexDirection: 'column', gap: 12}}>
            {/* Customer & Vehicle Split Information */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}>
              <div style={{
                padding: '10px 12px',
                borderRadius: 12,
                backgroundColor: c.cardAlt,
                border: `1px solid ${c.border}`,
              }}>
                <div style={{fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, color: c.textMuted, textTransform: 'uppercase'}}>
                  GUEST / DOCTOR
                </div>
                <div style={{fontSize: 14, fontWeight: 800, color: c.textPrimary, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                  {activeTask.doctorName}
                </div>
              </div>

              <div style={{
                padding: '10px 12px',
                borderRadius: 12,
                backgroundColor: c.cardAlt,
                border: `1px solid ${c.border}`,
              }}>
                <div style={{fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, color: c.textMuted, textTransform: 'uppercase'}}>
                  VEHICLE REGISTRATION
                </div>
                <div style={{fontFamily: 'monospace', fontSize: 14, fontWeight: 900, color: c.textPrimary, marginTop: 2}}>
                  {activeTask.carNumber}
                </div>
              </div>
            </div>

            {/* Target Bay Allocation Beacon */}
            {activeTask.slotId && (
              <div style={{
                borderRadius: 14,
                padding: '12px 14px',
                textAlign: 'center',
                backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF',
                border: `1px solid ${isDark ? 'rgba(59, 130, 246, 0.25)' : '#BFDBFE'}`,
              }}>
                <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 1, color: c.primary, textTransform: 'uppercase'}}>
                  {activeTask.type === 'retrieve' ? 'TARGET RETRIEVAL BAY' : 'DESTINATION PARKING BAY'}
                </div>
                <div style={{fontSize: 26, fontWeight: 900, marginTop: 2, color: c.primary, letterSpacing: 0.5}}>
                  BAY {activeTask.slotId}
                </div>
              </div>
            )}

            {/* Status Step Indicator */}
            {activeTask.status in statusMeta && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                padding: '10px 12px',
                backgroundColor: statusMeta[activeTask.status]?.bg,
                border: `1px solid ${statusMeta[activeTask.status]?.color}40`,
              }}>
                <Icon name={statusMeta[activeTask.status]?.icon!} size={16} color={statusMeta[activeTask.status]?.color} />
                <span style={{fontSize: 12.5, fontWeight: 800, color: statusMeta[activeTask.status]?.color}}>
                  {statusMeta[activeTask.status]?.label}
                </span>
              </div>
            )}

            {/* Live Route & ETA Telemetry for Retrieval */}
            {activeTask.type === 'retrieve' && (activeTask.status === 'key_collected' || activeTask.status === 'in_transit') && (
              <div style={{
                borderRadius: 14,
                border: `1px solid ${c.border}`,
                padding: 12,
                backgroundColor: c.cardAlt,
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
                  <span style={{fontSize: 10, fontWeight: 800, letterSpacing: 1, color: c.textSecondary, textTransform: 'uppercase'}}>
                    LIVE TURNAROUND ROUTE
                  </span>
                  {trip ? (
                    <span style={{fontSize: 11.5, fontWeight: 800, color: c.primary, fontVariantNumeric: 'tabular-nums'}}>
                      ETA: {trip.etaMinutes} min{trip.distanceRemainingM != null ? ` (${trip.distanceRemainingM}m)` : ''}
                    </span>
                  ) : (
                    <span style={{fontSize: 11, fontWeight: 700, color: c.textMuted}}>Acquiring GPS fix…</span>
                  )}
                </div>

                <div style={{height: 20, position: 'relative', display: 'flex', alignItems: 'center'}}>
                  <div style={{position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: c.border}} />
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    height: 4,
                    borderRadius: 2,
                    width: `${Math.max(4, liveProgress * 100)}%`,
                    backgroundColor: c.primary,
                    transition: 'width 0.4s ease',
                  }} />
                  <div style={{
                    position: 'absolute',
                    left: `${Math.min(92, liveProgress * 92)}%`,
                    marginTop: -7,
                    marginLeft: -7,
                    transition: 'left 0.4s ease',
                  }}>
                    <Icon name="carSide" size={17} color={c.primary} />
                  </div>
                </div>
              </div>
            )}

            {/* Recalled Notice: Driver returns car to counter */}
            {activeTask.type === 'park' && !!activeTask.recalledAt
              && (activeTask.status === 'key_collected' || activeTask.status === 'in_transit') && (
              <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  borderRadius: 12,
                  padding: 12,
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                  border: `1px solid ${c.error}`,
                }}>
                  <Icon name="bellAlert" size={16} color={c.error} />
                  <span style={{fontSize: 12.5, fontWeight: 800, color: c.error}}>
                    Recall Order: Return car immediately to Valet Counter
                  </span>
                </div>
                <PressableScale
                  onClick={handleMarkReturned}
                  disabled={actionBusy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    borderRadius: 14,
                    height: 46,
                    backgroundColor: c.primary,
                    opacity: actionBusy ? 0.6 : 1,
                    cursor: 'pointer',
                  }}>
                  <Icon name="check" size={16} color={c.textOnPrimary} />
                  <span style={{fontSize: 13.5, fontWeight: 900, color: c.textOnPrimary}}>
                    {actionBusy ? 'Confirming Return…' : 'Confirm Returned to Counter'}
                  </span>
                </PressableScale>
              </div>
            )}

            {/* Park Instructions */}
            {activeTask.type === 'park' && !activeTask.recalledAt && (activeTask.status === 'key_collected' || activeTask.status === 'in_transit') && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                padding: '10px 12px',
                backgroundColor: c.cardAlt,
                border: `1px solid ${c.border}`,
              }}>
                <Icon name="carKey" size={15} color={c.textSecondary} />
                <span style={{fontSize: 12, fontWeight: 700, color: c.textSecondary}}>
                  Drive to designated bay — lot valet will confirm upon slot arrival
                </span>
              </div>
            )}

            {/* Retrieval Instructions */}
            {activeTask.type === 'retrieve' && activeTask.status === 'assigned' && !!activeTask.acceptedAt && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                padding: '10px 12px',
                backgroundColor: c.cardAlt,
                border: `1px solid ${c.border}`,
              }}>
                <Icon name="carKey" size={15} color={c.textSecondary} />
                <span style={{fontSize: 12, fontWeight: 700, color: c.textSecondary}}>
                  Proceed to parking slot — telemetry streams automatically
                </span>
              </div>
            )}

            {activeTask.type === 'retrieve' && activeTask.status === 'in_transit' && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: 12,
                padding: '10px 12px',
                backgroundColor: c.cardAlt,
                border: `1px solid ${c.border}`,
              }}>
                <Icon name="carKey" size={15} color={c.textSecondary} />
                <span style={{fontSize: 12, fontWeight: 700, color: c.textSecondary}}>
                  Drive to curbside gate — gate desk valet will confirm handover
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          ...glassCardStyle,
          padding: 36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          marginBottom: 18,
        }}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 12,
            backgroundColor: c.cardAlt,
          }}>
            <Icon name="check" size={24} color={c.textSecondary} />
          </div>
          <div style={{fontSize: 16, fontWeight: 800, color: c.textPrimary, marginBottom: 4}}>
            Queue Is Clear
          </div>
          <div style={{fontSize: 12, color: c.textSecondary, maxWidth: 280, lineHeight: '18px'}}>
            Standing by for valet assignment. New vehicle dispatches will notify you instantly.
          </div>
        </div>
      )}

      {/* 3. Visitor Pickups Section */}
      {myVisitorJobs.length > 0 && (
        <div style={{marginBottom: 18}}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 10,
          }}>
            <Icon name="people" size={14} color={c.primary} />
            <span style={{fontSize: 13.5, fontWeight: 800, color: c.textPrimary, letterSpacing: -0.1}}>
              Assigned Visitor Pickups ({myVisitorJobs.length})
            </span>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {myVisitorJobs.map(v => (
              <div
                key={v.id}
                style={{
                  ...glassCardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  padding: 12,
                  gap: 12,
                }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: c.cardAlt,
                }}>
                  <Icon name="car" size={17} color={c.primary} />
                </div>

                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 13, fontWeight: 800, color: c.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                    {v.doctorName || 'Visitor'} {v.carNumber ? `· ${v.carNumber}` : ''}
                  </div>
                  <div style={{fontSize: 11, fontWeight: 600, color: c.textSecondary, marginTop: 2}}>
                    {v.slotId ? `Assigned Bay: ${v.slotId}` : 'Terminal staging area'}
                  </div>
                </div>

                <span style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  borderRadius: 6,
                  padding: '4px 8px',
                  whiteSpace: 'nowrap',
                  color: v.type === 'park' ? '#D97706' : c.primary,
                  backgroundColor: v.type === 'park' ? (isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB') : c.cardAlt,
                }}>
                  {v.type === 'park' ? 'PICKUP PENDING' : 'RETRIEVAL READY'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Completed Today Section */}
      {completedToday.length > 0 && (
        <div>
          <div style={{fontSize: 13.5, fontWeight: 800, marginBottom: 10, color: c.textPrimary, letterSpacing: -0.1}}>
            Completed Runs Today ({completedToday.length})
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
            {completedToday.map(t => (
              <div
                key={t.id}
                style={{
                  ...glassCardStyle,
                  display: 'flex',
                  alignItems: 'center',
                  padding: 12,
                  gap: 12,
                }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: t.type === 'park' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') : (isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF'),
                }}>
                  <Icon
                    name={t.type === 'park' ? 'arrowDown' : 'arrowUp'}
                    size={14}
                    color={t.type === 'park' ? c.success : '#06B6D4'}
                  />
                </div>

                <div style={{flex: 1, minWidth: 0}}>
                  <div style={{fontSize: 13, fontWeight: 800, color: c.textPrimary}}>
                    {t.type === 'park' ? 'Parked' : 'Retrieved'} · {t.doctorName}
                  </div>
                  <div style={{fontSize: 11, fontWeight: 700, marginTop: 2, color: c.textSecondary, display: 'flex', alignItems: 'center', gap: 6}}>
                    <span style={{fontFamily: 'monospace'}}>{t.carNumber}</span>
                    {t.slotId && <span>· BAY {t.slotId}</span>}
                  </div>
                </div>

                <Icon name="check" size={16} color={c.success} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
