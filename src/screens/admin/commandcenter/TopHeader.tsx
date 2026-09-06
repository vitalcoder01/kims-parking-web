import React from 'react';
import {Icon} from '../../../components/Icon';
import {PressableScale} from '../../../components/PressableScale';
import {useCc, CcThemeMode} from './ccTheme';
import type {AnalyticsPeriod} from '../../../services/api';

const PERIODS: {key: AnalyticsPeriod; label: string}[] = [
  {key: 'daily', label: 'Today'},
  {key: 'weekly', label: 'This Week'},
  {key: 'monthly', label: 'This Month'},
  {key: 'yearly', label: 'This Year'},
  {key: 'all', label: 'All-time'},
];

export function TopHeader({period, onPeriodChange, dateRangeLabel, onRefresh, refreshing, connected, query, onQueryChange, unreadCount, userName, themeMode, onToggleTheme}: {
  period: AnalyticsPeriod; onPeriodChange: (p: AnalyticsPeriod) => void; dateRangeLabel: string;
  onRefresh: () => void; refreshing: boolean; connected: boolean;
  query: string; onQueryChange: (q: string) => void;
  unreadCount: number; userName: string;
  themeMode: CcThemeMode; onToggleTheme: () => void;
}) {
  const cc = useCc();
  return (
    <div style={{
      height: 64, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', backgroundColor: cc.headerBg, borderBottom: `1px solid ${cc.border}`,
    }}>
      <div style={{flexShrink: 0}}>
        <div style={{fontSize: 16, fontWeight: 900, color: cc.textPrimary, letterSpacing: -0.2}}>Parking Intelligence</div>
        <div style={{fontSize: 10.5, color: cc.textMuted, marginTop: 1}}>Smart Parking. Better Care. Brighter Tomorrow.</div>
      </div>

      <div style={{
        flex: 1, maxWidth: 340, display: 'flex', alignItems: 'center', gap: 8,
        backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`, borderRadius: 10, padding: '0 12px', height: 34,
      }}>
        <Icon name="search" size={14} color={cc.textMuted} />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search anything... (vehicle no, slot, driver, task id)"
          style={{flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, color: cc.textPrimary}}
        />
        <span style={{fontSize: 9.5, fontWeight: 700, color: cc.textMuted, border: `1px solid ${cc.border}`, borderRadius: 5, padding: '1px 5px', flexShrink: 0}}>Ctrl K</span>
      </div>

      {/* Period + the real date range that period resolves to (see App's
          periodRange.js — this label is computed the same way, client-side,
          purely for display; the backend range is still what actually
          filters the data). */}
      <div style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8}}>
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value as AnalyticsPeriod)}
          style={{
            height: 34, borderRadius: 9, border: `1px solid ${cc.border}`, backgroundColor: cc.cardAlt,
            color: cc.textPrimary, fontSize: 11.5, fontWeight: 700, padding: '0 8px',
          }}>
          {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span style={{fontSize: 10.5, fontWeight: 600, color: cc.textMuted, whiteSpace: 'nowrap'}}>{dateRangeLabel}</span>
      </div>

      {/* Comparison is always on — every KPI delta already compares against
          the immediately-preceding equivalent period (see kpiComparison in
          analytics.service.js). This just states that plainly. */}
      <div style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', borderRadius: 9, border: `1px solid ${cc.border}`, backgroundColor: cc.cardAlt}}>
        <Icon name="trending" size={12} color={cc.textMuted} />
        <span style={{fontSize: 10.5, fontWeight: 700, color: cc.textSecondary, whiteSpace: 'nowrap'}}>vs Previous Period</span>
      </div>

      <div style={{flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, height: 34, padding: '0 12px', borderRadius: 9, backgroundColor: cc.success + '18'}}>
        <span style={{width: 7, height: 7, borderRadius: 4, backgroundColor: cc.success, display: 'inline-block'}} />
        <span style={{fontSize: 11, fontWeight: 800, color: cc.success}}>{connected ? 'Live' : 'Offline'}</span>
      </div>

      <PressableScale onClick={onRefresh} disabled={refreshing} style={{
        flexShrink: 0, width: 34, height: 34, borderRadius: 9, backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: refreshing ? 0.6 : 1,
      }}>
        {refreshing ? <span className="spinner" style={{width: 14, height: 14, borderColor: cc.border, borderTopColor: cc.accentBlue}} /> : <Icon name="refresh" size={15} color={cc.textPrimary} />}
      </PressableScale>

      {/* Real unread count from the app's own notification stream. */}
      <div style={{position: 'relative', flexShrink: 0}}>
        <div style={{width: 34, height: 34, borderRadius: 9, backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <Icon name="bell" size={15} color={cc.textPrimary} />
        </div>
        {unreadCount > 0 && (
          <span style={{position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: cc.danger, color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px'}}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {/* Real light/dark toggle for the command center's own palette (see
          ccTheme.ts) — scoped to this shell + the Dashboard panels, not the
          other reused mobile screens (Guard/Map/Staff/etc), which keep
          their own separate fixed-dark theme. */}
      <PressableScale
        onClick={onToggleTheme}
        title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        style={{flexShrink: 0, width: 34, height: 34, borderRadius: 9, backgroundColor: cc.cardAlt, border: `1px solid ${cc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <Icon name={themeMode === 'dark' ? 'moon' : 'sun'} size={14} color={cc.textPrimary} />
      </PressableScale>

      <div style={{flexShrink: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: cc.accentBlue + '30', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <span style={{fontSize: 11.5, fontWeight: 800, color: cc.accentBlue}}>{userName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
      </div>
    </div>
  );
}
