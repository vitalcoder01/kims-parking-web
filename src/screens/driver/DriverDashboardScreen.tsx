import React, {useEffect, useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useMyDriverId, isMyJob} from '../../hooks/useMyDriverId';
import {useAppState} from '../../context/AppStateContext';
import {useTheme} from '../../context/ThemeContext';
import {useDialog} from '../../components/AppDialog';
import {Icon} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';
import {shadow} from '../../theme';
import {Surface, Text, StatTile, EmptyState, Avatar, SectionHeader, Skeleton} from '../../components/ui';

// Direct port of the mobile app's driver DriverDashboardScreen — status
// greeting, rolling week strip, hero "current job" card, stat tiles and
// today's completed-jobs feed. Same business logic, DOM/CSS in place of
// RN's View/Text/StyleSheet.

const DAY_LETTERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return {text: 'good morning.', icon: 'sun' as const};
  if (h < 17) return {text: 'good afternoon.', icon: 'sun' as const};
  if (h < 21) return {text: 'good evening.', icon: 'sunset' as const};
  return {text: 'good night.', icon: 'moon' as const};
}

// A rolling seven-day window CENTRED on today, not the Sunday-to-Saturday
// calendar week. Anchoring to the calendar meant the highlight drifted across
// the row as the week went on — parked at the far right by Friday and at the
// far left on Sunday — so the one cell the driver looks at was never in the
// same place twice. Now today holds the middle and the dates move around it.
const WINDOW = 7;
const TODAY_INDEX = Math.floor(WINDOW / 2);   // 3 of 0..6

