import { useState } from 'react';
import { api, authError, ROLES, fmtDate, isOnline } from '../data/api';
import { useCollection, useNow, useSession } from '../data/hooks';
import { Modal, Confirm, PageHead, Field, StatusBadge, Loading } from '../components/ui';
import { Avatar } from '../components/Avatar';

const STAFF_ROLES = ['admin', 'officer', 'treasurer', 'auditor'];
const ALL_ROLES = [...STAFF_ROLES, 'student'];

function AccountForm({ account, onClose }) {
  const { uid } = useSession();
  const isNew = !account.id;
  const [form, setForm] = useState({ full_name: '', username: '', email: '', role: 'officer', ...account });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isNew) {
        if (password.length < 6) throw Object.assign(new Error(), { code: 'auth/weak-password' });
        const username = form.username.trim().toLowerCase();
        const newUid = await api.auth.createAccount(username, password);
        await api.set(`users/${newUid}`, {
          full_name: form.full_name.trim(), username, email: form.email.trim(), role: form.role,
          status: 'active', date_created: Date.now(), last_active: 0,
        });
      } else {
        const data = { full_name: form.full_name.trim(), email: form.email.trim() };
        data.role = form.role;
        await api.update(`users/${account.id}`, data);
      }
      onClose();
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Add User Account' : 'Edit User Account'} onClose={onClose}>
      <form onSubmit={save}>
        {error && <div className="error">{error}</div>}
        <Field label="Full Name"><input className="input" value={form.full_name} onChange={set('full_name')} required /></Field>
        <Field label="Username">
          <input className="input" value={form.username} onChange={set('username')} required disabled={!isNew} />
        </Field>
        <Field label="E-mail (optional)"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
        <Field label="Role">
          <select className="input" value={form.role} onChange={set('role')} disabled={account.id === uid}>
            {(isNew ? STAFF_ROLES : ALL_ROLES).map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
          </select>
        </Field>
        {account.id === uid && <div className="small muted" style={{ marginTop: -8, marginBottom: 12 }}>You can't change your own role.</div>}
        {isNew && <div className="small muted" style={{ marginTop: -8, marginBottom: 12 }}>Student logins are created in Membership Records.</div>}
        {isNew && (
          <Field label="Temporary Password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </Field>
        )}
        <div className="modal-actions">
          <button type="button" className="btn light" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Account'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Accounts() {
  const { uid } = useSession();
  useNow();
  const users = useCollection('users', { orderBy: ['date_created', 'asc'] });
  const presence = useCollection('presence');
  const online = (id) => isOnline((presence || []).find((p) => p.id === id));
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('all');

  const rows = (users || []).filter((u) => (filter === 'all' ? true : filter === 'staff' ? u.role !== 'student' : u.role === 'student'));
  const toggle = (u) => api.update(`users/${u.id}`, { status: u.status === 'inactive' ? 'active' : 'inactive' });
  const [deleting, setDeleting] = useState(null);
  const removeAccount = async (u) => {
    const ops = [
      { op: 'set', path: `deleted_users/${u.id}`, data: { username: u.username, deleted_by: uid, date_deleted: Date.now() } },
      { op: 'delete', path: `users/${u.id}` },
      { op: 'delete', path: `presence/${u.id}` },
      { op: 'delete', path: `profiles/${u.id}` },
    ];
    if (u.member_id) ops.push({ op: 'update', path: `members/${u.member_id}`, data: { uid: '', username: '' } });
    try { await api.batch(ops); } catch {
      // member record may already be gone; retry without it
      await api.batch(ops.filter((o) => !o.path.startsWith('members/')));
    }
  };

  return (
    <>
      <PageHead title="User Accounts" sub="View the accounts and assigned roles in the portal.">
        <select className="input" style={{ width: 170 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="staff">Officers &amp; staff</option>
          <option value="students">Students</option>
          <option value="all">All accounts</option>
        </select>
        <button className="btn" onClick={() => setEditing({})}>+ Add Account</button>
      </PageHead>
      <div className="card">
        {!users ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Username</th><th>Full Name</th><th>Role</th><th>Status</th><th>Online</th><th>Created</th><th>Action</th></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={7} className="muted">No accounts.</td></tr>}
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td><span className="row"><Avatar uid={u.id} name={u.full_name || u.username} size={30} />{u.username}</span></td>
                    <td>{u.full_name}</td>
                    <td>{ROLES[u.role] || u.role}</td>
                    <td><StatusBadge value={u.status} /></td>
                    <td><span className="row small"><span className={`status-dot${online(u.id) ? ' on' : ''}`} />{online(u.id) ? 'Active' : 'Offline'}</span></td>
                    <td className="small">{fmtDate(u.date_created)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="chip-btn edit" onClick={() => setEditing(u)}>Edit</button>
                      {u.id !== uid && (
                        <>
                          <button className="chip-btn del" onClick={() => toggle(u)}>{u.status === 'inactive' ? 'Activate' : 'Deactivate'}</button>
                          <button className="chip-btn del" style={{ background: '#c53030', color: '#fff' }} onClick={() => setDeleting(u)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="small muted" style={{ marginBottom: 0 }}>
          Deactivated accounts can no longer sign in (you can activate them again). Deleted accounts are removed permanently. Student logins are created from Membership Records.
        </p>
      </div>
      {editing && <AccountForm account={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm
          title="Delete account?"
          message={`${deleting.full_name || deleting.username} (${deleting.username}) will be removed and can no longer log in to the portal or the app. Their chat messages stay. This cannot be undone.`}
          confirmLabel="Delete account"
          onConfirm={() => removeAccount(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
