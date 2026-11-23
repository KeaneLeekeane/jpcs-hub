import { useState } from 'react';
import { api, authError } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { Modal, Confirm, PageHead, Field, StatusBadge, Loading } from '../components/ui';

const EMPTY = {
  student_no: '', first_name: '', last_name: '', course: 'BSIT', year_level: '1st Year',
  email: '', contact_no: '', membership_status: 'Pending',
};
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const STATUSES = ['Active', 'Pending', 'Inactive'];

function MemberForm({ member, onClose }) {
  const { uid } = useSession();
  const isNew = !member.id;
  const [form, setForm] = useState({ ...EMPTY, ...member });
  const [withLogin, setWithLogin] = useState(isNew || !member.uid);
  const [loginUser, setLoginUser] = useState(member.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const needsLogin = withLogin && !member.uid;

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (needsLogin && password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      const id = member.id || api.newId('members');
      const data = {
        student_no: form.student_no.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        course: form.course.trim(), year_level: form.year_level, email: form.email.trim(),
        contact_no: form.contact_no.trim(), membership_status: form.membership_status,
        updated_by: uid,
      };
      const fullName = `${data.first_name} ${data.last_name}`.trim();
      if (needsLogin) {
        const username = (loginUser || data.student_no).trim().toLowerCase();
        const studentUid = await api.auth.createAccount(username, password);
        await api.set(`users/${studentUid}`, {
          full_name: fullName, username, email: data.email, role: 'student', status: 'active',
          member_id: id, date_created: Date.now(), last_active: 0,
        });
        data.uid = studentUid;
        data.username = username;
      } else if (member.uid) {
        await api.update(`users/${member.uid}`, {
          full_name: fullName, email: data.email,
          status: data.membership_status === 'Inactive' ? 'inactive' : 'active',
        });
      }
      if (isNew) await api.set(`members/${id}`, { ...data, uid: data.uid || '', username: data.username || '', date_registered: Date.now() });
      else await api.update(`members/${id}`, data);
      onClose();
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={isNew ? 'Add Member' : 'Edit Member'} onClose={onClose} width={620}>
      <form onSubmit={save}>
        {error && <div className="error">{error}</div>}
        <div className="grid g2" style={{ gap: '0 16px' }}>
          <Field label="Student No."><input className="input" value={form.student_no} onChange={set('student_no')} required /></Field>
          <Field label="Course"><input className="input" value={form.course} onChange={set('course')} required /></Field>
          <Field label="First Name"><input className="input" value={form.first_name} onChange={set('first_name')} required /></Field>
          <Field label="Last Name"><input className="input" value={form.last_name} onChange={set('last_name')} required /></Field>
          <Field label="Year Level">
            <select className="input" value={form.year_level} onChange={set('year_level')}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
          </Field>
          <Field label="Membership Status">
            <select className="input" value={form.membership_status} onChange={set('membership_status')}>{STATUSES.map((y) => <option key={y}>{y}</option>)}</select>
          </Field>
          <Field label="E-mail"><input className="input" type="email" value={form.email} onChange={set('email')} /></Field>
          <Field label="Contact No."><input className="input" value={form.contact_no} onChange={set('contact_no')} /></Field>
        </div>
        {member.uid ? (
          <div className="note" style={{ marginBottom: 14 }}>Mobile app login: <b>{member.username}</b></div>
        ) : (
          <div className="card" style={{ padding: 14, marginBottom: 14, background: '#fafbfd' }}>
            <label className="row" style={{ fontWeight: 600, fontSize: 14 }}>
              <input type="checkbox" checked={withLogin} onChange={(e) => setWithLogin(e.target.checked)} />
              Create a mobile app login (Messenger and Video Call)
            </label>
            {withLogin && (
              <div className="grid g2" style={{ gap: '0 16px', marginTop: 12 }}>
                <Field label="Username"><input className="input" placeholder={form.student_no || 'Student No.'} value={loginUser} onChange={(e) => setLoginUser(e.target.value)} /></Field>
                <Field label="Password"><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
              </div>
            )}
          </div>
        )}
        <div className="modal-actions">
          <button type="button" className="btn light" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save Member'}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Members() {
  const members = useCollection('members', { orderBy: ['student_no', 'asc'] });
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const term = q.trim().toLowerCase();
  const rows = (members || []).filter((m) => !term || [m.student_no, m.first_name, m.last_name, m.email, m.course, m.membership_status]
    .join(' ').toLowerCase().includes(term));

  const remove = async (m) => {
    await api.remove(`members/${m.id}`);
    if (m.uid) await api.update(`users/${m.uid}`, { status: 'inactive' }).catch(() => {});
  };

  return (
    <>
      <PageHead title="Membership Records" sub="View and manage JPCS member information.">
        <button className="btn" onClick={() => setEditing({})}>+ Add Member</button>
      </PageHead>
      <div className="card">
        <div className="row" style={{ marginBottom: 18 }}>
          <input className="input" style={{ maxWidth: 320 }} placeholder="Search member..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="spacer" />
          <span className="small muted">{rows.length} member{rows.length === 1 ? '' : 's'}</span>
        </div>
        {!members ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Student No.</th><th>Full Name</th><th>Course</th><th>Year</th><th>Email</th><th>Status</th><th>App Login</th><th>Action</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={8} className="muted">No members found.</td></tr>}
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>{m.student_no}</td>
                    <td>{m.first_name} {m.last_name}</td>
                    <td>{m.course}</td>
                    <td>{m.year_level}</td>
                    <td>{m.email}</td>
                    <td><StatusBadge value={m.membership_status} /></td>
                    <td className="small">{m.username || <span className="muted">—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="chip-btn edit" onClick={() => setEditing(m)}>Edit</button>
                      <button className="chip-btn del" onClick={() => setDeleting(m)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {editing && <MemberForm member={editing} onClose={() => setEditing(null)} />}
      {deleting && (
        <Confirm
          title="Delete member?"
          message={`${deleting.first_name} ${deleting.last_name} (${deleting.student_no}) will be removed${deleting.uid ? ' and their app login deactivated' : ''}.`}
          onConfirm={() => remove(deleting)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
