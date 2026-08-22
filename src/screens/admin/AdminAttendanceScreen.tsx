import React, {useState, useEffect, useCallback} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useTheme} from '../../context/ThemeContext';
import {adminApi} from '../../services/api';
import {Badge} from '../../components/Badge';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';

// Direct port of the mobile app's AdminAttendanceScreen.
interface TodayRow {
  id: number; userId: number; name: string; role: string; employeeId: string;
  checkIn: string | null; checkOut: string | null; vehiclesHandled: number; gate?: string | null;
}
interface MonthlyUser {
  userId: number; name: string; role: string; employeeId: string;
  days: {date: string; checkIn: string | null; checkOut: string | null; vehiclesHandled: number}[];
}

const roleLabel: Record<string, string> = {doctor: 'Doctor', staff: 'Staff', valet: 'Valet', driver: 'Driver', admin: 'Admin'};
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CATEGORIES: {key: string; label: string; icon: IconName}[] = [
  {key: 'all', label: 'All', icon: 'people'},
  {key: 'doctor', label: 'Doctors', icon: 'stethoscope'},
  {key: 'staff', label: 'Staff', icon: 'briefcase'},
  {key: 'valet', label: 'Valets', icon: 'key'},
  {key: 'driver', label: 'Drivers', icon: 'car'},
  {key: 'admin', label: 'Admins', icon: 'shield'},
];

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit'});
}
function monthLabel(monthStr: string) {
  const [y, m] = monthStr.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
}
function shiftMonth(monthStr: string, delta: number) {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function currentMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function UserCalendar({user, monthStr, colors}: {user: MonthlyUser; monthStr: string; colors: any}) {
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const presentDates = new Map(user.days.filter(d => d.checkIn).map(d => [d.date, d]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const presentCount = presentDates.size;
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];

  return (
    <div style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, padding: spacing.md, marginBottom: spacing.md, backgroundColor: colors.card}}>
      <div style={{display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md}}>
        <div style={{width: 36, height: 36, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}>
          <span style={{fontSize: 12, fontWeight: 800, color: colors.textPrimary}}>{user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>{user.name}</div>
          <div style={{fontSize: 11, marginTop: 2, color: colors.textMuted}}>{roleLabel[user.role] ?? user.role} · {user.employeeId}</div>
        </div>
        <div style={{borderRadius: radius.lg, padding: '5px 10px', textAlign: 'center', backgroundColor: colors.successLight}}>
          <div style={{fontSize: 15, fontWeight: 900, color: colors.success}}>{presentCount}</div>
          <div style={{fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: colors.textMuted}}>days</div>
        </div>
      </div>
      <div style={{display: 'flex', marginBottom: 4}}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} style={{flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, color: colors.textMuted}}>{w}</span>
        ))}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap'}}>
        {cells.map((day, i) => {
          if (day == null) return <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1', padding: '2px 0'}} />;
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const rec = presentDates.get(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const bg = rec ? colors.success : isFuture ? 'transparent' : colors.cardAlt;
          const tc = rec ? '#fff' : isFuture ? colors.textMuted : colors.textSecondary;
          return (
            <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0'}}>
              <div style={{
                width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: bg, border: isToday ? `1.5px solid ${colors.primary}` : 'none',
              }}>
                <span style={{fontSize: 10, fontWeight: 700, color: tc}}>{day}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminAttendanceScreen() {
  const {colors} = useTheme();
  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [monthUsers, setMonthUsers] = useState<MonthlyUser[]>([]);
  const [monthStr, setMonthStr] = useState(currentMonthStr());
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (month: string) => {
    try {
      const [today, allUsers, monthly] = await Promise.all([
        adminApi.attendanceToday(), adminApi.listUsers(), adminApi.attendanceMonthly(month),
      ]);
      setTodayRows(today);
      const byUserId = new Map(monthly.users.map(u => [u.userId, u]));
      setMonthUsers(allUsers.map((u: any) => byUserId.get(u.id) ?? {
        userId: u.id, name: u.name, role: u.role, employeeId: u.employeeId, days: [],
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setLoading(true); load(monthStr); }, [monthStr, load]);

  const present = todayRows.filter(r => r.checkIn && !r.checkOut).length;
  const isCurrentMonth = monthStr === currentMonthStr();
  const categoryCounts: Record<string, number> = {all: monthUsers.length};
  for (const u of monthUsers) categoryCounts[u.role] = (categoryCounts[u.role] ?? 0) + 1;
  const filteredUsers = category === 'all' ? monthUsers : monthUsers.filter(u => u.role === category);
  const visibleCategories = CATEGORIES.filter(c => c.key === 'all' || categoryCounts[c.key] > 0);

  const sec: React.CSSProperties = {fontSize: typography.sizes.base, fontWeight: typography.weights.black, letterSpacing: -0.2, marginBottom: spacing.sm, color: colors.textPrimary};

  if (loading) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, minHeight: '60vh', backgroundColor: colors.background}}>
        <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary}} />
        <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Loading attendance…</span>
      </div>
    );
  }

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, padding: 16, paddingBottom: 40}}>
      <div style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, textAlign: 'center', padding: '24px 0', marginBottom: spacing.base, backgroundColor: colors.card}}>
        <div style={{width: 44, height: 44, borderRadius: radius.full, margin: '0 auto', marginBottom: spacing.sm, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.successLight}}>
          <Icon name="checkBold" size={20} color={colors.success} />
        </div>
        <div style={{fontSize: typography.sizes['4xl'], fontWeight: typography.weights.black, color: colors.textPrimary, lineHeight: 1.1}}>{present}</div>
        <div style={{fontSize: 11, fontWeight: 700, marginTop: 4, color: colors.textMuted}}>Present right now</div>
      </div>

      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: spacing.base}}>
        <PressableScale style={{width: 36, height: 36, borderRadius: radius.full, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card}} onClick={() => setMonthStr(m => shiftMonth(m, -1))}>
          <span style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>‹</span>
        </PressableScale>
        <span style={{fontSize: 15, fontWeight: 800, minWidth: 140, textAlign: 'center', color: colors.textPrimary}}>{monthLabel(monthStr)}</span>
        <PressableScale
          style={{width: 36, height: 36, borderRadius: radius.full, border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, opacity: isCurrentMonth ? 0.35 : 1}}
          onClick={() => !isCurrentMonth && setMonthStr(m => shiftMonth(m, 1))} disabled={isCurrentMonth}>
          <span style={{fontSize: 18, fontWeight: 900, color: colors.textPrimary}}>›</span>
        </PressableScale>
      </div>

      <div style={sec}>Category</div>
      <div style={{display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 2}}>
        {visibleCategories.map(c => {
          const on = category === c.key;
          return (
            <PressableScale key={c.key} onClick={() => setCategory(c.key)}
              style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, borderRadius: radius.full, border: `1px solid ${on ? colors.primary : colors.border}`, padding: '9px 14px', backgroundColor: on ? colors.primary : colors.card}}>
              <Icon name={c.icon} size={14} color={on ? colors.textOnPrimary : colors.textPrimary} />
              <span style={{fontSize: 12, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textPrimary}}>{c.label}</span>
              <span style={{borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center', backgroundColor: on ? colors.textOnPrimary + '40' : colors.cardAlt}}>
                <span style={{fontSize: 10, fontWeight: 800, color: on ? colors.textOnPrimary : colors.textMuted}}>{categoryCounts[c.key] ?? 0}</span>
              </span>
            </PressableScale>
          );
        })}
      </div>

      <div style={{...sec, marginTop: 4}}>Per-user calendar</div>
      {filteredUsers.length === 0 ? (
        <div style={{borderRadius: radius['2xl'], border: `1px dashed ${colors.border}`, padding: 28, textAlign: 'center', marginBottom: spacing.sm}}>
          <Icon name="calendar" size={22} color={colors.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: spacing.sm, color: colors.textMuted}}>No one in this category yet</div>
        </div>
      ) : filteredUsers.map(u => <UserCalendar key={u.userId} user={u} monthStr={monthStr} colors={colors} />)}

      <div style={{...sec, marginTop: spacing.sm}}>Today — marked automatically</div>
      {todayRows.length === 0 ? (
        <div style={{borderRadius: radius['2xl'], border: `1px dashed ${colors.border}`, padding: 28, textAlign: 'center'}}>
          <Icon name="clock" size={22} color={colors.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: spacing.sm, color: colors.textMuted}}>Nobody has been marked present yet today</div>
        </div>
      ) : (
        <div style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.card}}>
          {todayRows.map((r, i) => (
            <div key={r.id} style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '13px 14px', borderBottom: i === todayRows.length - 1 ? 'none' : `1px solid ${colors.divider}`}}>
              <div style={{width: 36, height: 36, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: r.checkOut ? colors.cardAlt : colors.successLight}}>
                <span style={{fontSize: 12, fontWeight: 800, color: r.checkOut ? colors.textSecondary : colors.success}}>{r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>{r.name}</div>
                <div style={{fontSize: 11, marginTop: 2, color: colors.textMuted}}>{roleLabel[r.role] ?? r.role} · {r.employeeId} · In {formatTime(r.checkIn)}</div>
              </div>
              {r.vehiclesHandled > 0 && <span style={{fontSize: 11, fontWeight: 700, color: colors.primary}}>{r.vehiclesHandled} vehicles</span>}
              <Badge label={r.checkOut ? 'Done' : 'Present'} variant={r.checkOut ? 'muted' : 'success'} dot={!r.checkOut} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
