import React, {useEffect, useState, useCallback} from 'react';
import {PressableScale} from '../components/PressableScale';
import {useAuth} from '../context/AuthContext';
import {useAppState, ParkingTask} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {Icon} from '../components/Icon';

// Web port of the mobile app's DoctorHistoryScreen — the full past-sessions
// log, bypassing the backend's isCurrent filter that the live Home/Parking
// screens rely on.
function formatDate(ms?: number) {
  if (!ms) return '—';
  return new Date(ms).toLocaleString(undefined, {month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed',
  cancelled: 'Cancelled',
  delivered: 'Awaiting pickup confirmation',
  in_transit: 'In transit',
  key_collected: 'Driver has key',
  assigned: 'Assigned',
  requested: 'Requested',
  // A valet has taken the departure but hasn't dispatched a driver yet.
  accepted: 'Valet assigned',
};

export function HistoryScreen({onBack}: {onBack: () => void}) {
  const {user} = useAuth();
  const {fetchTaskHistory} = useAppState();
  const {colors} = useTheme();
  const [rows, setRows] = useState<ParkingTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!user?.id) return;
    setLoading(true);
    fetchTaskHistory({doctorId: user.id}).then(setRows).catch(() => {}).finally(() => setLoading(false));
  }, [user?.id, fetchTaskHistory]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background}}>
      <div style={{padding: '12px 16px 40px'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
          <PressableScale
            onClick={onBack}
            style={{
              width: 36, height: 36, borderRadius: 18, border: `1px solid ${colors.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backgroundColor: colors.surface, flexShrink: 0,
            }}>
            <Icon name="back" size={18} color={colors.textPrimary} />
          </PressableScale>
          <span style={{fontSize: 20, fontWeight: 900, color: colors.textPrimary}}>Parking History</span>
        </div>

        {loading && rows.length === 0 ? (
          <div style={{display: 'flex', justifyContent: 'center', padding: '60px 0'}}>
            <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary, width: 28, height: 28}} />
          </div>
        ) : rows.length === 0 ? (
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, paddingTop: 80}}>
            <Icon name="history" size={36} color={colors.textMuted} />
            <span style={{fontSize: 13, color: colors.textMuted}}>No past sessions yet.</span>
          </div>
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
            {rows.map(item => {
              const done = item.status === 'completed';
              const cancelled = item.status === 'cancelled';
              const tone = done ? colors.success : cancelled ? colors.textMuted : colors.warning;
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    borderRadius: 16, border: `1px solid ${colors.border}`, padding: 14,
                    backgroundColor: colors.surface,
                  }}>
                  <span style={{
                    width: 36, height: 36, borderRadius: 12, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: tone + '18',
                  }}>
                    <Icon name={item.type === 'park' ? 'arrowDown' : 'arrowUp'} size={16} color={tone} />
                  </span>
                  <span style={{flex: 1, minWidth: 0}}>
                    <span style={{display: 'block', fontSize: 14, fontWeight: 800, color: colors.textPrimary}}>
                      {item.type === 'park' ? 'Parked' : 'Retrieved'} · {item.carNumber}
                    </span>
                    <span style={{display: 'block', fontSize: 11, marginTop: 2, color: colors.textMuted}}>
                      {formatDate(item.assignedAt ?? item.requestedAt)}{item.slotId ? ` · Slot ${item.slotId}` : ''}
                    </span>
                  </span>
                  <span style={{fontSize: 11, fontWeight: 700, color: tone, flexShrink: 0}}>{STATUS_LABEL[item.status] ?? item.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
