import React, {useEffect, useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useMyDriverId, isMyJob} from '../../hooks/useMyDriverId';
import {useAppState} from '../../context/AppStateContext';
import {useTheme} from '../../context/ThemeContext';
import {useDialog} from '../../components/AppDialog';
import {Icon} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';

const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return {text: 'Good morning', icon: 'sun' as const};
  if (h < 17) return {text: 'Good afternoon', icon: 'sun' as const};
  if (h < 21) return {text: 'Good evening', icon: 'sunset' as const};
  return {text: 'Good night', icon: 'moon' as const};
}

const WINDOW = 7;
const TODAY_INDEX = Math.floor(WINDOW / 2); // 3 of 0..6

function weekStrip() {
  const today = new Date();
  return Array.from({length: WINDOW}, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + (i - TODAY_INDEX));
    return {
      key: d.toDateString(),
      letter: DAY_LETTERS[d.getDay()],
      num: d.getDate(),
      isToday: i === TODAY_INDEX,
      isPast: i < TODAY_INDEX,
    };
  });
}

function isToday(ms?: number) {
  if (!ms) return false;
  const d = new Date(ms);
  const now = new Date();
  return d.toDateString() === now.toDateString();
}

function SkeletonBlock({height, width = '100%', radius = 10, style}: {height: number; width?: number | string; radius?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return <div className="pulse" style={{height, width, borderRadius: radius, backgroundColor: colors.cardAlt, ...style}} />;
}

export function DriverDashboardScreen({onOpenJobs}: {onOpenJobs?: () => void} = {}) {
  const {user, updateProfile} = useAuth();
  const {tasks, visitors, setDriverStatus, fetchTaskHistory, hydrated} = useAppState();
  const {colors: c, isDark} = useTheme();
  const dialog = useDialog();
  const g = greeting();
  const days = weekStrip();

  const myDriverId = useMyDriverId();
  const myStatus = user?.driverStatus;
  const [togglingShift, setTogglingShift] = useState(false);

  const onShift = myStatus === 'available';
  const handleToggleShift = async () => {
    if (!myDriverId || togglingShift) return;
    if (myStatus === 'busy') {
      dialog.alert("You're still out on a job — finish or hand it off before going off-duty.", {title: 'Still on a job'});
      return;
    }
    const next = onShift ? 'off' : 'available';
    setTogglingShift(true);
    try {
      await setDriverStatus(myDriverId, next);
      updateProfile({driverStatus: next});
    } catch (err: any) {
      dialog.alert(err.message || 'Could not change your shift status');
    } finally {
      setTogglingShift(false);
    }
  };

  const myTasks = tasks.filter(t => isMyJob(t.driverId, myDriverId));
  const activeTask = myTasks.find(t => t.status !== 'completed' && t.status !== 'delivered' && t.status !== 'cancelled') ?? null;
  const pendingVisitors = myTasks.filter(t =>
    Boolean(t.isVisitor || t.visitorId != null)
    && t.id !== activeTask?.id
    && t.status !== 'completed'
    && t.status !== 'cancelled'
    && t.status !== 'delivered'
  );
  const openCount = (activeTask ? 1 : 0) + pendingVisitors.length;

  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => {
    if (!myDriverId) return;
    fetchTaskHistory({driverId: myDriverId}).then(setHistory).catch(() => {});
  }, [myDriverId, fetchTaskHistory, tasks]);

  const completedToday = history.filter(t => t.status === 'completed' && isToday(t.completedAt));

  const stats = [
    {label: 'Completed Today', value: completedToday.length, icon: 'flag' as const},
    {label: 'Open Missions', value: openCount, icon: 'inbox' as const},
    {label: 'Total Completed', value: history.length, icon: 'history' as const},
  ];

  const glassCardStyle: React.CSSProperties = {
    backgroundColor: c.surface,
    border: `1px solid ${c.border}`,
    borderRadius: 18,
    boxShadow: isDark ? '0 4px 20px rgba(0, 0, 0, 0.25)' : '0 2px 10px rgba(0, 0, 0, 0.03)',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: c.background, padding: 16, paddingBottom: 40}}>
      {/* 1. Header Greeting & Identity */}
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            border: `1px solid ${c.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.surface,
            flexShrink: 0,
          }}>
            <Icon name={g.icon} size={17} color={c.primary} />
          </div>
          <div>
            <div style={{fontSize: 16, fontWeight: 900, color: c.textPrimary, letterSpacing: -0.3}}>
              {g.text}, {user?.name?.split(' ')[0] ?? 'Runner'}
            </div>
            <div style={{fontSize: 11, fontWeight: 700, color: c.textSecondary, marginTop: 1, letterSpacing: 0.3}}>
              VALET RUNNER DISPATCH
            </div>
          </div>
        </div>

        <div style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF',
          border: `1.5px solid ${c.primary}`,
          flexShrink: 0,
        }}>
          <span style={{fontSize: 14, fontWeight: 900, color: c.primary}}>
            {(user?.name ?? 'D').charAt(0).toUpperCase()}
          </span>
        </div>
      </div>

      {/* 2. Tactical Shift Toggle Banner */}
      <PressableScale
        onClick={handleToggleShift}
        disabled={togglingShift || myStatus === 'busy'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          textAlign: 'left',
          borderRadius: 18,
          padding: '13px 16px',
          marginBottom: 16,
          border: `1px solid ${myStatus === 'busy' ? (isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A') : onShift ? (isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0') : c.border}`,
          backgroundColor: myStatus === 'busy' ? (isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB') : onShift ? (isDark ? 'rgba(16, 185, 129, 0.08)' : '#ECFDF5') : c.surface,
          opacity: myStatus === 'busy' ? 0.85 : 1,
          cursor: myStatus === 'busy' ? 'default' : 'pointer',
        }}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: myStatus === 'busy' ? '#F59E0B' : onShift ? '#10B981' : c.cardAlt,
        }}>
          <Icon name={myStatus === 'busy' ? 'bolt' : 'key'} size={18} color={myStatus === 'busy' || onShift ? '#fff' : c.textSecondary} />
        </div>

        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: 14, fontWeight: 900, color: c.textPrimary}}>
              {myStatus === 'busy' ? 'On Mission' : onShift ? 'On Shift · Ready' : 'Off Shift · Standing By'}
            </span>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: 4,
              backgroundColor: myStatus === 'busy' ? '#F59E0B' : onShift ? '#10B981' : c.textMuted,
            }} />
          </div>
          <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 2, color: c.textSecondary}}>
            {myStatus === 'busy' ? 'Finish active task to go off-duty' : onShift ? 'Visible to station desks for runs' : "Tap to check in for new missions"}
          </div>
        </div>

        {/* Tactile Toggle Switch */}
        <div style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          flexShrink: 0,
          padding: 3,
          boxSizing: 'border-box',
          backgroundColor: onShift ? '#10B981' : c.border,
          transition: 'background-color 0.2s ease',
        }}>
          {togglingShift ? (
            <div style={{width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <span className="spinner" style={{width: 13, height: 13, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
            </div>
          ) : (
            <div style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              transform: onShift ? 'translateX(18px)' : 'translateX(0)',
              transition: 'transform 0.2s ease',
            }} />
          )}
        </div>
      </PressableScale>

      {/* 3. Rolling Centered Week Strip */}
      <div style={{display: 'flex', justifyContent: 'space-between', gap: 6, marginBottom: 16}}>
        {days.map(d => (
          <div
            key={d.key}
            style={{
              flex: 1,
              height: 52,
              borderRadius: 12,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              border: `1.5px solid ${d.isToday ? c.primary : c.border}`,
              backgroundColor: d.isToday ? (isDark ? 'rgba(59, 130, 246, 0.12)' : '#EFF6FF') : c.surface,
              opacity: d.isPast && !d.isToday ? 0.45 : 1,
            }}>
            <span style={{fontSize: 10, fontWeight: 800, color: d.isToday ? c.primary : c.textMuted, textTransform: 'uppercase'}}>
              {d.letter}
            </span>
            <span style={{
              fontSize: 14,
              fontWeight: d.isToday ? 900 : 700,
              color: d.isToday ? c.primary : c.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {d.num}
            </span>
          </div>
        ))}
      </div>

      {/* 4. Hero Mission Card */}
      <PressableScale
        onClick={() => onOpenJobs?.()}
        style={{
          width: '100%',
          textAlign: 'left',
          borderRadius: 20,
          padding: 18,
          marginBottom: 16,
          backgroundColor: c.surface,
          border: `1px solid ${activeTask ? (activeTask.type === 'park' ? '#10B981' : '#F59E0B') : c.border}`,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: isDark ? '0 8px 24px rgba(0, 0, 0, 0.3)' : '0 4px 14px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
        }}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
          <span style={{
            fontSize: 10,
            fontWeight: 900,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            padding: '3px 8px',
            borderRadius: 6,
            backgroundColor: activeTask ? (activeTask.type === 'park' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') : (isDark ? 'rgba(245, 158, 11, 0.15)' : '#FFFBEB')) : c.cardAlt,
            color: activeTask ? (activeTask.type === 'park' ? c.success : '#D97706') : c.textSecondary,
          }}>
            {activeTask ? (activeTask.type === 'park' ? 'PARK MISSION IN PROGRESS' : 'RETRIEVAL MISSION IN PROGRESS') : 'RUNNER STANDBY'}
          </span>
          {activeTask && (
            <span style={{width: 8, height: 8, borderRadius: 4, backgroundColor: activeTask.type === 'park' ? '#10B981' : '#F59E0B'}} />
          )}
        </div>

        {activeTask ? (
          <div>
            <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6}}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: 19,
                fontWeight: 900,
                color: c.textPrimary,
                letterSpacing: 0.5,
              }}>
                {activeTask.carNumber}
              </span>
              {activeTask.slotId && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 6,
                  backgroundColor: c.primary,
                  color: c.textOnPrimary,
                }}>
                  BAY {activeTask.slotId}
                </span>
              )}
            </div>
            <div style={{fontSize: 12.5, fontWeight: 700, color: c.textSecondary}}>
              Guest: {activeTask.doctorName}
            </div>
          </div>
        ) : (
          <div>
            <div style={{fontSize: 17, fontWeight: 800, color: c.textPrimary, marginBottom: 4}}>
              No active task assigned
            </div>
            <div style={{fontSize: 12, fontWeight: 600, color: c.textSecondary}}>
              Station desks will dispatch incoming arrivals and departures directly to your queue.
            </div>
          </div>
        )}

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 14,
          paddingTop: 12,
          borderTop: `1px solid ${c.border}`,
        }}>
          <span style={{fontSize: 12.5, fontWeight: 800, color: c.primary}}>
            {activeTask ? 'Open active task details' : 'View full mission queue'}
          </span>
          <Icon name="arrowRight" size={14} color={c.primary} />
        </div>
      </PressableScale>

      {/* 5. Tri-Metric Statistics Row */}
      <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
        {!hydrated ? [0, 1, 2].map(i => (
          <div key={i} style={{...glassCardStyle, flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 6}}>
            <SkeletonBlock height={16} width={16} radius={4} />
            <SkeletonBlock height={20} width="60%" radius={5} />
            <SkeletonBlock height={10} width="80%" radius={4} />
          </div>
        )) : stats.map(s => (
          <div key={s.label} style={{...glassCardStyle, flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 4}}>
            <Icon name={s.icon} size={16} color={c.primary} />
            <span style={{fontSize: 20, fontWeight: 900, color: c.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
              {s.value}
            </span>
            <span style={{fontSize: 10.5, fontWeight: 700, color: c.textSecondary}}>
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* 6. Pending Visitor Pickups Alert Banner */}
      {pendingVisitors.length > 0 && (
        <PressableScale
          onClick={() => onOpenJobs?.()}
          style={{
            width: '100%',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderRadius: 16,
            padding: 14,
            marginBottom: 16,
            border: `1px solid ${isDark ? 'rgba(245, 158, 11, 0.3)' : '#FDE68A'}`,
            backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : '#FFFBEB',
            cursor: 'pointer',
          }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            backgroundColor: '#F59E0B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="bellAlert" size={16} color="#fff" />
          </div>
          <span style={{flex: 1, fontSize: 13, fontWeight: 800, color: c.textPrimary}}>
            {pendingVisitors.length} visitor pickup{pendingVisitors.length > 1 ? 's' : ''} waiting in queue
          </span>
          <Icon name="chevronRight" size={16} color={c.textSecondary} />
        </PressableScale>
      )}

      {/* 7. Recent Shift Missions Feed */}
      <div style={{fontSize: 14, fontWeight: 900, marginBottom: 10, color: c.textPrimary}}>
        Recent Completed Missions
      </div>
      {completedToday.length === 0 ? (
        <div style={{...glassCardStyle, padding: 28, textAlign: 'center'}}>
          <Icon name="flag" size={24} color={c.textMuted} style={{marginBottom: 8}} />
          <div style={{fontSize: 13, fontWeight: 700, color: c.textSecondary}}>
            No completed runs yet today
          </div>
          <div style={{fontSize: 11.5, fontWeight: 600, color: c.textMuted, marginTop: 2}}>
            Finished tasks will populate here as you complete them
          </div>
        </div>
      ) : (
        completedToday.slice(0, 5).map(t => (
          <div
            key={t.id}
            style={{
              ...glassCardStyle,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              marginBottom: 8,
            }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.type === 'park' ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5') : (isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF'),
              flexShrink: 0,
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
        ))
      )}
    </div>
  );
}
