import React, {useState, useEffect, useCallback} from 'react';
import {PressableScale} from '../../components/PressableScale';
import {useDialog} from '../../components/AppDialog';
import {useBackStep} from '../../hooks/useBackStep';
import {useTheme} from '../../context/ThemeContext';
import {adminApi} from '../../services/api';
import {Badge} from '../../components/Badge';
import {Icon, IconName} from '../../components/Icon';
import {spacing, radius, typography} from '../../theme';

// Direct port of the mobile app's AdminStaffScreen.
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
}

const FILTER_TABS: {key: Filter; label: string}[] = [
  {key: 'all', label: 'All'},
  {key: 'doctor', label: 'Doctors'},
  {key: 'staff', label: 'Staff'},
  {key: 'valet', label: 'Valets'},
  {key: 'driver', label: 'Drivers'},
  {key: 'admin', label: 'Admins'},
];

const ROLE_OPTIONS: {key: Role; label: string; icon: IconName}[] = [
  {key: 'doctor', label: 'Doctor', icon: 'user'},
  {key: 'staff', label: 'Staff', icon: 'userCard'},
  {key: 'valet', label: 'Valet', icon: 'key'},
  {key: 'driver', label: 'Driver', icon: 'car'},
  {key: 'admin', label: 'Admin', icon: 'shield'},
];

function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

const roleLabel = (r: Role) => ({doctor: 'Doctor', staff: 'Staff', valet: 'Valet', driver: 'Driver', admin: 'Admin'}[r]);

