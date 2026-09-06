import React, {useState, useEffect, useCallback} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {adminApi} from '../../services/api';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';
import {dark, darkCard, darkSectionLabel, DarkPill} from './adminDarkTheme';

// Direct port of the mobile app's AdminAttendanceScreen, restyled onto the
// shared dark ops-console tokens (see ./adminDarkTheme) — same logic and
// data, only the surface changed.
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

function UserCalendar({user, monthStr}: {user: MonthlyUser; monthStr: string}) {
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const presentDates = new Map(user.days.filter(d => d.checkIn).map(d => [d.date, d]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const presentCount = presentDates.size;
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];

  return (
    <div style={{...darkCard, padding: spacing.md, marginBottom: spacing.md}}>
      <div style={{display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md}}>
        <div style={{width: 36, height: 36, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: dark.cardAlt}}>
          <span style={{fontSize: 12, fontWeight: 800, color: dark.textPrimary}}>{user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 14, fontWeight: 800, color: dark.textPrimary}}>{user.name}</div>
          <div style={{fontSize: 11, marginTop: 2, color: dark.textMuted}}>{roleLabel[user.role] ?? user.role} · {user.employeeId}</div>
        </div>
        <div style={{borderRadius: radius.lg, padding: '5px 10px', textAlign: 'center', backgroundColor: dark.success + '22'}}>
          <div style={{fontSize: 15, fontWeight: 900, color: dark.success}}>{presentCount}</div>
          <div style={{fontSize: 8, fontWeight: 700, textTransform: 'uppercase', color: dark.textMuted}}>days</div>
        </div>
      </div>
      <div style={{display: 'flex', marginBottom: 4}}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} style={{flex: 1, textAlign: 'center', fontSize: 10, fontWeight: 700, color: dark.textMuted}}>{w}</span>
        ))}
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap'}}>
        {cells.map((day, i) => {
          if (day == null) return <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1', padding: '2px 0'}} />;
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const rec = presentDates.get(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const bg = rec ? dark.success : isFuture ? 'transparent' : dark.cardAlt;
          const tc = rec ? '#0E0E0E' : isFuture ? dark.textMuted : dark.textSecondary;
          return (
            <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0'}}>
              <div style={{
                width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                backgroundColor: bg, border: isToday ? `1.5px solid ${dark.accent}` : 'none',
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

// A compact roster row, not a full stacked calendar per person — with
// dozens of staff, rendering everyone's full month grid one after another
// (the old behavior) turned this screen into an enormous scroll nobody
// could scan. Mobbin research (Remote Global HR's absences list, Fable's
// streak log) confirmed the standard pattern at this scale: a flat,
// scannable roster with each person's summary, drilling into their own
// calendar only on tap — see the modal below, reusing UserCalendar as-is.
function RosterRow({user, monthStr, onClick, isLast}: {user: MonthlyUser; monthStr: string; onClick: () => void; isLast: boolean}) {
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const presentDates = new Set(user.days.filter(d => d.checkIn).map(d => d.date));
  const presentCount = presentDates.size;
  const pct = daysInMonth ? Math.round((presentCount / daysInMonth) * 100) : 0;

  // Last 7 calendar days up to today (or the month's end if viewing a past
  // month) — the same dot-per-day idiom Journal/Weverse use for a full
  // month, condensed to a week strip so it fits inline on a roster row.
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthEndStr = `${monthStr}-${String(daysInMonth).padStart(2, '0')}`;
  const anchor = monthEndStr < todayStr ? new Date(y, m - 1, daysInMonth) : new Date();
  const recentDays = Array.from({length: 7}, (_, i) => {
    const d = new Date(anchor);
    d.setDate(d.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {key, present: presentDates.has(key), inMonth: key.startsWith(monthStr)};
  });

  return (
    <PressableScale onClick={onClick} style={{width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: isLast ? 'none' : `1px solid ${dark.divider}`, textAlign: 'left'}}>
      <div style={{width: 40, height: 40, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: dark.accent + '22'}}>
        <span style={{fontSize: 12, fontWeight: 900, color: dark.accent}}>{user.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 13, fontWeight: 700, color: dark.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{user.name}</div>
        <div style={{fontSize: 11, marginTop: 2, color: dark.textMuted}}>{roleLabel[user.role] ?? user.role} · {user.employeeId}</div>
        <div style={{display: 'flex', gap: 4, marginTop: 6}}>
          {recentDays.map(d => (
            <span key={d.key} style={{
              width: 7, height: 7, borderRadius: 3.5,
              backgroundColor: d.present ? dark.success : 'transparent',
              border: d.present ? 'none' : `1.5px solid ${dark.border}`,
              opacity: d.present || d.inMonth ? 1 : 0.4,
            }} />
          ))}
        </div>
      </div>
      <div style={{textAlign: 'right', flexShrink: 0}}>
        <div style={{fontSize: 15, fontWeight: 900, color: pct >= 80 ? dark.success : pct >= 50 ? dark.warning : dark.textMuted}}>{pct}%</div>
        <div style={{fontSize: 10, fontWeight: 600, marginTop: 1, color: dark.textMuted}}>{presentCount}/{daysInMonth} days</div>
      </div>
      <Icon name="chevronRight" size={16} color={dark.textMuted} />
    </PressableScale>
  );
}

export function AdminAttendanceScreen() {
  const [todayRows, setTodayRows] = useState<TodayRow[]>([]);
  const [monthUsers, setMonthUsers] = useState<MonthlyUser[]>([]);
  const [monthStr, setMonthStr] = useState(currentMonthStr());
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<MonthlyUser | null>(null);

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
  const checkedInToday = todayRows.length;
  const totalStaff = monthUsers.length;
  const attendanceRate = totalStaff ? Math.round((checkedInToday / totalStaff) * 100) : 0;
  const isCurrentMonth = monthStr === currentMonthStr();
  const categoryCounts: Record<string, number> = {all: monthUsers.length};
  for (const u of monthUsers) categoryCounts[u.role] = (categoryCounts[u.role] ?? 0) + 1;
  const attQ = query.trim().toLowerCase();
  const filteredUsers = (category === 'all' ? monthUsers : monthUsers.filter(u => u.role === category))
    .filter(u => !attQ || u.name.toLowerCase().includes(attQ) || u.employeeId.toLowerCase().includes(attQ));
  const visibleCategories = CATEGORIES.filter(c => c.key === 'all' || categoryCounts[c.key] > 0);

  const sec: React.CSSProperties = {...darkSectionLabel, fontSize: typography.sizes.base, fontWeight: typography.weights.black, letterSpacing: -0.2, textTransform: 'none', marginBottom: spacing.sm, color: dark.textPrimary};

  if (loading) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, minHeight: '60vh', backgroundColor: dark.bg}}>
        <span className="spinner" style={{borderColor: dark.border, borderTopColor: dark.accent}} />
        <span style={{fontSize: 12, fontWeight: 600, color: dark.textMuted}}>Loading attendance…</span>
      </div>
    );
  }

  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: 16, paddingBottom: 40}}>
      {/* Two paired stats, not one number alone — Mobbin reference: Open's
          streak hero (two big numbers side by side, small caption below
          each), Duolingo's bold streak treatment. Both are real, derived
          data: present is today's still-clocked-in count, the rate is
          checked-in-today over the whole roster. */}
      <div style={{...darkCard, marginBottom: spacing.base, overflow: 'hidden'}}>
        <div style={{display: 'flex', alignItems: 'center', padding: '22px 0'}}>
          <div style={{flex: 1, textAlign: 'center'}}>
            <div style={{fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 1, color: dark.success}}>{present}</div>
            <div style={{fontSize: 11, fontWeight: 700, marginTop: 6, color: dark.textMuted}}>Present<br />right now</div>
          </div>
          <div style={{width: 1, alignSelf: 'stretch', margin: '8px 0', backgroundColor: dark.divider}} />
          <div style={{flex: 1, textAlign: 'center'}}>
            <div style={{fontSize: 40, fontWeight: 900, letterSpacing: -1, lineHeight: 1, color: dark.textPrimary}}>{attendanceRate}%</div>
            <div style={{fontSize: 11, fontWeight: 700, marginTop: 6, color: dark.textMuted}}>Checked in<br />today</div>
          </div>
        </div>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px 0', borderTop: `1px solid ${dark.divider}`}}>
          <Icon name="people" size={13} color={dark.textMuted} />
          <span style={{fontSize: 12, fontWeight: 600, color: dark.textSecondary}}>{checkedInToday} of {totalStaff} staff checked in today</span>
        </div>
      </div>

      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: spacing.base}}>
        <PressableScale style={{width: 36, height: 36, borderRadius: radius.full, border: `1px solid ${dark.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: dark.card}} onClick={() => setMonthStr(m => shiftMonth(m, -1))}>
          <span style={{fontSize: 18, fontWeight: 900, color: dark.textPrimary}}>‹</span>
        </PressableScale>
        <span style={{fontSize: 15, fontWeight: 800, minWidth: 140, textAlign: 'center', color: dark.textPrimary}}>{monthLabel(monthStr)}</span>
        <PressableScale
          style={{width: 36, height: 36, borderRadius: radius.full, border: `1px solid ${dark.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: dark.card, opacity: isCurrentMonth ? 0.35 : 1}}
          onClick={() => !isCurrentMonth && setMonthStr(m => shiftMonth(m, 1))} disabled={isCurrentMonth}>
          <span style={{fontSize: 18, fontWeight: 900, color: dark.textPrimary}}>›</span>
        </PressableScale>
      </div>

      {/* Search — same box the Jobs/Records screen uses. Real gap this
          closes: with only role filter chips, finding one person in a
          roster of dozens meant scrolling and reading every row. */}
      <div style={{display: 'flex', alignItems: 'center', gap: 10, borderRadius: radius.lg, border: `1px solid ${dark.border}`, padding: '0 15px', height: 48, marginBottom: 14, backgroundColor: dark.card}}>
        <Icon name="search" size={17} color={dark.textMuted} />
        <input
          style={{flex: 1, fontSize: 15, fontWeight: 500, padding: 0, border: 'none', outline: 'none', background: 'transparent', color: dark.textPrimary}}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search name, employee ID"
        />
        {!!query && (
          <PressableScale onClick={() => setQuery('')} style={{background: 'transparent', border: 'none', padding: 0}}>
            <Icon name="close" size={15} color={dark.textMuted} />
          </PressableScale>
        )}
      </div>

      <div style={sec}>Category</div>
      <div style={{display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 14, paddingBottom: 2}}>
        {visibleCategories.map(c => {
          const on = category === c.key;
          return (
            <PressableScale key={c.key} onClick={() => setCategory(c.key)}
              style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, borderRadius: radius.full, border: `1px solid ${on ? dark.accent : dark.border}`, padding: '9px 14px', backgroundColor: on ? dark.accent : dark.card}}>
              <Icon name={c.icon} size={14} color={on ? '#fff' : dark.textPrimary} />
              <span style={{fontSize: 12, fontWeight: 800, color: on ? '#fff' : dark.textPrimary}}>{c.label}</span>
              <span style={{borderRadius: 10, padding: '1px 6px', minWidth: 18, textAlign: 'center', backgroundColor: on ? '#ffffff40' : dark.cardAlt}}>
                <span style={{fontSize: 10, fontWeight: 800, color: on ? '#fff' : dark.textMuted}}>{categoryCounts[c.key] ?? 0}</span>
              </span>
            </PressableScale>
          );
        })}
      </div>

      <div style={{...sec, marginTop: 4}}>Roster — click for calendar</div>
      {filteredUsers.length === 0 ? (
        <div style={{borderRadius: 24, border: `1px dashed ${dark.border}`, padding: 28, textAlign: 'center', marginBottom: spacing.sm}}>
          <Icon name="calendar" size={22} color={dark.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: spacing.sm, color: dark.textMuted}}>{attQ ? `No match for "${query.trim()}"` : 'No one in this category yet'}</div>
        </div>
      ) : (
        <div style={{...darkCard, overflow: 'hidden', marginBottom: spacing.sm}}>
          {filteredUsers.map((u, i) => (
            <RosterRow key={u.userId} user={u} monthStr={monthStr} onClick={() => setSelectedUser(u)} isLast={i === filteredUsers.length - 1} />
          ))}
        </div>
      )}

      <div style={{...sec, marginTop: spacing.sm}}>Today — marked automatically</div>
      {todayRows.length === 0 ? (
        <div style={{borderRadius: 24, border: `1px dashed ${dark.border}`, padding: 28, textAlign: 'center'}}>
          <Icon name="clock" size={22} color={dark.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: spacing.sm, color: dark.textMuted}}>Nobody has been marked present yet today</div>
        </div>
      ) : (
        <div style={{...darkCard, overflow: 'hidden'}}>
          {todayRows.map((r, i) => (
            <div key={r.id} style={{display: 'flex', alignItems: 'center', gap: spacing.md, padding: '13px 14px', borderBottom: i === todayRows.length - 1 ? 'none' : `1px solid ${dark.divider}`}}>
              <div style={{width: 36, height: 36, borderRadius: radius.full, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: r.checkOut ? dark.cardAlt : dark.success + '22'}}>
                <span style={{fontSize: 12, fontWeight: 800, color: r.checkOut ? dark.textSecondary : dark.success}}>{r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
              </div>
              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 700, color: dark.textPrimary}}>{r.name}</div>
                <div style={{fontSize: 11, marginTop: 2, color: dark.textMuted}}>{roleLabel[r.role] ?? r.role} · {r.employeeId} · In {formatTime(r.checkIn)}</div>
              </div>
              {r.vehiclesHandled > 0 && <span style={{fontSize: 11, fontWeight: 700, color: dark.accent}}>{r.vehiclesHandled} vehicles</span>}
              <DarkPill label={r.checkOut ? 'Done' : 'Present'} color={r.checkOut ? dark.textMuted : dark.success} />
            </div>
          ))}
        </div>
      )}

      {/* One person's full calendar, on demand — reuses UserCalendar as-is,
          just no longer stacked for every user at once. */}
      {selectedUser && (
        <div style={{position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, zIndex: 1000}} onClick={() => setSelectedUser(null)}>
          <div style={{width: '100%', maxWidth: 420}} onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12}}>
              <span style={{fontSize: 17, fontWeight: 900, color: dark.textPrimary}}>{monthLabel(monthStr)}</span>
              <PressableScale style={{width: 32, height: 32, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: dark.cardAlt}} onClick={() => setSelectedUser(null)}>
                <Icon name="close" size={16} color={dark.textPrimary} />
              </PressableScale>
            </div>
            <UserCalendar user={selectedUser} monthStr={monthStr} />
          </div>
        </div>
      )}
    </div>
  );
}
