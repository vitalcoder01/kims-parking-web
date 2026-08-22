import React, {useEffect, useState} from 'react';
import {useAuth} from '../../context/AuthContext';
import {useMyDriverId, isMyJob} from '../../hooks/useMyDriverId';
import {useAppState} from '../../context/AppStateContext';
import {useTheme} from '../../context/ThemeContext';
import {useDialog} from '../../components/AppDialog';
import {Icon} from '../../components/Icon';
import {PressableScale} from '../../components/PressableScale';

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

function SkeletonBlock({height, width = '100%', radius = 10, style}: {height: number; width?: number | string; radius?: number; style?: React.CSSProperties}) {
  const {colors} = useTheme();
  return <div className="pulse" style={{height, width, borderRadius: radius, backgroundColor: colors.cardAlt, ...style}} />;
}

export function DriverDashboardScreen({onOpenJobs}: {onOpenJobs?: () => void} = {}) {
  const {user, updateProfile} = useAuth();
  const {tasks, visitors, setDriverStatus, fetchTaskHistory, hydrated} = useAppState();
  const {colors: c} = useTheme();
  const dialog = useDialog();
  const g = greeting();
  const days = weekStrip();

  const myDriverId = useMyDriverId();
  // NOT from the `drivers` array in AppStateContext — that's only ever
  // fetched for valet/admin sessions (see fetchAll's needsOpsData gate), so
  // for a driver it's permanently empty and `.find()` here always came back
  // undefined, silently no-opping every tap (the actual bug reported: the
  // toggle rendered fine but did nothing). user.driverStatus is sent by the
  // backend's serializeUser on login/refresh specifically so a driver's own
  // app can know their own status without fetching (and thereby exposing)
  // the whole roster's phone numbers just to find themselves in it.
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
  const pendingVisitors = visitors.filter(v => isMyJob(v.driverId, myDriverId)
    && (v.status === 'pending' || (v.status === 'parked' && v.retrievalRequested)));
  const openCount = (activeTask ? 1 : 0) + pendingVisitors.length;

  // "Completed"/"Total jobs" need real history, not the live `tasks` array —
  // that's deliberately bounded to "at most one row per doctor" now, so a
  // job retired the moment a doctor's next car comes in would otherwise
  // vanish from these stats even though it genuinely happened today.
  const [history, setHistory] = useState<typeof tasks>([]);
  useEffect(() => {
    if (!myDriverId) return;
    fetchTaskHistory({driverId: myDriverId}).then(setHistory).catch(() => {});
  }, [myDriverId, fetchTaskHistory, tasks.length]);

  const completedToday = history.filter(t => t.status === 'completed' && isToday(t.completedAt));

  const stats = [
    {label: 'Completed', value: completedToday.length, icon: 'flag' as const},
    {label: 'Open now', value: openCount, icon: 'inbox' as const},
    {label: 'Total jobs', value: history.length, icon: 'history' as const},
  ];

  return (
    <div className="screen-scroll" style={{backgroundColor: c.background, padding: 20, paddingTop: 12, paddingBottom: 40}}>

      {/* Header */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18}}>
        <div style={{width: 34, height: 34, borderRadius: 17, border: `1px solid ${c.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.surface, flexShrink: 0}}>
          <Icon name={g.icon} size={15} color={c.textPrimary} />
        </div>
        <div style={{flex: 1, fontSize: 22, fontWeight: 800, color: c.textPrimary}}>{g.text}</div>
        <div style={{width: 34, height: 34, borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.primary, flexShrink: 0}}>
          <span style={{fontSize: 14, fontWeight: 800, color: c.textOnPrimary}}>{(user?.name ?? 'D').charAt(0).toUpperCase()}</span>
        </div>
      </div>

      {/* Shift toggle — the driver's own on/off control, not something a
          valet/admin has to set for them. Busy (on a live job) shows as a
          locked, distinct state rather than a toggle that would just fail
          on tap — the backend already refuses this move mid-job. */}
      <PressableScale
        onClick={handleToggleShift}
        disabled={togglingShift || myStatus === 'busy'}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
          borderRadius: 18, padding: 14, marginBottom: 18,
          border: `1px solid ${onShift ? c.success + '40' : c.border}`,
          backgroundColor: onShift ? c.successLight : c.surface,
          opacity: myStatus === 'busy' ? 0.75 : 1,
        }}>
        <div style={{
          width: 40, height: 40, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          backgroundColor: myStatus === 'busy' ? c.warningLight : onShift ? c.success : c.cardAlt,
        }}>
          <Icon name={myStatus === 'busy' ? 'bolt' : 'key'} size={17} color={myStatus === 'busy' ? c.warning : onShift ? '#fff' : c.textMuted} />
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 14, fontWeight: 800, color: c.textPrimary}}>
            {myStatus === 'busy' ? 'On a job' : onShift ? 'On shift' : 'Off shift'}
          </div>
          <div style={{fontSize: 11.5, marginTop: 2, color: c.textSecondary}}>
            {myStatus === 'busy' ? 'Finish your current job to go off-duty' : onShift ? 'Visible to valets for new jobs' : "Tap to start — you won't be assigned jobs"}
          </div>
        </div>
        {/* Pill switch — purely a visual reflection of onShift, the whole
            card is the tap target. */}
        <div style={{
          width: 46, height: 27, borderRadius: 14, flexShrink: 0, padding: 3, boxSizing: 'border-box',
          backgroundColor: onShift ? c.success : c.border, transition: 'background-color 0.15s ease',
        }}>
          {togglingShift ? (
            <div style={{width: 21, height: 21, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <span className="spinner" style={{width: 14, height: 14, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
            </div>
          ) : (
            <div style={{
              width: 21, height: 21, borderRadius: 11, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
              transform: onShift ? 'translateX(19px)' : 'translateX(0)', transition: 'transform 0.15s ease',
            }} />
          )}
        </div>
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
              // Days already gone recede, so the eye lands on today and the
              // days still ahead of it.
              opacity: d.isPast && !d.isToday ? 0.45 : 1,
            }}>
            <span style={{fontSize: 11, fontWeight: 600, color: c.textMuted}}>{d.letter}</span>
            <span style={{fontSize: 15, fontWeight: d.isToday ? 900 : 700, color: d.isToday ? c.textPrimary : c.textSecondary}}>{d.num}</span>
          </div>
        ))}
      </div>

      {/* Hero card */}
      <PressableScale
        onClick={() => onOpenJobs?.()}
        style={{width: '100%', textAlign: 'left', borderRadius: 24, padding: 22, marginBottom: 16, minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', backgroundColor: c.primary}}
      >
        <div style={{fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: c.textOnPrimary + '99'}}>
          {activeTask ? (activeTask.type === 'park' ? 'Parking task' : 'Retrieval task') : 'Standing by'}
        </div>
        <div style={{fontSize: 20, fontWeight: 800, marginTop: 8, lineHeight: '26px', color: c.textOnPrimary}}>
          {activeTask
            ? `${activeTask.carNumber} · ${activeTask.doctorName}`
            : 'No active job right now'}
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, padding: '10px 16px', marginTop: 16, backgroundColor: c.textOnPrimary}}>
          <span style={{fontSize: 13, fontWeight: 800, color: c.primary}}>{activeTask ? 'Open job' : 'View jobs'}</span>
          <Icon name="arrowRight" size={15} color={c.primary} />
        </div>
      </PressableScale>

      {/* Stats row */}
      <div style={{display: 'flex', gap: 10, marginBottom: 16}}>
        {/* A zeroed tile during load reads as a real number — "you've done
            nothing today" — rather than as "not known yet". */}
        {!hydrated ? [0, 1, 2].map(i => (
          <div key={i} style={{flex: 1, borderRadius: 18, border: `1px solid ${c.border}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: c.surface}}>
            <SkeletonBlock height={18} width={18} radius={5} />
            <SkeletonBlock height={20} width="55%" radius={6} />
            <SkeletonBlock height={10} width="70%" radius={5} />
          </div>
        )) : stats.map(s => (
          <div key={s.label} style={{flex: 1, borderRadius: 18, border: `1px solid ${c.border}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 6, backgroundColor: c.surface}}>
            <Icon name={s.icon} size={18} color={c.textPrimary} />
            <span style={{fontSize: 22, fontWeight: 900, color: c.textPrimary}}>{s.value}</span>
            <span style={{fontSize: 11, fontWeight: 600, color: c.textSecondary}}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Pending visitor pickups shortcut */}
      {pendingVisitors.length > 0 && (
        <PressableScale
          onClick={() => onOpenJobs?.()}
          style={{width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 16, padding: 14, marginBottom: 16, border: `1px solid ${c.warning}40`, backgroundColor: c.warningLight}}
        >
          <Icon name="bellAlert" size={18} color={c.warning} />
          <span style={{flex: 1, fontSize: 13, fontWeight: 700, color: c.textPrimary}}>
            {pendingVisitors.length} visitor pickup{pendingVisitors.length > 1 ? 's' : ''} waiting
          </span>
          <Icon name="chevronRight" size={16} color={c.textSecondary} />
        </PressableScale>
      )}

      {/* Recent activity */}
      <div style={{fontSize: 15, fontWeight: 800, marginBottom: 10, color: c.textPrimary}}>Recent activity</div>
      {completedToday.length === 0 ? (
        <div style={{borderRadius: 18, border: `1px solid ${c.border}`, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, backgroundColor: c.surface}}>
          <Icon name="flag" size={22} color={c.textMuted} />
          <span style={{fontSize: 13, fontWeight: 600, color: c.textSecondary}}>Nothing completed yet today</span>
        </div>
      ) : (
        completedToday.slice(0, 5).map(t => (
          <div key={t.id} style={{display: 'flex', alignItems: 'center', gap: 12, borderRadius: 16, border: `1px solid ${c.border}`, padding: 12, marginBottom: 8, backgroundColor: c.surface}}>
            <div style={{width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: c.successLight, flexShrink: 0}}>
              <Icon name={t.type === 'park' ? 'arrowDown' : 'arrowUp'} size={15} color={c.success} />
            </div>
            <div style={{flex: 1, minWidth: 0}}>
              <div style={{fontSize: 13, fontWeight: 700, color: c.textPrimary}}>{t.type === 'park' ? 'Parked' : 'Retrieved'} · {t.doctorName}</div>
              <div style={{fontSize: 11, fontWeight: 600, marginTop: 2, color: c.textSecondary}}>{t.carNumber}{t.slotId ? ` · ${t.slotId}` : ''}</div>
            </div>
            <Icon name="check" size={16} color={c.success} />
          </div>
        ))
      )}
    </div>
  );
}
