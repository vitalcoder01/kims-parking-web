import React, { useState } from 'react';
import type { ParkingTask, ParkingSlot, Driver } from '../context/AppStateContext';
import { useAppState } from '../context/AppStateContext';
import { useTheme } from '../context/ThemeContext';
import { Icon } from './Icon';
import { getTaskStaleInfo } from '../utils/staleTask';
import { useBackStep } from '../hooks/useBackStep';

interface Props {
  task: ParkingTask | null;
  visible?: boolean;
  onClose: () => void;
  freeSlots?: ParkingSlot[];
  drivers?: Driver[];
}

type TabType = 'void' | 'park' | 'reassign';

const QUICK_REASONS = [
  'Vehicle was parked manually by customer/doctor',
  'Duplicate or test ticket entry',
  'Runner device offline / abandoned run',
  'Customer cancelled & drove away',
  'Incorrect vehicle registration entered',
];

export function TaskResolutionModal({ task, visible = true, onClose, freeSlots, drivers }: Props) {
  const { colors, isDark } = useTheme();
  const { forceResolveTask, assignDriver, drivers: stateDrivers, slots: stateSlots } = useAppState();

  const availableDrivers = drivers ?? stateDrivers;
  const freeSlotsList = freeSlots ?? stateSlots.filter(s => s.status === 'free');

  const [activeTab, setActiveTab] = useState<TabType>('void');
  const [selectedReason, setSelectedReason] = useState(QUICK_REASONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [targetSlotId, setTargetSlotId] = useState(task?.slotId || freeSlotsList[0]?.id || '');
  const [selectedDriverId, setSelectedDriverId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useBackStep(visible, onClose);

  if (!visible || !task) return null;

  const staleInfo = getTaskStaleInfo(task);

  const handleVoidTask = async () => {
    setBusy(true);
    setErrorMessage('');
    try {
      const reason = customReason.trim() || selectedReason;
      await forceResolveTask(task.id, {
        action: 'void_cancel',
        reason,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to void task. Please check server connection.');
    } finally {
      setBusy(false);
    }
  };

  const handleCompletePark = async () => {
    if (!targetSlotId.trim()) {
      setErrorMessage('Please specify a parking bay ID.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      await forceResolveTask(task.id, {
        action: 'complete_parked',
        slotId: targetSlotId.trim().toUpperCase(),
        reason: 'operator_force_parked',
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to complete parking session.');
    } finally {
      setBusy(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedDriverId) {
      setErrorMessage('Please select a driver to reassign.');
      return;
    }
    setBusy(true);
    setErrorMessage('');
    try {
      await assignDriver(task.id, selectedDriverId);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reassign runner.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          borderRadius: 12,
          backgroundColor: isDark ? '#111827' : '#FFFFFF',
          border: `1px solid ${isDark ? '#374151' : '#E2E8F0'}`,
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: `1px solid ${isDark ? '#1F2937' : '#E2E8F0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: isDark ? '#1A2234' : '#F8FAFC',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: colors.textPrimary }}>
                Resolve Stuck Job
              </span>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  padding: '2px 7px',
                  borderRadius: 4,
                  backgroundColor: staleInfo.isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: staleInfo.isCritical ? '#EF4444' : '#D97706',
                  border: `1px solid ${staleInfo.isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                }}
              >
                {staleInfo.elapsedLabel || 'Active Job'}
              </span>
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
              Manual operational override for abandoned or stuck runs
            </div>
          </div>

          <button
            type="button"
            className="pressable"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: colors.textMuted,
              padding: 4,
            }}
          >
            <Icon name="close" size={18} color={colors.textMuted} />
          </button>
        </div>

        {/* Vehicle & Runner Summary Card */}
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: isDark ? '#131B2E' : '#F1F5F9',
            borderBottom: `1px solid ${isDark ? '#1F2937' : '#E2E8F0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 900, fontFamily: 'monospace', color: colors.textPrimary }}>
              {task.carNumber}
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: colors.textSecondary, marginTop: 1 }}>
              {task.doctorName || 'Guest Visitor'} &bull; Status: <strong style={{ color: colors.primary }}>{task.status.toUpperCase()}</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: colors.textMuted }}>Assigned Runner</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: colors.textPrimary }}>
              {task.driverName || 'No Runner'}
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${isDark ? '#1F2937' : '#E2E8F0'}`,
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
          }}
        >
          <button
            type="button"
            className="pressable"
            onClick={() => { setActiveTab('void'); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '11px 8px',
              border: 'none',
              borderBottom: activeTab === 'void' ? '2.5px solid #EF4444' : '2.5px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'void' ? '#EF4444' : colors.textSecondary,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon name="close" size={14} color={activeTab === 'void' ? '#EF4444' : colors.textMuted} />
            <span>Force Void / Cancel</span>
          </button>

          <button
            type="button"
            className="pressable"
            onClick={() => { setActiveTab('park'); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '11px 8px',
              border: 'none',
              borderBottom: activeTab === 'park' ? '2.5px solid #10B981' : '2.5px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'park' ? '#10B981' : colors.textSecondary,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon name="check" size={14} color={activeTab === 'park' ? '#10B981' : colors.textMuted} />
            <span>Mark Parked in Bay</span>
          </button>

          <button
            type="button"
            className="pressable"
            onClick={() => { setActiveTab('reassign'); setErrorMessage(''); }}
            style={{
              flex: 1,
              padding: '11px 8px',
              border: 'none',
              borderBottom: activeTab === 'reassign' ? '2.5px solid #3B82F6' : '2.5px solid transparent',
              backgroundColor: 'transparent',
              color: activeTab === 'reassign' ? '#3B82F6' : colors.textSecondary,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <Icon name="people" size={14} color={activeTab === 'reassign' ? '#3B82F6' : colors.textMuted} />
            <span>Reassign</span>
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: 20, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {errorMessage && (
            <div
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#EF4444',
                fontSize: 12.5,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Icon name="alert" size={15} color="#EF4444" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: FORCE VOID */}
          {activeTab === 'void' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: '18px' }}>
                Voiding permanently cancels this job, releases the runner to available standby, frees any reserved bay, and cleans the record from all live dispatch screens.
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                  Select Reason for Override:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {QUICK_REASONS.map(r => (
                    <label
                      key={r}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        backgroundColor: selectedReason === r ? (isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2') : (isDark ? '#1F2937' : '#F8FAFC'),
                        border: `1px solid ${selectedReason === r ? 'rgba(239,68,68,0.35)' : (isDark ? '#374151' : '#E2E8F0')}`,
                        cursor: 'pointer',
                        fontSize: 12.5,
                        fontWeight: selectedReason === r ? 700 : 500,
                        color: selectedReason === r ? '#EF4444' : colors.textPrimary,
                      }}
                    >
                      <input
                        type="radio"
                        name="voidReason"
                        checked={selectedReason === r}
                        onChange={() => setSelectedReason(r)}
                        style={{ accentColor: '#EF4444' }}
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </div>
              </div>

              <input
                type="text"
                placeholder="Or type specific reason (optional)..."
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                style={{
                  height: 38,
                  borderRadius: 6,
                  padding: '0 12px',
                  fontSize: 12.5,
                  backgroundColor: isDark ? '#1A2234' : '#FFFFFF',
                  border: `1px solid ${isDark ? '#374151' : '#CBD5E1'}`,
                  color: colors.textPrimary,
                  outline: 'none',
                }}
              />

              <button
                type="button"
                className="pressable"
                onClick={handleVoidTask}
                disabled={busy}
                style={{
                  height: 42,
                  borderRadius: 8,
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (
                  <>
                    <Icon name="close" size={16} color="#FFFFFF" />
                    <span>Void &amp; Clear Task Now</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 2: COMPLETE PARK */}
          {activeTab === 'park' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: '18px' }}>
                Use this if the car has physically arrived at the parking lot and was parked by a runner or doctor, but the completion step never registered.
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: colors.textMuted, letterSpacing: 0.5, marginBottom: 8, display: 'block' }}>
                  Target Parking Bay:
                </label>
                <input
                  type="text"
                  placeholder="e.g. B-04"
                  value={targetSlotId}
                  onChange={e => setTargetSlotId(e.target.value.toUpperCase())}
                  style={{
                    width: '100%',
                    height: 42,
                    borderRadius: 6,
                    padding: '0 12px',
                    fontSize: 15,
                    fontWeight: 800,
                    letterSpacing: 0.5,
                    fontFamily: 'monospace',
                    backgroundColor: isDark ? '#1A2234' : '#FFFFFF',
                    border: `1px solid ${isDark ? '#374151' : '#CBD5E1'}`,
                    color: colors.textPrimary,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {freeSlotsList.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textMuted, marginBottom: 6 }}>
                    Quick Available Bays:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {freeSlotsList.slice(0, 8).map(s => (
                      <button
                        key={s.id}
                        type="button"
                        className="pressable"
                        onClick={() => setTargetSlotId(s.id)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 700,
                          backgroundColor: targetSlotId === s.id ? '#10B981' : (isDark ? '#1F2937' : '#F1F5F9'),
                          color: targetSlotId === s.id ? '#FFFFFF' : colors.textPrimary,
                          border: `1px solid ${targetSlotId === s.id ? '#10B981' : (isDark ? '#374151' : '#E2E8F0')}`,
                          cursor: 'pointer',
                        }}
                      >
                        {s.id}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                className="pressable"
                onClick={handleCompletePark}
                disabled={busy || !targetSlotId.trim()}
                style={{
                  height: 42,
                  borderRadius: 8,
                  backgroundColor: '#059669',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy || !targetSlotId.trim() ? 'default' : 'pointer',
                  opacity: targetSlotId.trim() ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (
                  <>
                    <Icon name="check" size={16} color="#FFFFFF" />
                    <span>Confirm Parked in {targetSlotId || 'Bay'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* TAB 3: REASSIGN RUNNER */}
          {activeTab === 'reassign' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 12.5, color: colors.textSecondary, lineHeight: '18px' }}>
                If the currently assigned runner is unresponsive or their phone is offline, reassign this vehicle to another active runner on the roster.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
                {availableDrivers.filter(d => d.status !== 'off').length === 0 ? (
                  <div style={{ padding: 16, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>
                    No other runners currently on shift.
                  </div>
                ) : (
                  availableDrivers
                    .filter(d => d.status !== 'off')
                    .map(d => {
                      const isSelected = selectedDriverId === d.id;
                      const isFree = d.status === 'available';
                      return (
                        <div
                          key={d.id}
                          className="pressable"
                          onClick={() => setSelectedDriverId(d.id)}
                          style={{
                            padding: '10px 12px',
                            borderRadius: 8,
                            backgroundColor: isSelected ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF') : (isDark ? '#1F2937' : '#F8FAFC'),
                            border: `1px solid ${isSelected ? '#3B82F6' : (isDark ? '#374151' : '#E2E8F0')}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: isFree ? '#10B981' : '#F59E0B',
                              }}
                            />
                            <span style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                              {d.name}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: isFree ? '#10B981' : '#D97706', fontWeight: 600 }}>
                            {isFree ? 'Ready / Idle' : 'Busy on Run'}
                          </span>
                        </div>
                      );
                    })
                )}
              </div>

              <button
                type="button"
                className="pressable"
                onClick={handleReassign}
                disabled={busy || !selectedDriverId}
                style={{
                  height: 42,
                  borderRadius: 8,
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 800,
                  cursor: busy || !selectedDriverId ? 'default' : 'pointer',
                  opacity: selectedDriverId ? 1 : 0.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {busy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : (
                  <>
                    <Icon name="people" size={16} color="#FFFFFF" />
                    <span>Reassign Vehicle Run</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
