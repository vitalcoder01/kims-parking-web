import React, {useEffect, useState, useCallback} from 'react';
import {useAuth} from '../context/AuthContext';
import {useAppState, ParkingTask} from '../context/AppStateContext';
import {useTheme} from '../context/ThemeContext';
import {Icon} from '../components/Icon';
import {Surface, Text, Button, EmptyState, Skeleton} from '../components/ui';
import {spacing, radius} from '../theme';

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
      <div style={{padding: `${spacing.md}px ${spacing.base}px ${spacing['3xl']}px`}}>

        <div style={{display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg}}>
          <Button variant="ghost" size="sm" shape="rounded" leftIcon="back" onClick={onBack} style={{paddingLeft: 10, paddingRight: 14}} />
          <Text variant="title" as="div">Parking History</Text>
        </div>

        {loading && rows.length === 0 ? (
          <div style={{display: 'flex', flexDirection: 'column', gap: spacing.sm}}>
            {[1, 2, 3].map(i => (
              <Surface key={i} elevation="e1" style={{display: 'flex', alignItems: 'center', gap: spacing.md}}>
                <Skeleton width={36} height={36} style={{borderRadius: radius.md, flexShrink: 0}} />
                <div style={{flex: 1}}>
                  <Skeleton width="60%" height={14} style={{borderRadius: 4, marginBottom: 6}} />
                  <Skeleton width="40%" height={11} style={{borderRadius: 4}} />
                </div>
                <Skeleton width={70} height={11} style={{borderRadius: 4}} />
              </Surface>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="history" title="No history yet" subtitle="Your past parking sessions appear here." />
        ) : (
          <div style={{display: 'flex', flexDirection: 'column', gap: spacing.sm}}>
            {rows.map(item => {
              const done = item.status === 'completed';
              const cancelled = item.status === 'cancelled';
              const tone = done ? colors.success : cancelled ? colors.textMuted : colors.warning;
              return (
                <Surface key={item.id} elevation="e1" style={{display: 'flex', alignItems: 'center', gap: spacing.md}}>
                  <span style={{
                    width: 36, height: 36, borderRadius: radius.md, flexShrink: 0,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    backgroundColor: tone + '18',
                  }}>
                    <Icon name={item.type === 'park' ? 'arrowDown' : 'arrowUp'} size={16} color={tone} />
                  </span>
                  <span style={{flex: 1, minWidth: 0}}>
                    <Text variant="subhead" as="div" numberOfLines={1}>
                      {item.type === 'park' ? 'Parked' : 'Retrieved'} · {item.carNumber}
                    </Text>
                    <Text variant="caption" tone="muted" as="div" style={{marginTop: 2}}>
                      {formatDate(item.assignedAt ?? item.requestedAt)}{item.slotId ? ` · Slot ${item.slotId}` : ''}
                    </Text>
                  </span>
                  <Text variant="caption" color={tone} style={{fontWeight: 700, flexShrink: 0}}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </Text>
                </Surface>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
