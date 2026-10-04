import React, {useEffect, useState, useCallback} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useAppState, ParkingTask} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {Icon} from '../components/Icon';

function formatDate(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  delivered: 'Ready for Pickup',
  in_transit: 'In Transit',
  key_collected: 'Key Handed Over',
  assigned: 'Assigned',
  requested: 'Requested',
  accepted: 'Valet Dispatched',
};

export function HistoryScreen({onBack}: {onBack: () => void}) {
  const {user} = useAuth();
  const {fetchTaskHistory} = useAppState();
  const {colors, isDark} = useTheme();
  const [rows, setRows] = useState<ParkingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchTaskHistory({doctorId: user.id})
      .then(setRows)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id, fetchTaskHistory]);

  useEffect(() => {
    load();
  }, [load]);

  const glassCardStyle: React.CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    boxShadow: isDark ? '0 4px 16px rgba(0, 0, 0, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.03)',
  };

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 80}}>
      {/* Top Workstation Navigation Bar */}
      <div style={{
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
      }}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <PressableScale
            onClick={onBack}
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.cardAlt,
              cursor: 'pointer',
            }}>
            <Icon name="back" size={18} color={colors.textPrimary} />
          </PressableScale>

          <div>
            <div style={{fontSize: 16, fontWeight: 900, color: colors.textPrimary, letterSpacing: -0.2}}>
              Parking History
            </div>
            <div style={{fontSize: 11, fontWeight: 700, color: colors.textSecondary, letterSpacing: 0.4, textTransform: 'uppercase'}}>
              Audit Log & Past Sessions
            </div>
          </div>
        </div>

        {rows.length > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 800,
            padding: '4px 10px',
            borderRadius: 8,
            backgroundColor: colors.cardAlt,
            color: colors.textSecondary,
            border: `1px solid ${colors.border}`,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {rows.length} SESSIONS
          </span>
        )}
      </div>

      <div style={{padding: 16}}>
        {loading && rows.length === 0 ? (
          <div style={{display: 'flex', justifyContent: 'center', padding: '60px 0'}}>
            <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary, width: 32, height: 32}} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{
            ...glassCardStyle,
            padding: '48px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginTop: 20,
          }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              backgroundColor: colors.cardAlt,
            }}>
              <Icon name="history" size={24} color={colors.textMuted} />
            </div>
            <div style={{fontSize: 16, fontWeight: 800, color: colors.textPrimary, marginBottom: 4}}>
              No Past Sessions Found
            </div>
            <div style={{fontSize: 12.5, color: colors.textSecondary, maxWidth: 260, lineHeight: '18px'}}>
              Completed curbside parking and retrieval missions will be logged here automatically.
            </div>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            {rows.map(item => {
              const isPark = item.type === 'park';
              const isDone = item.status === 'completed';
              const isCancelled = item.status === 'cancelled';
              const toneColor = isDone ? colors.success : isCancelled ? colors.textMuted : colors.primary;

              return (
                <div
                  key={item.id}
                  style={{
                    ...glassCardStyle,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: 14,
                  }}>
                  {/* Directional Icon Badge */}
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDone
                      ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                      : isCancelled
                      ? colors.cardAlt
                      : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF'),
                    border: `1px solid ${toneColor}30`,
                  }}>
                    <Icon
                      name={isPark ? 'arrowDown' : 'arrowUp'}
                      size={16}
                      color={toneColor}
                    />
                  </div>

                  {/* Vehicle & Session Details */}
                  <div style={{flex: 1, minWidth: 0}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 900,
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor: isPark
                          ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                          : (isDark ? 'rgba(6, 182, 212, 0.15)' : '#ECFEFF'),
                        color: isPark ? colors.success : '#06B6D4',
                        letterSpacing: 0.3,
                        textTransform: 'uppercase',
                      }}>
                        {isPark ? 'PARK' : 'RETRIEVE'}
                      </span>
                      <span style={{fontFamily: 'monospace', fontSize: 13.5, fontWeight: 900, color: colors.textPrimary}}>
                        {item.carNumber}
                      </span>
                    </div>

                    <div style={{fontSize: 11.5, fontWeight: 600, marginTop: 4, color: colors.textSecondary, display: 'flex', alignItems: 'center', gap: 6}}>
                      <span style={{fontVariantNumeric: 'tabular-nums'}}>
                        {formatDate(item.assignedAt ?? item.requestedAt)}
                      </span>
                      {item.slotId && (
                        <span style={{fontWeight: 800, color: colors.primary}}>
                          · BAY {item.slotId}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Status Tag */}
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: 0.3,
                    padding: '4px 8px',
                    borderRadius: 6,
                    backgroundColor: isDone
                      ? (isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5')
                      : isCancelled
                      ? colors.cardAlt
                      : (isDark ? 'rgba(59, 130, 246, 0.15)' : '#EFF6FF'),
                    color: toneColor,
                    flexShrink: 0,
                    textTransform: 'uppercase',
                  }}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
