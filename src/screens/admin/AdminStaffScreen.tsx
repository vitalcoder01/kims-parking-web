import React, {useState, useEffect, useCallback} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useDialog} from '../../components/AppDialog';
import {useBackStep} from '../../hooks/useBackStep';
import {adminApi, driversApi} from '../../services/api';
import {Icon, IconName} from '../../components/Icon';
import {useAdminOpsTheme, DarkPill} from './adminDarkTheme';

type Filter = 'all' | 'doctor' | 'staff' | 'valet' | 'driver' | 'admin';
type Role = 'doctor' | 'staff' | 'valet' | 'driver' | 'admin';

interface AdminUser {
  id: number;
  employeeId: string;
  username: string;
  name: string;
  role: Role;
  department?: string;
  cardCode?: string;
  phone?: string;
  driverStatus?: 'available' | 'busy' | 'off';
  linkedDriverId?: number;
  valetStation?: 'gate' | 'lot' | null;
}

const FILTER_TABS: {key: Filter; label: string; icon: IconName}[] = [
  {key: 'all', label: 'All Personnel', icon: 'people'},
  {key: 'doctor', label: 'Doctors', icon: 'user'},
  {key: 'staff', label: 'Staff', icon: 'userCard'},
  {key: 'valet', label: 'Valets', icon: 'key'},
  {key: 'driver', label: 'Drivers', icon: 'car'},
  {key: 'admin', label: 'Admins', icon: 'shield'},
];

const ROLE_OPTIONS: {key: Role; label: string; icon: IconName; desc: string}[] = [
  {key: 'doctor', label: 'Doctor', icon: 'user', desc: 'Hospital physician with priority valet pass'},
  {key: 'staff', label: 'Staff', icon: 'userCard', desc: 'Clinical & administrative hospital personnel'},
  {key: 'valet', label: 'Valet', icon: 'key', desc: 'Station desk operator (Gate or Lot)'},
  {key: 'driver', label: 'Driver', icon: 'car', desc: 'Runner executing parking & retrieval trips'},
  {key: 'admin', label: 'Admin', icon: 'shield', desc: 'Full dispatch & personnel system oversight'},
];

const STATION_OPTIONS: {key: 'unassigned' | 'gate' | 'lot'; label: string; icon: IconName; desc: string}[] = [
  {key: 'unassigned', label: 'Unassigned', icon: 'help', desc: 'Shared pool — works any station'},
  {key: 'gate', label: 'Gate Station', icon: 'car', desc: 'Curbside intake, vehicle inspection & key collection'},
  {key: 'lot', label: 'Lot Station', icon: 'key', desc: 'Parking bay confirmation & retrieval dispatch'},
];

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const roleLabel = (r: Role) => ({doctor: 'Doctor', staff: 'Staff', valet: 'Valet', driver: 'Driver', admin: 'Admin'}[r]);

