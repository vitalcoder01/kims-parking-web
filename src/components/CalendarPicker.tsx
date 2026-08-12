import React, {useState} from 'react';
import {useTheme} from '../context/ThemeContext';
import {Icon} from './Icon';
import {PressableScale} from './PressableScale';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function toKey(y: number, m: number, d: number) { return `${y}-${pad(m + 1)}-${pad(d)}`; }

/**
 * Month-grid date picker — web port of the mobile app's CalendarPicker,
 * built from scratch rather than the native <input type="date"> so it
 * actually matches the app's theme (light/dark tokens, warm-mono palette,
 * rounded card language) instead of whatever the browser's own date UI
 * happens to look like. Selection-only, single day.
 */
export function CalendarPicker({
  visible, value, maxDate, onSelect, onClose,
}: {
  visible: boolean;
  /** 'YYYY-MM-DD', or undefined for no day highlighted. */
  value?: string;
  /** Days after this (local) are disabled — records views have nothing to
   *  show for a future date. Defaults to today. */
  maxDate?: Date;
  onSelect: (date: string) => void;
  onClose: () => void;
}) {
  const {colors, isDark} = useTheme();
  const today = new Date();
  const cap = maxDate ?? today;
  const initial = value ? new Date(`${value}T00:00:00`) : today;
  const [viewYear, setViewYear] = useState(initial.getFullYear());
  const [viewMonth, setViewMonth] = useState(initial.getMonth());

  if (!visible) return null;

  const capKey = toKey(cap.getFullYear(), cap.getMonth(), cap.getDate());
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({length: startWeekday}, () => null),
    ...Array.from({length: daysInMonth}, (_, i) => i + 1),
  ];

  // The current month view is "at the cap" once it's the same month/year as
  // the max selectable date — that's what disables the next-month arrow.
  const atMonthCap = viewYear === cap.getFullYear() && viewMonth === cap.getMonth();

  const goNext = () => {
    if (atMonthCap) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.45)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, borderRadius: 20, padding: 18,
          border: `1px solid ${colors.border}`, backgroundColor: colors.surface,
          boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14}}>
          <PressableScale
            style={{width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt}}
            onClick={goPrev}>
            <Icon name="chevronLeft" size={16} color={colors.textPrimary} />
          </PressableScale>
          <span style={{fontSize: 16, fontWeight: 800, color: colors.textPrimary}}>{MONTHS[viewMonth]} {viewYear}</span>
          <PressableScale
            style={{width: 32, height: 32, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt, opacity: atMonthCap ? 0.35 : 1}}
            disabled={atMonthCap}
            onClick={goNext}>
            <Icon name="chevronRight" size={16} color={colors.textPrimary} />
          </PressableScale>
        </div>

        <div style={{display: 'flex', marginBottom: 4}}>
          {WEEKDAYS.map((w, i) => (
            <span key={i} style={{flex: 1, textAlign: 'center', fontSize: 12, fontWeight: 700, color: colors.textMuted}}>{w}</span>
          ))}
        </div>

        <div style={{display: 'flex', flexWrap: 'wrap'}}>
          {cells.map((day, i) => {
            if (day == null) return <div key={i} style={{width: `${100 / 7}%`, aspectRatio: '1'}} />;
            const key = toKey(viewYear, viewMonth, day);
            const disabled = key > capKey;
            const selected = key === value;
            const isToday = key === todayKey;
            return (
              <button
                key={i}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(key)}
                style={{
                  width: `${100 / 7}%`, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'none', border: 'none', padding: 0, cursor: disabled ? 'default' : 'pointer',
                }}>
                <span style={{
                  width: 34, height: 34, borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: selected ? colors.primary : 'transparent',
                  border: !selected && isToday ? `1.5px solid ${colors.primary}` : 'none',
                  fontSize: 14, fontWeight: 600,
                  color: disabled ? colors.textMuted : selected ? colors.textOnPrimary : colors.textPrimary,
                  opacity: disabled ? 0.4 : 1,
                }}>
                  {day}
                </span>
              </button>
            );
          })}
        </div>

        <PressableScale
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%',
            marginTop: 14, height: 40, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: 'transparent',
          }}
          onClick={() => onSelect(todayKey)}>
          <Icon name="calendar" size={14} color={colors.textSecondary} />
          <span style={{fontSize: 13, fontWeight: 700, color: colors.textSecondary}}>Jump to today</span>
        </PressableScale>
      </div>
    </div>
  );
}
