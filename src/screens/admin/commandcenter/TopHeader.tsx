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

export function TopHeader({
  period,
  onPeriodChange,
  dateRangeLabel,
  onRefresh,
  refreshing,
  query,
  onQueryChange,
  themeMode,
  onToggleTheme,
}: {
  period: AnalyticsPeriod;
  onPeriodChange: (p: AnalyticsPeriod) => void;
  dateRangeLabel: string;
  onRefresh: () => void;
  refreshing: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  themeMode: CcThemeMode;
  onToggleTheme: () => void;
}) {
  const cc = useCc();
  const isDark = themeMode === 'dark';

  return (
    <div style={{
      height: 60,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '0 20px',
      backgroundColor: cc.headerBg,
      borderBottom: `1px solid ${cc.border}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      zIndex: 9,
    }}>
      {/* Global Search Bar */}
      <div style={{
        flex: 1,
        maxWidth: 360,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backgroundColor: cc.card,
        border: `1px solid ${cc.border}`,
        borderRadius: 10,
        padding: '0 12px',
        height: 36,
      }}>
        <Icon name="search" size={14} color={cc.textMuted} />
        <input
          value={query}
          onChange={e => onQueryChange(e.target.value)}
          placeholder="Search plate, bay number, driver, task ID..."
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontSize: 12.5,
            fontWeight: 500,
            color: cc.textPrimary,
          }}
        />
        <span style={{
          fontSize: 9,
          fontWeight: 800,
          color: cc.textMuted,
          border: `1px solid ${cc.border}`,
          borderRadius: 4,
          padding: '1px 5px',
          flexShrink: 0,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        }}>
          Ctrl K
        </span>
      </div>

      <div style={{flex: 1}} />

      {/* Live System Beacon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        backgroundColor: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(22,163,74,0.08)',
        border: `1px solid ${isDark ? 'rgba(34,197,94,0.25)' : 'rgba(22,163,74,0.2)'}`,
      }}>
        <span style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: cc.success,
          boxShadow: `0 0 6px ${cc.success}`,
        }} />
        <span style={{fontSize: 10, fontWeight: 800, color: cc.success, letterSpacing: 0.3}}>
          SOCKET TELEMETRY ACTIVE
        </span>
      </div>

      {/* Period Selector Dropdown + Date Range Ribbon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '2px 8px 2px 4px',
        borderRadius: 10,
        backgroundColor: cc.card,
        border: `1px solid ${cc.border}`,
        height: 36,
      }}>
        <select
          value={period}
          onChange={e => onPeriodChange(e.target.value as AnalyticsPeriod)}
          style={{
            height: '100%',
            borderRadius: 7,
            border: 'none',
            backgroundColor: 'transparent',
            color: cc.textPrimary,
            fontSize: 11.5,
            fontWeight: 800,
            padding: '0 6px',
            outline: 'none',
            cursor: 'pointer',
          }}>
          {PERIODS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <span style={{width: 1, height: 16, backgroundColor: cc.divider}} />
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: cc.textMuted,
          whiteSpace: 'nowrap',
          paddingRight: 4,
        }}>
          {dateRangeLabel}
        </span>
      </div>

      {/* Manual Refresh Trigger */}
      <PressableScale
        onClick={onRefresh}
        disabled={refreshing}
        title="Sync command telemetry"
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: cc.card,
          border: `1px solid ${cc.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: refreshing ? 0.6 : 1,
        }}>
        {refreshing ? (
          <span className="spinner" style={{width: 14, height: 14, borderWidth: 2, borderColor: cc.border, borderTopColor: cc.accentBlue}} />
        ) : (
          <Icon name="refresh" size={15} color={cc.textPrimary} />
        )}
      </PressableScale>

      {/* Dark / Light Mode Switcher */}
      <PressableScale
        onClick={onToggleTheme}
        title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: cc.card,
          border: `1px solid ${cc.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name={themeMode === 'dark' ? 'sun' : 'moon'} size={15} color={cc.textPrimary} />
      </PressableScale>
    </div>
  );
}