export function AdminStaffScreen({initialFilter = 'all', initialQuery = ''}: {initialFilter?: Filter; initialQuery?: string} = {}) {
  const dark = useAdminOpsTheme();
  const dialog = useDialog();
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [query, setQuery] = useState(initialQuery);

  useEffect(() => {
    if (initialQuery !== undefined) setQuery(initialQuery);
  }, [initialQuery]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  const [name, setName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [password, setPassword] = useState(genPassword());
  const [department, setDepartment] = useState('');
  const [cardCode, setCardCode] = useState('');
  const [phone, setPhone] = useState('');
  const [valetStation, setValetStation] = useState<'gate' | 'lot' | ''>('');
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [togglingShift, setTogglingShift] = useState(false);
  const [forcingFree, setForcingFree] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const list = await adminApi.listUsers();
      setUsers(list);
    } catch {
      // Tolerate transient fetch failure by keeping existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const resetForm = () => {
    setName(''); setEmployeeId(''); setRole('staff'); setPassword(genPassword());
    setDepartment(''); setCardCode(''); setPhone(''); setValetStation('');
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingUser(null);
    resetForm();
  };

  useBackStep(showAdd, closeForm);

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setName(u.name);
    setEmployeeId(u.employeeId);
    setRole(u.role);
    setDepartment(u.department ?? '');
    setCardCode(u.cardCode ?? '');
    setPhone(u.phone ?? '');
    setValetStation(u.valetStation ?? '');
    setShowAdd(true);
  };

  const handleCreate = async () => {
    if (!name.trim() || !employeeId.trim() || !password.trim()) return;
    if (password.length < 8 || password.length > 64) {
      dialog.alert('Password must be 8–64 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const created: any = await adminApi.createUser({
        employeeId: employeeId.trim().toUpperCase(),
        name: name.trim(),
        role,
        password: password.trim(),
        department: department.trim() || undefined,
        cardCode: (role === 'doctor' || role === 'staff') && cardCode.trim() ? cardCode.trim() : undefined,
        phone: role === 'driver' && phone.trim() ? phone.trim() : undefined,
        valetStation: role === 'valet' && valetStation ? valetStation : undefined,
      });
      dialog.alert(`Username: ${created.username}\nPassword: ${password.trim()}\n\nShare these credentials securely — they won't be shown again here.`, {title: `${name.trim()} can now sign in`, tone: 'success'});
      closeForm();
      loadUsers();
    } catch (err: any) {
      dialog.alert(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingUser || !name.trim()) return;
    setSubmitting(true);
    try {
      await adminApi.updateUser(editingUser.id, {
        name: name.trim(),
        role,
        department: department.trim(),
        cardCode: (role === 'doctor' || role === 'staff') ? cardCode.trim() : '',
        phone: role === 'driver' ? phone.trim() : '',
        valetStation: role === 'valet' ? (valetStation || null) : null,
      });
      closeForm();
      loadUsers();
    } catch (err: any) {
      dialog.alert(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!editingUser || resettingPassword) return;
    const newPassword = genPassword();
    const ok = await dialog.confirm({
      title: 'Reset Password?',
      message: `${editingUser.name}'s password will be changed to:\n\n${newPassword}\n\nShare this with them directly.`,
      confirmText: 'Reset Now', destructive: true,
    });
    if (!ok) return;
    setResettingPassword(true);
    try {
      await adminApi.resetPassword(editingUser.id, newPassword);
      dialog.alert(`New password: ${newPassword}`, {tone: 'success', title: 'Password Reset'});
    } catch (err: any) {
      dialog.alert(err.message || 'Something went wrong');
    } finally {
      setResettingPassword(false);
    }
  };

  const handleToggleDriverShift = async () => {
    if (!editingUser?.linkedDriverId || togglingShift || editingUser.driverStatus === 'busy') return;
    const next = editingUser.driverStatus === 'available' ? 'off' : 'available';
    setTogglingShift(true);
    try {
      await driversApi.setStatus(editingUser.linkedDriverId, next);
      setEditingUser(prev => (prev ? {...prev, driverStatus: next} : prev));
      loadUsers();
    } catch (err: any) {
      dialog.alert(err.message || 'Could not change shift status');
    } finally {
      setTogglingShift(false);
    }
  };

  const handleForceFreeDriver = async () => {
    if (!editingUser?.linkedDriverId || forcingFree) return;
    const ok = await dialog.confirm({
      title: 'Force Free This Driver?',
      message: `${editingUser.name} will be marked available immediately, and whatever job is currently stuck on them will be cancelled. Only do this if you're sure that job is genuinely dead — this can't be undone.`,
      confirmText: 'Force Free', destructive: true,
    });
    if (!ok) return;
    setForcingFree(true);
    try {
      await driversApi.forceFree(editingUser.linkedDriverId);
      setEditingUser(prev => (prev ? {...prev, driverStatus: 'available'} : prev));
      loadUsers();
    } catch (err: any) {
      dialog.alert(err.message || 'Could not free this driver');
    } finally {
      setForcingFree(false);
    }
  };

  const handleDelete = async () => {
    if (!editingUser || deleting) return;
    const ok = await dialog.confirm({
      title: 'Delete Account?',
      message: `This permanently removes ${editingUser.name}'s login (${editingUser.username}). This can't be undone.`,
      confirmText: 'Delete', destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await adminApi.deleteUser(editingUser.id);
      closeForm();
      loadUsers();
    } catch (err: any) {
      dialog.alert(err.message || 'Something went wrong');
    } finally {
      setDeleting(false);
    }
  };

  const driverStaff = users.filter(u => u.role === 'driver');
  const q = query.trim().toLowerCase();
  const filtered = (filter === 'all' ? users : users.filter(u => u.role === filter))
    .filter(u => !q || u.name.toLowerCase().includes(q) || u.username.toLowerCase().includes(q) || u.employeeId.toLowerCase().includes(q));
  const onDuty = driverStaff.filter(d => d.driverStatus === 'available').length;
  const onTask = driverStaff.filter(d => d.driverStatus === 'busy').length;
  const offDuty = driverStaff.filter(d => d.driverStatus === 'off').length;

  const statusBadge = (u: AdminUser) => {
    if (u.role !== 'driver') return null;
    if (u.driverStatus === 'busy') return <DarkPill label="ON TASK" color={dark.warning} />;
    if (u.driverStatus === 'available') return <DarkPill label="READY" color={dark.success} />;
    return <DarkPill label="OFF DUTY" color={dark.textMuted} />;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    border: `1px solid ${dark.border}`,
    borderRadius: 12,
    padding: '0 14px',
    height: 46,
    fontSize: 14,
    fontWeight: 600,
    backgroundColor: dark.surface,
    color: dark.textPrimary,
    boxSizing: 'border-box',
    outline: 'none',
  };

  const fieldLabel: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 18,
    color: dark.textMuted,
    textTransform: 'uppercase',
  };

  // ── Add/Edit Staff Form ──────────────────────────────────────────────
  if (showAdd) {
    const isEdit = !!editingUser;
    const usernamePrefix: Record<Role, string> = {doctor: 'dr_', staff: '', valet: 'valet_', driver: 'driver_', admin: ''};
    const slug = (name.trim() || 'full name').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const previewUsername = `${usernamePrefix[role]}${slug || 'full_name'}`;
    const canSubmit = name.trim() && employeeId.trim() && (isEdit || password.trim()) && !submitting;

    return (
      <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: '16px 14px 48px'}}>
        {/* Form Workstation Header */}
        <div style={{
          padding: '12px 16px',
          borderRadius: 16,
          backgroundColor: dark.card,
          border: `1px solid ${dark.border}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}>
          <PressableScale
            onClick={closeForm}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              borderRadius: 10,
              border: `1px solid ${dark.border}`,
              padding: '7px 12px',
              backgroundColor: dark.surface,
            }}>
            <Icon name="back" size={14} color={dark.textPrimary} />
            <span style={{fontSize: 12, fontWeight: 700, color: dark.textPrimary}}>Back</span>
          </PressableScale>

          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: 14, fontWeight: 900, color: dark.textPrimary, letterSpacing: -0.2}}>
              {isEdit ? 'EDIT PERSONNEL RECORD' : 'REGISTER NEW PERSONNEL'}
            </div>
            <div style={{fontSize: 10.5, fontWeight: 600, color: dark.textMuted}}>
              {isEdit ? `Modifying credentials for ${editingUser.name}` : 'Staff roster provisioning'}
            </div>
          </div>

          <div style={{width: 60}} />
        </div>

        {/* Form Body Card */}
        <div style={{
          padding: '20px 18px',
          borderRadius: 12,
          backgroundColor: dark.card,
          border: `1px solid ${dark.border}`,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
        }}>
          {/* Role Selection */}
          <div style={fieldLabel}>OPERATIONAL ROLE {isEdit ? '(TRANSFER)' : ''}</div>
          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8}}>
            {ROLE_OPTIONS.map(r => {
              const on = role === r.key;
              return (
                <PressableScale
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    border: `1px solid ${on ? dark.accent : dark.border}`,
                    borderRadius: 12,
                    padding: '10px 12px',
                    backgroundColor: on ? `${dark.accent}1F` : dark.surface,
                    cursor: 'pointer',
                  }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: on ? dark.accent : `${dark.border}44`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon name={r.icon} size={15} color={on ? '#fff' : dark.textMuted} />
                  </div>
                  <div>
                    <div style={{fontSize: 12.5, fontWeight: 800, color: on ? dark.accent : dark.textPrimary}}>
                      {r.label}
                    </div>
                  </div>
                </PressableScale>
              );
            })}
          </div>

          {/* Full Name */}
          <div style={fieldLabel}>FULL LEGAL / DISPLAY NAME</div>
          <input
            style={inputStyle}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Dr. Kavita Reddy"
          />

          {/* Username Identity */}
          {isEdit && editingUser ? (
            <div style={{
              borderRadius: 12,
              border: `1px solid ${dark.accent}33`,
              padding: '12px 14px',
              marginTop: 14,
              backgroundColor: `${dark.accent}0F`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{fontSize: 9.5, fontWeight: 800, letterSpacing: 0.8, color: dark.textMuted}}>
                  SYSTEM LOGIN USERNAME
                </div>
                <div style={{fontSize: 14, fontWeight: 900, marginTop: 2, color: dark.accent, fontFamily: 'monospace'}}>
                  @{editingUser.username}
                </div>
              </div>
              <DarkPill label={editingUser.role.toUpperCase()} color={dark.accent} />
            </div>
          ) : (
            <div style={{
              fontSize: 11,
              marginTop: 8,
              color: dark.textMuted,
              lineHeight: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <Icon name="info" size={13} color={dark.textMuted} />
              <span>Username will auto-provision as: <strong style={{color: dark.textPrimary, fontFamily: 'monospace'}}>@{previewUsername}</strong></span>
            </div>
          )}

          {/* Employee ID */}
          <div style={fieldLabel}>EMPLOYEE ID {isEdit ? '(PERMANENT RECORD)' : '— INTERNAL REFERENCE'}</div>
          <input
            style={{
              ...inputStyle,
              backgroundColor: isEdit ? dark.bg : dark.surface,
              color: isEdit ? dark.textMuted : dark.textPrimary,
              fontFamily: 'monospace',
              letterSpacing: 1,
            }}
            value={employeeId}
            onChange={e => setEmployeeId(e.target.value.toUpperCase())}
            placeholder="e.g. DOC010"
            disabled={isEdit}
          />

          {/* Doctor / Staff Specific Attributes */}
          {(role === 'doctor' || role === 'staff') && (
            <>
              <div style={fieldLabel}>HOSPITAL DEPARTMENT (OPTIONAL)</div>
              <input
                style={inputStyle}
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Cardiology / Oncology / Outpatient"
              />

              <div style={fieldLabel}>PHYSICAL VALET PASS CODE (3 DIGITS)</div>
              <input
                style={{...inputStyle, fontFamily: 'monospace', letterSpacing: 2}}
                value={cardCode}
                onChange={e => setCardCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                placeholder="e.g. 472"
                inputMode="numeric"
              />
            </>
          )}

          {/* Driver Specific Attributes */}
          {role === 'driver' && (
            <>
              <div style={fieldLabel}>RUNNER MOBILE CONTACT</div>
              <input
                style={{...inputStyle, fontFamily: 'monospace'}}
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="10-digit mobile number"
                inputMode="numeric"
              />
            </>
          )}

          {/* Driver Shift Management (When Editing) */}
          {isEdit && role === 'driver' && editingUser?.linkedDriverId && (
            <>
              <div style={fieldLabel}>RUNNER SHIFT TELEMETRY</div>
              {editingUser.driverStatus === 'busy' ? (
                <>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 12,
                    padding: '12px 14px',
                    backgroundColor: `${dark.warning}14`,
                    border: `1px solid ${dark.warning}33`,
                  }}>
                    <Icon name="bolt" size={16} color={dark.warning} />
                    <span style={{fontSize: 12.5, fontWeight: 700, color: dark.warning}}>
                      Driver is executing an active trip. Shift cannot be changed until the trip completes.
                    </span>
                  </div>

                  <PressableScale
                    onClick={handleForceFreeDriver}
                    disabled={forcingFree}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      borderRadius: 12,
                      padding: '12px 14px',
                      marginTop: 10,
                      border: `1px solid ${dark.danger}44`,
                      backgroundColor: `${dark.danger}12`,
                      opacity: forcingFree ? 0.6 : 1,
                    }}>
                    <Icon name="alert" size={16} color={dark.danger} />
                    <span style={{flex: 1, fontSize: 12.5, fontWeight: 800, color: dark.danger}}>
                      {forcingFree ? 'Cancelling task...' : 'Trip Stuck? Force-free runner'}
                    </span>
                  </PressableScale>
                </>
              ) : (
                <PressableScale
                  onClick={handleToggleDriverShift}
                  disabled={togglingShift}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 12,
                    padding: '12px 14px',
                    border: `1px solid ${editingUser.driverStatus === 'available' ? `${dark.success}55` : dark.border}`,
                    backgroundColor: editingUser.driverStatus === 'available' ? `${dark.success}14` : dark.surface,
                    opacity: togglingShift ? 0.6 : 1,
                  }}>
                  <div style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: editingUser.driverStatus === 'available' ? dark.success : dark.divider,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon
                      name={editingUser.driverStatus === 'available' ? 'check' : 'clock'}
                      size={13}
                      color="#fff"
                    />
                  </div>
                  <span style={{flex: 1, fontSize: 13, fontWeight: 800, color: dark.textPrimary}}>
                    {editingUser.driverStatus === 'available' ? 'ON SHIFT • READY FOR JOBS' : 'OFF SHIFT • INACTIVE'}
                  </span>
                  <span style={{fontSize: 11.5, fontWeight: 800, color: dark.accent}}>
                    {togglingShift ? 'Updating...' : editingUser.driverStatus === 'available' ? 'Tap to go off shift' : 'Tap to go on shift'}
                  </span>
                </PressableScale>
              )}
            </>
          )}

          {/* Valet Station Assignment */}
          {role === 'valet' && (
            <>
              <div style={fieldLabel}>PHYSICAL VALET WORKSTATION</div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
                {STATION_OPTIONS.map(s => {
                  const on = (valetStation || 'unassigned') === s.key;
                  return (
                    <PressableScale
                      key={s.key}
                      onClick={() => setValetStation(s.key === 'unassigned' ? '' : s.key)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        border: `1px solid ${on ? dark.accent : dark.border}`,
                        borderRadius: 12,
                        padding: '10px 14px',
                        backgroundColor: on ? `${dark.accent}14` : dark.surface,
                        cursor: 'pointer',
                      }}>
                      <Icon name={s.icon} size={16} color={on ? dark.accent : dark.textMuted} />
                      <div style={{flex: 1}}>
                        <div style={{fontSize: 13, fontWeight: 800, color: on ? dark.accent : dark.textPrimary}}>
                          {s.label}
                        </div>
                        <div style={{fontSize: 10.5, fontWeight: 500, color: dark.textMuted, marginTop: 1}}>
                          {s.desc}
                        </div>
                      </div>
                      {on && <Icon name="check" size={16} color={dark.accent} />}
                    </PressableScale>
                  );
                })}
              </div>
            </>
          )}

          {/* Password (for new creations) */}
          {!isEdit && (
            <>
              <div style={fieldLabel}>TEMPORARY SECURITY CREDENTIAL</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                border: `1px solid ${dark.border}`,
                borderRadius: 12,
                padding: '0 14px',
                height: 46,
                backgroundColor: dark.surface,
              }}>
                <input
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 14,
                    fontWeight: 700,
                    color: dark.textPrimary,
                    fontFamily: 'monospace',
                  }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <PressableScale
                  onClick={() => setPassword(genPassword())}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 8,
                    backgroundColor: `${dark.accent}18`,
                  }}>
                  <span style={{fontSize: 11, fontWeight: 800, color: dark.accent}}>Regenerate</span>
                </PressableScale>
              </div>
              <div style={{
                fontSize: 11,
                marginTop: 6,
                color: password.length < 8 ? dark.danger : dark.textMuted,
              }}>
                {password.length < 8
                  ? '⚠ Password must be at least 8 characters long.'
                  : 'Share this temporary password with the staff member securely.'}
              </div>
            </>
          )}

          {/* Primary Action Button */}
          <PressableScale
            style={{
              width: '100%',
              borderRadius: 12,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: 24,
              backgroundColor: dark.accent,
              opacity: canSubmit ? 1 : 0.45,
              boxShadow: `0 4px 14px ${dark.accent}33`,
            }}
            onClick={isEdit ? handleSaveEdit : handleCreate}
            disabled={!canSubmit}
          >
            {submitting ? (
              <span className="spinner" style={{width: 18, height: 18, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} />
            ) : (
              <span style={{color: '#fff', fontSize: 14, fontWeight: 800}}>
                {isEdit ? 'SAVE MODIFICATIONS' : 'PROVISION ACCOUNT'}
              </span>
            )}
          </PressableScale>

          {/* Admin Management Actions (for existing staff) */}
          {isEdit && (
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12}}>
              <PressableScale
                style={{
                  borderRadius: 12,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${dark.border}`,
                  backgroundColor: dark.surface,
                  opacity: resettingPassword ? 0.6 : 1,
                }}
                disabled={resettingPassword || deleting}
                onClick={handleResetPassword}>
                {resettingPassword ? (
                  <span className="spinner" style={{width: 14, height: 14, borderColor: dark.border, borderTopColor: dark.textPrimary}} />
                ) : (
                  <span style={{fontSize: 12, fontWeight: 700, color: dark.textPrimary}}>Reset Password</span>
                )}
              </PressableScale>

              <PressableScale
                style={{
                  borderRadius: 12,
                  height: 42,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${dark.danger}40`,
                  backgroundColor: `${dark.danger}10`,
                  opacity: deleting ? 0.6 : 1,
                }}
                disabled={deleting || resettingPassword}
                onClick={handleDelete}>
                {deleting ? (
                  <span className="spinner" style={{width: 14, height: 14, borderColor: dark.danger, borderTopColor: dark.danger}} />
                ) : (
                  <span style={{fontSize: 12, fontWeight: 700, color: dark.danger}}>Delete Account</span>
                )}
              </PressableScale>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Staff Roster List View ─────────────────────────────────────────────
  return (
    <div className="screen-scroll" style={{backgroundColor: dark.bg, padding: '16px 14px 48px'}}>
      {/* Workstation Header Bar */}
      <div style={{
        padding: '14px 16px',
        borderRadius: 12,
        backgroundColor: dark.card,
        border: `1px solid ${dark.border}`,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
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
            <Icon name="people" size={19} color={dark.accent} />
          </div>
          <div style={{minWidth: 0}}>
            <div style={{display: 'flex', alignItems: 'center', gap: 6}}>
              <span style={{fontSize: 13, fontWeight: 900, color: dark.textPrimary, letterSpacing: -0.2, textTransform: 'uppercase'}}>
                Staff Roster Directory
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                color: dark.accent,
                padding: '2px 7px',
                borderRadius: 999,
                backgroundColor: `${dark.accent}14`,
                border: `1px solid ${dark.accent}30`,
              }}>
                {filtered.length} ACTIVE
              </span>
            </div>
            <div style={{fontSize: 10.5, fontWeight: 600, color: dark.textMuted, marginTop: 1}}>
              KIMS Hospital Operational Personnel
            </div>
          </div>
        </div>

        <PressableScale
          onClick={() => setShowAdd(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 14px',
            borderRadius: 10,
            backgroundColor: dark.accent,
            boxShadow: `0 3px 12px ${dark.accent}33`,
            flexShrink: 0,
          }}>
          <Icon name="plus" size={14} color="#fff" />
          <span style={{color: '#fff', fontSize: 12, fontWeight: 800}}>Add Staff</span>
        </PressableScale>
      </div>

      {/* Driver Availability Strip (3 Metric Tiles) */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12}}>
        {[
          {n: String(onDuty), l: 'Drivers Ready', c: dark.success, icon: 'check' as IconName},
          {n: String(onTask), l: 'On Task', c: dark.warning, icon: 'bolt' as IconName},
          {n: String(offDuty), l: 'Off Duty', c: dark.textMuted, icon: 'clock' as IconName},
        ].map(st => (
          <div
            key={st.l}
            style={{
              padding: '12px 10px',
              borderRadius: 10,
              backgroundColor: dark.card,
              border: `1px solid ${dark.border}`,
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
              textAlign: 'center',
            }}>
            <div style={{
              fontSize: 20,
              fontWeight: 900,
              color: dark.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.5,
            }}>
              {st.n}
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              marginTop: 3,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: st.c,
                boxShadow: `0 0 6px ${st.c}`,
              }} />
              <span style={{fontSize: 10, fontWeight: 700, color: dark.textMuted, whiteSpace: 'nowrap'}}>
                {st.l}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Search Input Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderRadius: 12,
        border: `1px solid ${dark.border}`,
        padding: '0 12px',
        height: 44,
        marginBottom: 10,
        backgroundColor: dark.card,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
      }}>
        <Icon name="search" size={16} color={dark.textMuted} />
        <input
          style={{
            flex: 1,
            fontSize: 13.5,
            fontWeight: 600,
            padding: 0,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: dark.textPrimary,
          }}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search staff name, username, or ID..."
        />
        {!!query && (
          <PressableScale onClick={() => setQuery('')} style={{background: 'transparent', border: 'none', padding: 4}}>
            <Icon name="close" size={14} color={dark.textMuted} />
          </PressableScale>
        )}
      </div>

      {/* Role Filter Tabs Ribbon */}
      <div className="hscroll" style={{gap: 6, paddingBottom: 10}}>
        {FILTER_TABS.map(tab => {
          const on = filter === tab.key;
          return (
            <PressableScale
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '7px 13px',
                borderRadius: 999,
                border: `1px solid ${on ? dark.accent : dark.border}`,
                backgroundColor: on ? dark.accent : dark.card,
                boxShadow: on ? `0 2px 8px ${dark.accent}33` : 'none',
              }}>
              <Icon name={tab.icon} size={13} color={on ? '#fff' : dark.textMuted} />
              <span style={{fontSize: 11.5, fontWeight: 800, color: on ? '#fff' : dark.textSecondary}}>
                {tab.label}
              </span>
            </PressableScale>
          );
        })}
      </div>

      {/* Roster Listing */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
          padding: '48px 0',
        }}>
          <span className="spinner" style={{width: 28, height: 28, borderColor: dark.border, borderTopColor: dark.accent}} />
          <span style={{fontSize: 12, fontWeight: 700, color: dark.textMuted}}>Synchronizing personnel roster...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{
          borderRadius: 16,
          border: `1px dashed ${dark.border}`,
          padding: '36px 20px',
          textAlign: 'center',
          backgroundColor: dark.card,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: `${dark.border}44`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 10px',
          }}>
            <Icon name="people" size={20} color={dark.textMuted} />
          </div>
          <div style={{fontSize: 13, fontWeight: 800, color: dark.textPrimary}}>
            {q ? `No personnel matching "${query.trim()}"` : 'No staff registered in this category'}
          </div>
          <div style={{fontSize: 11, fontWeight: 600, color: dark.textMuted, marginTop: 4}}>
            Try adjusting your search query or role filter.
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: 12,
          border: `1px solid ${dark.border}`,
          backgroundColor: dark.card,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}>
          {filtered.map((u, i) => (
            <PressableScale
              key={u.id}
              onClick={() => openEdit(u)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '13px 14px',
                borderBottom: i === filtered.length - 1 ? 'none' : `1px solid ${dark.divider}`,
                cursor: 'pointer',
              }}>
              {/* Monogram Avatar */}
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                backgroundColor: `${dark.accent}14`,
                border: `1px solid ${dark.accent}24`,
              }}>
                <span style={{fontSize: 13, fontWeight: 900, color: dark.accent}}>
                  {u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              </div>

              {/* Staff Details */}
              <div style={{flex: 1, textAlign: 'left', minWidth: 0}}>
                <div style={{display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap'}}>
                  <span style={{fontSize: 13.5, fontWeight: 800, color: dark.textPrimary}}>
                    {u.name}
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: dark.textMuted,
                    fontFamily: 'monospace',
                  }}>
                    @{u.username}
                  </span>
                </div>

                <div style={{display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap'}}>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '1px 6px',
                    borderRadius: 4,
                    backgroundColor: `${dark.border}44`,
                    color: dark.textSecondary,
                    fontFamily: 'monospace',
                  }}>
                    {u.employeeId}
                  </span>
                  <span style={{fontSize: 11, fontWeight: 600, color: dark.textMuted}}>
                    {roleLabel(u.role)}
                  </span>
                  {u.valetStation && (
                    <span style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      color: dark.accent2,
                      padding: '1px 5px',
                      borderRadius: 4,
                      backgroundColor: `${dark.accent2}18`,
                    }}>
                      {u.valetStation.toUpperCase()} STATION
                    </span>
                  )}
                  {!!u.department && (
                    <span style={{fontSize: 11, color: dark.textMuted}}>
                      · {u.department}
                    </span>
                  )}
                </div>
              </div>

              {/* Status and Action affordance */}
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0}}>
                {statusBadge(u)}
                <Icon name="arrowRight" size={13} color={dark.textMuted} />
              </div>
            </PressableScale>
          ))}
        </div>
      )}
    </div>
  );
}