export function AdminStaffScreen() {
  const {colors} = useTheme();
  const dialog = useDialog();
  const [filter, setFilter] = useState<Filter>('all');
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
  const [submitting, setSubmitting] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const list = await adminApi.listUsers();
      setUsers(list);
    } catch {
      // Tolerate a failed fetch by keeping the last good data rather than
      // showing an intrusive error for what's likely a transient blip.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const resetForm = () => {
    setName(''); setEmployeeId(''); setRole('staff'); setPassword(genPassword());
    setDepartment(''); setCardCode(''); setPhone('');
  };

  const closeForm = () => {
    setShowAdd(false);
    setEditingUser(null);
    resetForm();
  };
  // Browser/PWA back gesture — the Add/Edit Staff form (below) is a plain
  // conditional full-screen replace, not a real route.
  useBackStep(showAdd, closeForm);

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setName(u.name);
    setEmployeeId(u.employeeId);
    setRole(u.role);
    setDepartment(u.department ?? '');
    setCardCode(u.cardCode ?? '');
    setPhone(u.phone ?? '');
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
  const filtered = filter === 'all' ? users : users.filter(u => u.role === filter);
  const onDuty = driverStaff.filter(d => d.driverStatus === 'available').length;
  const onTask = driverStaff.filter(d => d.driverStatus === 'busy').length;
  const offDuty = driverStaff.filter(d => d.driverStatus === 'off').length;

  const statusBadge = (u: AdminUser) => {
    if (u.role !== 'driver') return null;
    if (u.driverStatus === 'busy') return <Badge label="On Task" variant="warning" dot />;
    if (u.driverStatus === 'available') return <Badge label="Ready" variant="success" dot />;
    return <Badge label="Off Duty" variant="muted" />;
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', border: `1.5px solid ${colors.border}`, borderRadius: 12, padding: '0 14px',
    height: 50, fontSize: 15, fontWeight: 600, backgroundColor: colors.surface, color: colors.textPrimary,
    boxSizing: 'border-box',
  };
  const fieldLabel: React.CSSProperties = {fontSize: 10, fontWeight: 700, letterSpacing: 1, marginBottom: 8, marginTop: 16, color: colors.textMuted};

  // ── Add/Edit Staff form ──────────────────────────────────────────────
  if (showAdd) {
    const isEdit = !!editingUser;
    const usernamePrefix: Record<Role, string> = {doctor: 'dr_', staff: '', valet: 'valet_', driver: 'driver_', admin: ''};
    const slug = (name.trim() || 'full name').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const previewUsername = `${usernamePrefix[role]}${slug || 'full_name'}`;
    const canSubmit = name.trim() && employeeId.trim() && (isEdit || password.trim()) && !submitting;

    return (
      <div className="screen-scroll" style={{backgroundColor: colors.background, paddingBottom: 40}}>
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 0'}}>
          <PressableScale onClick={closeForm} style={{borderRadius: 10, border: `1px solid ${colors.border}`, padding: '8px 12px', backgroundColor: colors.surface}}>
            <span style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>← Back</span>
          </PressableScale>
          <span style={{fontSize: 17, fontWeight: 900, color: colors.textPrimary}}>{isEdit ? 'Edit Staff' : 'Add Staff'}</span>
          <div style={{width: 70}} />
        </div>

        <div style={{padding: 20, paddingBottom: 40}}>
          <div style={fieldLabel}>ROLE {isEdit ? '(TRANSFER)' : ''}</div>
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 8}}>
            {ROLE_OPTIONS.map(r => {
              const on = role === r.key;
              return (
                <PressableScale key={r.key} onClick={() => setRole(r.key)}
                  style={{display: 'flex', alignItems: 'center', gap: 6, border: `1.5px solid ${on ? colors.primary : colors.border}`, borderRadius: radius.full, padding: '10px 14px', backgroundColor: on ? colors.primary : colors.surface}}>
                  <Icon name={r.icon} size={18} color={on ? colors.textOnPrimary : colors.textMuted} />
                  <span style={{fontSize: 12, fontWeight: 700, color: on ? colors.textOnPrimary : colors.textSecondary}}>{r.label}</span>
                </PressableScale>
              );
            })}
          </div>

          <div style={fieldLabel}>FULL NAME</div>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kavita Reddy" />

          {isEdit && editingUser && (
            <div style={{borderRadius: 12, border: `1px solid ${colors.primary}30`, padding: 12, marginTop: 14, backgroundColor: colors.primary + '10'}}>
              <div style={{fontSize: 9, fontWeight: 800, letterSpacing: 1, color: colors.textMuted}}>LOGS IN AS</div>
              <div style={{fontSize: 15, fontWeight: 900, marginTop: 3, color: colors.primary}}>{editingUser.username}</div>
            </div>
          )}
          {!isEdit && (
            <div style={{fontSize: 11, marginTop: 10, lineHeight: '16px', color: colors.textMuted}}>
              Their username is generated automatically — they'll sign in as "{previewUsername}".
            </div>
          )}

          <div style={fieldLabel}>EMPLOYEE ID{isEdit ? ' (FIXED)' : ''} — internal reference only</div>
          <input
            style={{...inputStyle, backgroundColor: isEdit ? colors.background : colors.surface, color: isEdit ? colors.textMuted : colors.textPrimary}}
            value={employeeId} onChange={e => setEmployeeId(e.target.value.toUpperCase())} placeholder="e.g. DOC010"
            disabled={isEdit}
          />

          {(role === 'doctor' || role === 'staff') && (
            <>
              <div style={fieldLabel}>DEPARTMENT (OPTIONAL)</div>
              <input style={inputStyle} value={department} onChange={e => setDepartment(e.target.value)} placeholder="e.g. Cardiology" />

              <div style={fieldLabel}>VALET CARD CODE (OPTIONAL, 3 DIGITS)</div>
              <input style={inputStyle} value={cardCode} onChange={e => setCardCode(e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="e.g. 472" inputMode="numeric" />
            </>
          )}

          {role === 'driver' && (
            <>
              <div style={fieldLabel}>PHONE (OPTIONAL)</div>
              <input style={inputStyle} value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit number" inputMode="numeric" />
            </>
          )}

          {!isEdit && (
            <>
              <div style={fieldLabel}>PASSWORD</div>
              <div style={{display: 'flex', alignItems: 'center', border: `1.5px solid ${colors.border}`, borderRadius: 12, padding: '0 14px', height: 50, backgroundColor: colors.surface}}>
                <input style={{flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: colors.textPrimary}}
                  value={password} onChange={e => setPassword(e.target.value)} />
                <PressableScale onClick={() => setPassword(genPassword())} style={{paddingLeft: 10}}>
                  <span style={{fontSize: 12, fontWeight: 700, color: colors.primary}}>Regenerate</span>
                </PressableScale>
              </div>
              <div style={{fontSize: 11, marginTop: 8, lineHeight: '16px', color: colors.textMuted}}>
                {password.length > 0 && password.length < 8
                  ? '⚠ Password must be at least 8 characters.'
                  : "Share this with the new hire directly — it won't be shown again after creating the account."}
              </div>
            </>
          )}

          <PressableScale
            style={{width: '100%', borderRadius: radius.full, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 28, backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.4}}
            onClick={isEdit ? handleSaveEdit : handleCreate}
            disabled={!canSubmit}
          >
            {submitting ? <span className="spinner" style={{width: 18, height: 18, borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff'}} /> : <span style={{color: '#fff', fontSize: 15, fontWeight: 700}}>{isEdit ? 'Save Changes' : 'Create Account'}</span>}
          </PressableScale>

          {isEdit && (
            <>
              <PressableScale
                style={{width: '100%', borderRadius: radius.full, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, border: `1.5px solid ${colors.border}`, backgroundColor: 'transparent', opacity: resettingPassword ? 0.6 : 1}}
                disabled={resettingPassword || deleting}
                onClick={handleResetPassword}>
                {resettingPassword
                  ? <span className="spinner" style={{width: 16, height: 16, borderColor: colors.border, borderTopColor: colors.textPrimary}} />
                  : <span style={{fontSize: 14, fontWeight: 700, color: colors.textPrimary}}>Reset Password</span>}
              </PressableScale>
              <PressableScale
                style={{width: '100%', borderRadius: radius.full, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 12, border: `1.5px solid ${colors.error}40`, backgroundColor: 'transparent', opacity: deleting ? 0.6 : 1}}
                disabled={deleting || resettingPassword}
                onClick={handleDelete}>
                {deleting
                  ? <span className="spinner" style={{width: 16, height: 16, borderColor: colors.error + '40', borderTopColor: colors.error}} />
                  : <span style={{fontSize: 14, fontWeight: 700, color: colors.error}}>Delete Account</span>}
              </PressableScale>
            </>
          )}
        </div>
      </div>
    );
  }

  // ── Staff list ─────────────────────────────────────────────────────────
  return (
    <div className="screen-scroll" style={{backgroundColor: colors.background, padding: 16, paddingBottom: 40}}>
      <PressableScale style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: radius.full, padding: '16px 0', marginBottom: spacing.base, backgroundColor: colors.primary}} onClick={() => setShowAdd(true)}>
        <Icon name="plus" size={18} color={colors.textOnPrimary} />
        <span style={{color: colors.textOnPrimary, fontSize: 14, fontWeight: 700}}>Add Staff</span>
      </PressableScale>

      <div style={{display: 'flex', gap: 10, marginBottom: spacing.md}}>
        {[
          {n: String(onDuty), l: 'Drivers Ready', c: colors.success},
          {n: String(onTask), l: 'On Task', c: colors.warning},
          {n: String(offDuty), l: 'Off Duty', c: colors.textMuted},
        ].map(st => (
          <div key={st.l} style={{flex: 1, textAlign: 'center', padding: '18px 0', borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, backgroundColor: colors.card}}>
            <div style={{fontSize: typography.sizes['2xl'], fontWeight: typography.weights.black, color: colors.textPrimary}}>{st.n}</div>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: 3}}>
              <span style={{width: 6, height: 6, borderRadius: 3, backgroundColor: st.c}} />
              <span style={{fontSize: 11, fontWeight: 600, color: colors.textMuted}}>{st.l}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: spacing.md}}>
        {FILTER_TABS.map(tab => {
          const on = filter === tab.key;
          return (
            <PressableScale key={tab.key} onClick={() => setFilter(tab.key)}
              style={{flexShrink: 0, padding: '9px 16px', borderRadius: radius.full, border: `1.5px solid ${on ? colors.primary : colors.border}`, backgroundColor: on ? colors.primary : colors.surface}}>
              <span style={{fontSize: 13, fontWeight: 700, color: on ? colors.textOnPrimary : colors.textSecondary}}>{tab.label}</span>
            </PressableScale>
          );
        })}
      </div>

      {loading ? (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: spacing.md, padding: '40px 0'}}>
          <span className="spinner" style={{borderColor: colors.border, borderTopColor: colors.primary}} />
          <span style={{fontSize: 12, fontWeight: 600, color: colors.textMuted}}>Loading staff…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{borderRadius: radius['2xl'], border: `1px dashed ${colors.border}`, padding: 32, textAlign: 'center', backgroundColor: colors.card}}>
          <Icon name="people" size={26} color={colors.textMuted} />
          <div style={{fontSize: 13, fontWeight: 600, marginTop: spacing.sm, color: colors.textMuted}}>No staff in this category yet</div>
        </div>
      ) : (
        <div style={{borderRadius: radius['2xl'], border: `1px solid ${colors.border}`, overflow: 'hidden', backgroundColor: colors.card}}>
          {filtered.map((u, i) => (
            <PressableScale key={u.id} onClick={() => openEdit(u)}
              style={{width: '100%', display: 'flex', alignItems: 'center', gap: spacing.md, padding: 14, borderBottom: i === filtered.length - 1 ? 'none' : `1px solid ${colors.divider}`}}>
              <div style={{width: 42, height: 42, borderRadius: radius.full, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, backgroundColor: colors.cardAlt}}>
                <span style={{fontSize: 13, fontWeight: 800, color: colors.textPrimary}}>{u.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
              </div>
              <div style={{flex: 1, textAlign: 'left', minWidth: 0}}>
                <div style={{fontSize: 13, fontWeight: 700, color: colors.textPrimary}}>{u.username}</div>
                <div style={{fontSize: 11, marginTop: 2, color: colors.textSecondary}}>{roleLabel(u.role)} · ID {u.employeeId}</div>
                {!!(u.department || u.phone) && <div style={{fontSize: 11, marginTop: 1, color: colors.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{u.department || u.phone}</div>}
              </div>
              <div style={{display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0}}>
                {statusBadge(u)}
                <Icon name="arrowRight" size={14} color={colors.textMuted} />
              </div>
            </PressableScale>
          ))}
        </div>
      )}
    </div>
  );
}