function weekStrip() {
  const today = new Date();
  return Array.from({length: WINDOW}, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + (i - TODAY_INDEX));
    return {
      // toDateString, not letter+num: a window spanning a month boundary can
      // repeat a day number, and React needs these keys to be unique.
      key: d.toDateString(),
      // Indexed by the real weekday. The old code used the loop index, which
      // only lined up because the row happened to start on a Sunday.
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

export function DriverDashboardScreen({onOpenJobs}: {onOpenJobs?: () => void} = {}) {
  const {user, updateProfile} = useAuth();
  const {tasks, visitors, setDriverStatus, fetchTaskHistory, hydrated} = useAppState();
  const {colors: c, isDark} = useTheme();
  const dialog = useDialog();
  const g = greeting();
  const days = weekStrip();

  const myDriverId = useMyDriverId();
  // NOT from AppStateContext's `drivers` array — that's only ever fetched
  // for valet/admin sessions, so it's permanently empty for a driver.
  // user.driverStatus is sent by the backend's serializeUser specifically so
  // a driver's own app can know their status without fetching (and thereby
  // exposing) the whole roster's phone numbers.
  const myStatus = user?.driverStatus;
  const [togglingShift, setTogglingShift] = useState(false);

  // On/off is the only thing a toggle here should control — 'busy' is set
  // automatically by taking a job, never chosen. The backend already
  // refuses to take a driver off-duty while they're on a live job (see
  // driver.service.js setStatus's ACTIVE_TASK_STATUSES guard), so a driver
  // physically mid-job can't shift off mid-drive.
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
      // AppStateContext's setDriverStatus only patches the (unpopulated,
      // for a driver) `drivers` array — this is what actually keeps
      // user.driverStatus, the thing this screen reads, current.
      updateProfile({driverStatus: next});
    } catch (err: any) {
      dialog.alert(err.message || 'Could not change your shift status');
    } finally {
      setTogglingShift(false);
    }
  };

  const myTasks = tasks.filter(t => isMyJob(t.driverId, myDriverId));
  // 'delivered' is already off this driver's plate — awaiting valet
  // confirmation only, not something to keep showing as their active job.
  const activeTask = myTasks.find(t => t.status !== 'completed' && t.status !== 'delivered' && t.status !== 'cancelled') ?? null;
  // Visitor pickups genuinely still waiting on THIS driver. Requires an
  // actual live retrieve-type task assigned to them (not the visitor row's
  // own driverId, which is reused from the park leg and stays stale after
  // it completes — see visitor.service.js's assignRetrievalDriver), and
  // excludes whichever visitor `activeTask` already represents so the same
  // job never shows/counts twice.
  const pendingVisitors = visitors.filter(v => v.status === 'parked' && v.retrievalRequested
    && v.id !== activeTask?.visitorId
    && tasks.some(t => t.visitorId === v.id && t.type === 'retrieve'
      && isMyJob(t.driverId, myDriverId) && t.status !== 'completed' && t.status !== 'cancelled'));
  const openCount = (activeTask ? 1 : 0) + pendingVisitors.length;

  // "Completed"/"Total jobs" need real history, not the live `tasks` array —
  // that's bounded to "at most one row per doctor", so a completed job
  // vanishes from it the moment that doctor's next car comes in.
  //
  // Depends on `tasks` itself, not `tasks.length` — completing a job
  // replaces a row in place, so the array's length never changes even
  // though the effect needs to refire.
  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => {
    if (!myDriverId) return;
    fetchTaskHistory({driverId: myDriverId}).then(setHistory).catch(() => {});
  }, [myDriverId, fetchTaskHistory, tasks]);

  const completedToday = history.filter(t => t.status === 'completed' && isToday(t.completedAt));

  const stats = [
    {label: 'Completed', value: completedToday.length, icon: 'flag' as const},
    {label: 'Open now', value: openCount, icon: 'inbox' as const},
    {label: 'Total jobs', value: history.length, icon: 'history' as const},
  ];

  return (
    <div className="screen-scroll" style={{backgroundColor: c.background, padding: 20, paddingTop: 14, paddingBottom: 40}}>

      {/* Header */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18}}>
        <span style={{width: 34, height: 34, borderRadius: 17, border: `1px solid ${c.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, flexShrink: 0}}>
          <Icon name={g.icon} size={15} color={c.textPrimary} />
        </span>
        <Text variant="title" style={{flex: 1}}>{g.text}</Text>
        <Avatar name={user?.name ?? 'D'} size={34} />
      </div>

      {/* Shift toggle — the driver's own on/off control. Busy (on a live job)
          shows as a locked, distinct state rather than a toggle that would
          just fail on tap. */}
      <PressableScale
        onClick={handleToggleShift}
        disabled={togglingShift || myStatus === 'busy'}
        className="ui-surface"
        style={{
          ['--ui-shadow' as any]: shadow(isDark, 'e1'),
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          borderRadius: 18, padding: 14, marginBottom: 18,
          border: `1px solid ${onShift ? c.success + '40' : c.border}`,
          backgroundColor: onShift ? c.successLight : c.surface,
          opacity: myStatus === 'busy' ? 0.75 : 1,
        }}>
        <span style={{
          width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: myStatus === 'busy' ? c.warningLight : onShift ? c.success : c.cardAlt,
        }}>
          <Icon name={myStatus === 'busy' ? 'bolt' : 'key'} size={17} color={myStatus === 'busy' ? c.warning : onShift ? '#fff' : c.textMuted} />
        </span>
        <div style={{flex: 1, minWidth: 0}}>
          <Text variant="subhead" as="div">
            {myStatus === 'busy' ? 'On a job' : onShift ? 'On shift' : 'Off shift'}
          </Text>
          <Text variant="caption" tone="secondary" as="div" style={{marginTop: 2}}>
            {myStatus === 'busy' ? 'Finish your current job to go off-duty' : onShift ? 'Visible to valets for new jobs' : "Tap to start — you won't be assigned jobs"}
          </Text>
        </div>
        {/* Pill switch — purely a visual reflection of onShift, the whole
            card is the tap target. */}
        <span style={{
          width: 46, height: 27, borderRadius: 14, flexShrink: 0, padding: 3, boxSizing: 'border-box', display: 'inline-block',
          backgroundColor: onShift ? c.success : c.borderStrong, transition: 'background-color 0.15s ease',
        }}>
          {togglingShift ? (
            <span style={{width: 21, height: 21, display: 'inline-flex', alignItems: 'center', justifyContent: 'center'}}>
              <span className="spinner" style={{width: 14, height: 14, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
            </span>
          ) : (
            <span style={{
              width: 21, height: 21, borderRadius: 11, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'inline-block',
              transform: onShift ? 'translateX(19px)' : 'translateX(0)', transition: 'transform 0.15s ease',
            }} />
          )}
        </span>
      </PressableScale>

      {/* Week strip */}
      <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: 20}}>
        {days.map(d => (
          <div
            key={d.key}
            style={{
              width: 38, height: 52, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              border: `1px solid ${d.isToday ? c.border : 'transparent'}`,
              backgroundColor: d.isToday ? c.surface : 'transparent',
              boxShadow: d.isToday ? shadow(isDark, 'e1') : undefined,
              // Days already gone recede, so the eye lands on today and the
              // days still ahead of it.
              opacity: d.isPast && !d.isToday ? 0.45 : 1,
            }}>
            <Text variant="caption" tone="muted" style={{fontWeight: 600}}>{d.letter}</Text>
            <Text variant="subhead" color={d.isToday ? c.textPrimary : c.textSecondary} style={{fontWeight: d.isToday ? 900 : 700}}>{d.num}</Text>
          </div>
        ))}
      </div>

      {/* Hero card */}
      <PressableScale
        onClick={() => onOpenJobs?.()}
        className="ui-surface ui-surface--interactive"
        style={{
          ['--ui-shadow' as any]: shadow(isDark, 'e2'),
          ['--ui-shadow-hover' as any]: shadow(isDark, 'e3'),
          ['--ui-ring' as any]: isDark ? 'rgba(243,243,241,0.45)' : 'rgba(21,22,26,0.5)',
          width: '100%', textAlign: 'left', borderRadius: 24, padding: 22, marginBottom: 16, minHeight: 150,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: c.primary,
          border: '1px solid transparent',
        }}
      >
        <Text variant="overline" uppercase color={c.textOnPrimary + '99'}>
          {activeTask ? (activeTask.type === 'park' ? 'Parking task' : 'Retrieval task') : 'Standing by'}
        </Text>
        <Text variant="title" color={c.textOnPrimary} style={{fontSize: 20, marginTop: 8}}>
          {activeTask
            ? `${activeTask.carNumber} · ${activeTask.doctorName}`
            : 'No active job right now'}
        </Text>
        <span style={{display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, padding: '10px 16px', marginTop: 16, backgroundColor: c.textOnPrimary}}>
          <Text variant="label" color={c.primary}>{activeTask ? 'Open job' : 'View jobs'}</Text>
          <Icon name="arrowRight" size={15} color={c.primary} />
        </span>
      </PressableScale>

      {/* Stats row */}
      <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
        {!hydrated ? [0, 1, 2].map(i => (
          <Surface key={i} elevation="e1" radius={18} padding={14} style={{flex: 1, display: 'flex', flexDirection: 'column', gap: 8}}>
            <Skeleton width={18} height={18} radius={5} />
            <Skeleton width="55%" height={20} radius={6} />
            <Skeleton width="70%" height={10} radius={5} />
          </Surface>
        )) : stats.map(s => (
          <StatTile key={s.label} label={s.label} value={s.value} icon={s.icon} style={{flex: 1}} />
        ))}
      </div>

      {/* Pending visitor pickups shortcut */}
      {pendingVisitors.length > 0 && (
        <PressableScale
          onClick={() => onOpenJobs?.()}
          style={{width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, marginBottom: 16, border: `1px solid ${c.warning}40`, backgroundColor: c.warningLight}}
        >
          <Icon name="bellAlert" size={18} color={c.warning} />
          <Text variant="label" style={{flex: 1}}>
            {pendingVisitors.length} visitor pickup{pendingVisitors.length > 1 ? 's' : ''} waiting
          </Text>
          <Icon name="chevronRight" size={16} color={c.textSecondary} />
        </PressableScale>
      )}

      {/* Recent activity */}
      <SectionHeader title="Recent activity" style={{marginTop: 4}} />
      {completedToday.length === 0 ? (
        <Surface elevation="e1" radius={18} padding={0}>
          <EmptyState compact icon="flag" title="Nothing completed yet today" subtitle="Finished jobs will show up here as you close them out." />
        </Surface>
      ) : (
        completedToday.slice(0, 5).map(t => (
          <Surface key={t.id} elevation="e1" radius={16} padding={12} style={{marginBottom: 8}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
              <span style={{width: 32, height: 32, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.successLight, flexShrink: 0}}>
                <Icon name={t.type === 'park' ? 'arrowDown' : 'arrowUp'} size={15} color={c.success} />
              </span>
              <div style={{flex: 1, minWidth: 0}}>
                <Text variant="subhead" as="div" numberOfLines={1}>{t.type === 'park' ? 'Parked' : 'Retrieved'} · {t.doctorName}</Text>
                <Text variant="caption" tone="secondary" as="div" style={{marginTop: 2}}>{t.carNumber}{t.slotId ? ` · ${t.slotId}` : ''}</Text>
              </div>
              <Icon name="check" size={16} color={c.success} />
            </div>
          </Surface>
        ))
      )}
    </div>
  );
}
