import React, {useState, useEffect, useCallback} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {adminApi} from '../../services/api';
import {Icon, IconName} from '../../components/Icon';
import {useAdminOpsTheme, DarkPill} from './adminDarkTheme';

interface TodayRow {
  id: number;
  userId: number;
  name: string;
  role: string;
  employeeId: string;
  checkIn: string | null;
  checkOut: string | null;
  vehiclesHandled: number;
  gate?: string | null;
}

interface MonthlyUser {
  userId: number;
  name: string;
  role: string;
  employeeId: string;
  days: {date: string; checkIn: string | null; checkOut: string | null; vehiclesHandled: number}[];
}

const roleLabel: Record<string, string> = {
  doctor: 'Doctor',
  staff: 'Staff',
  valet: 'Valet',
  driver: 'Driver',
  admin: 'Admin',
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const CATEGORIES: {key: string; label: string; icon: IconName}[] = [
  {key: 'all', label: 'All Personnel', icon: 'people'},
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
  const dark = useAdminOpsTheme();
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const firstWeekday = new Date(y, m - 1, 1).getDay();
  const presentDates = new Map(user.days.filter(d => d.checkIn).map(d => [d.date, d]));
  const todayStr = new Date().toISOString().slice(0, 10);
  const presentCount = presentDates.size;
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({length: daysInMonth}, (_, i) => i + 1)];

  return (
    <div style={{
      borderRadius: 18,
      border: `1px solid ${dark.border}`,
      backgroundColor: dark.card,
      padding: '18px 16px',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
    }}>
      {/* Calendar Header with User Details */}
      <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: `${dark.accent}1F`,
          border: `1px solid ${dark.accent}33`,
        }}>
          <span style={{fontSize: 13, fontWeight: 900, color: dark.accent}}>
            {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{fontSize: 14, fontWeight: 800, color: dark.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
            {user.name}
          </div>
          <div style={{fontSize: 11, marginTop: 2, color: dark.textMuted}}>
            {roleLabel[user.role] ?? user.role} · <span style={{fontFamily: 'monospace'}}>{user.employeeId}</span>
          </div>
        </div>
        <div style={{
          borderRadius: 10,
          padding: '6px 12px',
          textAlign: 'center',
          backgroundColor: `${dark.success}1A`,
          border: `1px solid ${dark.success}33`,
        }}>
          <div style={{fontSize: 16, fontWeight: 900, color: dark.success, fontVariantNumeric: 'tabular-nums'}}>
            {presentCount}
          </div>
          <div style={{fontSize: 8.5, fontWeight: 800, textTransform: 'uppercase', color: dark.textMuted, letterSpacing: 0.5}}>
            DAYS PRESENT
          </div>
        </div>
      </div>

      {/* Weekday Row */}
      <div style={{display: 'flex', marginBottom: 6}}>
        {WEEKDAYS.map((w, i) => (
          <span key={i} style={{
            flex: 1,
            textAlign: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: dark.textMuted,
            letterSpacing: 0.5,
          }}>
            {w}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{display: 'flex', flexWrap: 'wrap'}}>
        {cells.map((day, i) => {
          if (day == null) return <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1', padding: '2px 0'}} />;
          const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const rec = presentDates.get(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;
          const bg = rec ? dark.success : isFuture ? 'transparent' : `${dark.border}22`;
          const tc = rec ? '#0E0E0E' : isFuture ? dark.textMuted : dark.textSecondary;

          return (
            <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0'}}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 9,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: bg,
                border: isToday ? `1.5px solid ${dark.accent}` : 'none',
                boxShadow: rec ? `0 2px 8px ${dark.success}44` : 'none',
              }}>
                <span style={{fontSize: 10.5, fontWeight: 800, color: tc, fontVariantNumeric: 'tabular-nums'}}>
                  {day}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RosterRow({user, monthStr, onClick, isLast}: {
  user: MonthlyUser;
  monthStr: string;
  onClick: () => void;
  isLast: boolean;
}) {
  const dark = useAdminOpsTheme();
  const [y, m] = monthStr.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const presentDates = new Set(user.days.filter(d => d.checkIn).map(d => d.date));
  const presentCount = presentDates.size;
  const pct = daysInMonth ? Math.round((presentCount / daysInMonth) * 100) : 0;

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
    <PressableScale
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderBottom: isLast ? 'none' : `1px solid ${dark.divider}`,
        textAlign: 'left',
        cursor: 'pointer',
      }}>
      {/* Monogram Avatar */}
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 11,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: `${dark.accent}1A`,
        border: `1px solid ${dark.accent}30`,
      }}>
        <span style={{fontSize: 12, fontWeight: 900, color: dark.accent}}>
          {user.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>

      {/* Staff Metadata */}
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontSize: 13, fontWeight: 800, color: dark.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
          {user.name}
        </div>
        <div style={{fontSize: 11, marginTop: 1, color: dark.textMuted}}>
          {roleLabel[user.role] ?? user.role} · <span style={{fontFamily: 'monospace'}}>{user.employeeId}</span>
        </div>

        {/* 7-day sparkline history dots */}
        <div style={{display: 'flex', gap: 4, marginTop: 5}}>
          {recentDays.map(d => (
            <span
              key={d.key}
              title={d.key}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: d.present ? dark.success : 'transparent',
                border: d.present ? 'none' : `1px solid ${dark.border}`,
                boxShadow: d.present ? `0 0 4px ${dark.success}` : 'none',
                opacity: d.present || d.inMonth ? 1 : 0.35,
              }}
            />
          ))}
        </div>
      </div>

      {/* Monthly Rate & Days */}
      <div style={{textAlign: 'right', flexShrink: 0}}>
        <div style={{
          fontSize: 14.5,
          fontWeight: 900,
          color: pct >= 80 ? dark.success : pct >= 50 ? dark.warning : dark.textMuted,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {pct}%
        </div>
        <div style={{fontSize: 10, fontWeight: 700, marginTop: 1, color: dark.textMuted, fontVariantNumeric: 'tabular-nums'}}>
          {presentCount}/{daysInMonth}d
        </div>
      </div>

      <Icon name="chevronRight" size={14} color={dark.textMuted} />
    </PressableScale>
  );
}

export function AdminAttendanceScreen() {
  const dark = useAdminOpsTheme();
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
        adminApi.attendanceToday(),
        adminApi.listUsers(),
        adminApi.attendanceMonthly(month),
      ]);
      setTodayRows(today);
      const byUserId = new Map(monthly.users.map(u => [u.userId, u]));
      setMonthUsers(allUsers.map((u: any) => byUserId.get(u.id) ?? {
        userId: u.id,
        name: u.name,
        role: u.role,
        employeeId: u.employeeId,
        days: [],
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(monthStr);
  }, [monthStr, load]);

  const present = todayRows.filter(r => r.checkIn && !r.checkOut).length;
  const checkedInToday = todayRows.length;
  const totalStaff = monthUsers.length;
  const attendanceRate = totalStaff ? Math.round((checkedInToday / totalStaff) * 100) : 0;
  const isCurrentMonth = monthStr === currentMonthStr();

  const categoryCounts: Record<string, number> = {all: monthUsers.length};
  for (const u of monthUsers) {
    categoryCounts[u.role] = (categoryCounts[u.role] ?? 0) + 1;
  }

  const attQ = query.trim().toLowerCase();
  const filteredUsers = (category === 'all' ? monthUsers : monthUsers.filter(u => u.role === category))
    .filter(u => !attQ || u.name.toLowerCase().includes(attQ) || u.employeeId.toLowerCase().includes(attQ));

  const visibleCategories = CATEGORIES.filter(c => c.key === 'all' || (categoryCounts[c.key] ?? 0) > 0);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        minHeight: '70vh',
        backgroundColor: dark.bg,
      }}>
        <span className="spinner" style={{width: 32, height: 32, borderColor: dark.border, borderTopColor: dark.accent}} />
        <span style={{fontSize: 12, fontWeight: 700, color: dark.textMuted}}>
          Synchronizing hospital attendance ledger...
        </span>
      </div>
    );
  }

  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: '16px 14px 48px'}}>
      {/* ── Workstation Top Header ── */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 16,
        backgroundColor: dark.card,
        border: `1px solid ${dark.border}`,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 10, minWidth: 0}}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 11,
            backgroundColor: `${dark.accent}1F`,
            border: `1px solid ${dark.accent}33`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Icon name="calendar" size={19} color={dark.accent} />
          </div>
          <div style={{minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 13, fontWeight: 900, color: dark.textPrimary, letterSpacing: -0.2, textTransform: 'uppercase'}}>
                Attendance Ledger
              </span>
              <span style={{
                fontSize: 9.5,
                fontWeight: 800,
                color: dark.success,
                padding: '2px 6px',
                borderRadius: 999,
                backgroundColor: `${dark.success}1A`,
                border: `1px solid ${dark.success}33`,
              }}>
                REALTIME
              </span>
            </div>
            <div style={{fontSize: 10.5, fontWeight: 600, color: dark.textMuted, marginTop: 1}}>
              KIMS Healthcare Shift & Presence Telemetry
            </div>
          </div>
        </div>

        {/* Total Roster Badge */}
        <div style={{
          padding: '6px 12px',
          borderRadius: 10,
          backgroundColor: dark.surface,
          border: `1px solid ${dark.border}`,
          textAlign: 'right',
          flexShrink: 0,
        }}>
          <div style={{fontSize: 13, fontWeight: 900, color: dark.textPrimary, fontVariantNumeric: 'tabular-nums'}}>
            {totalStaff}
          </div>
          <div style={{fontSize: 9, fontWeight: 700, color: dark.textMuted, textTransform: 'uppercase'}}>
            ROSTER STAFF
          </div>
        </div>
      </div>

      {/* ── Today Headline Metrics Hero Card ── */}
      <div style={{
        borderRadius: 18,
        border: `1px solid ${dark.border}`,
        backgroundColor: dark.card,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        <div style={{display: 'flex', alignItems: 'center', padding: '18px 0'}}>
          {/* Present Right Now */}
          <div style={{flex: 1, textAlign: 'center'}}>
            <div style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: -1,
              lineHeight: 1,
              color: dark.success,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {present}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              fontSize: 11,
              fontWeight: 800,
              color: dark.textMuted,
            }}>
              <span style={{width: 6, height: 6, borderRadius: 3, backgroundColor: dark.success, boxShadow: `0 0 6px ${dark.success}`}} />
              <span>ON-SITE NOW</span>
            </div>
          </div>

          <div style={{width: 1, alignSelf: 'stretch', margin: '4px 0', backgroundColor: dark.divider}} />

          {/* Checked in Today Rate */}
          <div style={{flex: 1, textAlign: 'center'}}>
            <div style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: -1,
              lineHeight: 1,
              color: dark.textPrimary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {attendanceRate}%
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              fontSize: 11,
              fontWeight: 800,
              color: dark.textMuted,
            }}>
              <Icon name="check" size={12} color={dark.accent} />
              <span>CHECKED IN TODAY</span>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '10px 14px',
          borderTop: `1px solid ${dark.divider}`,
          backgroundColor: dark.surface,
        }}>
          <Icon name="people" size={13} color={dark.textMuted} />
          <span style={{fontSize: 11.5, fontWeight: 700, color: dark.textSecondary}}>
            {checkedInToday} of {totalStaff} personnel recorded today
          </span>
        </div>
      </div>

      {/* ── Month Selection Navigation Strip ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        borderRadius: 14,
        backgroundColor: dark.card,
        border: `1px solid ${dark.border}`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        marginBottom: 10,
      }}>
        <PressableScale
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${dark.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark.surface,
          }}
          onClick={() => setMonthStr(m => shiftMonth(m, -1))}>
          <Icon name="chevronLeft" size={16} color={dark.textPrimary} />
        </PressableScale>

        <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
          <Icon name="calendar" size={14} color={dark.accent} />
          <span style={{fontSize: 13, fontWeight: 800, color: dark.textPrimary}}>
            {monthLabel(monthStr)}
          </span>
        </div>

        <PressableScale
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: `1px solid ${dark.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: dark.surface,
            opacity: isCurrentMonth ? 0.35 : 1,
          }}
          onClick={() => !isCurrentMonth && setMonthStr(m => shiftMonth(m, 1))}
          disabled={isCurrentMonth}>
          <Icon name="chevronRight" size={16} color={dark.textPrimary} />
        </PressableScale>
      </div>

      {/* ── Search Bar ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: 12,
        border: `1px solid ${dark.border}`,
        padding: '0 12px',
        height: 42,
        marginBottom: 10,
        backgroundColor: dark.card,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}>
        <Icon name="search" size={15} color={dark.textMuted} />
        <input
          style={{
            flex: 1,
            fontSize: 13,
            fontWeight: 600,
            padding: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: dark.textPrimary,
          }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter staff by name or employee ID..."
        />
        {!!query && (
          <PressableScale onClick={() => setQuery('')} style={{background: 'transparent', border: 'none', padding: 4}}>
            <Icon name="close" size={13} color={dark.textMuted} />
          </PressableScale>
        )}
      </div>

      {/* ── Category Filters Scroller ── */}
      <div className="hscroll" style={{gap: 6, paddingBottom: 10}}>
        {visibleCategories.map(c => {
          const on = category === c.key;
          return (
            <PressableScale
              key={c.key}
              onClick={() => setCategory(c.key)}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                borderRadius: 999,
                border: `1px solid ${on ? dark.accent : dark.border}`,
                padding: '6px 12px',
                backgroundColor: on ? dark.accent : dark.card,
                boxShadow: on ? `0 2px 8px ${dark.accent}33` : 'none',
              }}>
              <Icon name={c.icon} size={12} color={on ? '#fff' : dark.textMuted} />
              <span style={{fontSize: 11.5, fontWeight: 800, color: on ? '#fff' : dark.textSecondary}}>
                {c.label}
              </span>
              <span style={{
                borderRadius: 8,
                padding: '1px 5px',
                fontSize: 9.5,
                fontWeight: 800,
                backgroundColor: on ? 'rgba(255,255,255,0.25)' : `${dark.border}44`,
                color: on ? '#fff' : dark.textMuted,
              }}>
                {categoryCounts[c.key] ?? 0}
              </span>
            </PressableScale>
          );
        })}
      </div>

      {/* ── Monthly Roster Section ── */}
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        color: dark.textMuted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginTop: 4,
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Monthly Summary — Tap for Full Calendar</span>
        <span style={{fontSize: 10, color: dark.textMuted}}>
          {filteredUsers.length} MEMBERS
        </span>
      </div>

      {filteredUsers.length === 0 ? (
        <div style={{
          borderRadius: 16,
          border: `1px dashed ${dark.border}`,
          padding: '32px 20px',
          textAlign: 'center',
          backgroundColor: dark.card,
          marginBottom: 14,
        }}>
          <Icon name="calendar" size={20} color={dark.textMuted} />
          <div style={{fontSize: 12.5, fontWeight: 700, marginTop: 6, color: dark.textPrimary}}>
            {attQ ? `No staff matching "${query.trim()}"` : 'No personnel in this category'}
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: 16,
          border: `1px solid ${dark.border}`,
          backgroundColor: dark.card,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
          marginBottom: 16,
        }}>
          {filteredUsers.map((u, i) => (
            <RosterRow
              key={u.userId}
              user={u}
              monthStr={monthStr}
              onClick={() => setSelectedUser(u)}
              isLast={i === filteredUsers.length - 1}
            />
          ))}
        </div>
      )}

      {/* ── Today Live Check-in Stream ── */}
      <div style={{
        fontSize: 11,
        fontWeight: 800,
        color: dark.textMuted,
        letterSpacing: 0.8,
        textTransform: 'uppercase',
        marginBottom: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span>Today's Auto-Marked Log</span>
        <span style={{fontSize: 10, color: dark.textMuted}}>
          {todayRows.length} ENTRIES
        </span>
      </div>

      {todayRows.length === 0 ? (
        <div style={{
          borderRadius: 16,
          border: `1px dashed ${dark.border}`,
          padding: '32px 20px',
          textAlign: 'center',
          backgroundColor: dark.card,
        }}>
          <Icon name="clock" size={20} color={dark.textMuted} />
          <div style={{fontSize: 12.5, fontWeight: 700, marginTop: 6, color: dark.textMuted}}>
            No personnel have clocked in yet today.
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: 16,
          border: `1px solid ${dark.border}`,
          backgroundColor: dark.card,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          overflow: 'hidden',
        }}>
          {todayRows.map((r, i) => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderBottom: i === todayRows.length - 1 ? 'none' : `1px solid ${dark.divider}`,
              }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: r.checkOut ? dark.surface : `${dark.success}1A`,
                border: `1px solid ${r.checkOut ? dark.border : `${dark.success}33`}`,
              }}>
                <span style={{
                  fontSize: 12,
                  fontWeight: 900,
                  color: r.checkOut ? dark.textMuted : dark.success,
                }}>
                  {r.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>

              <div style={{flex: 1, minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 800, color: dark.textPrimary}}>
                  {r.name}
                </div>
                <div style={{fontSize: 11, marginTop: 1, color: dark.textMuted}}>
                  {roleLabel[r.role] ?? r.role} · <span style={{fontFamily: 'monospace'}}>{r.employeeId}</span> · In {formatTime(r.checkIn)}
                </div>
              </div>

              {r.vehiclesHandled > 0 && (
                <span style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: dark.accent,
                  padding: '2px 7px',
                  borderRadius: 6,
                  backgroundColor: `${dark.accent}14`,
                }}>
                  {r.vehiclesHandled} cars
                </span>
              )}

              <DarkPill
                label={r.checkOut ? 'COMPLETED' : 'PRESENT'}
                color={r.checkOut ? dark.textMuted : dark.success}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Interactive Monthly Calendar Modal ── */}
      {selectedUser && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            zIndex: 1000,
          }}
          onClick={() => setSelectedUser(null)}>
          <div
            style={{width: '100%', maxWidth: 420}}
            onClick={e => e.stopPropagation()}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10}}>
              <span style={{fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: -0.2}}>
                {monthLabel(monthStr)} Roster Sheet
              </span>
              <PressableScale
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  border: '1px solid rgba(255,255,255,0.2)',
                }}
                onClick={() => setSelectedUser(null)}>
                <Icon name="close" size={15} color="#fff" />
              </PressableScale>
            </div>
            <UserCalendar user={selectedUser} monthStr={monthStr} />
          </div>
        </div>
      )}
    </div>
  );
}
