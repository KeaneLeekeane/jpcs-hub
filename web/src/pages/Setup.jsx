import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../data/api';

// One-time page that creates the first Admin (Faculty Adviser) account.
// Firestore rules only allow this while settings/bootstrap does not exist.
export default function Setup() {
  const [done, setDone] = useState(null);
  const [form, setForm] = useState({ full_name: '', username: 'admin', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('settings/bootstrap').then((d) => setDone(!!d)).catch(() => setDone(false));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      const username = form.username.trim().toLowerCase();
      await api.auth.bootstrap(username, form.password, (uid) => [
        {
          path: `users/${uid}`,
          data: {
            full_name: form.full_name.trim(), username, email: form.email.trim(), role: 'admin',
            status: 'active', date_created: Date.now(), last_active: 0,
          },
        },
        { path: 'settings/bootstrap', data: { admin_uid: uid, date_created: Date.now() } },
      ]);
      setDone(true);
    } catch (err) {
      setError(authError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="logo">JH</div>
        <h1>First-time setup</h1>
        <div className="sub">Create the Admin / Faculty Adviser account for JPCS HUB.</div>
        {done === null && <div className="muted">Checking…</div>}
        {done === true && (
          <>
            <div className="note">Setup is complete. Log in with the admin account, then add officers, the Treasurer, the Auditor and members from the portal.</div>
            <Link className="btn" style={{ width: '100%', marginTop: 16 }} to="/">Go to login</Link>
          </>
        )}
        {done === false && (
          <>
            {error && <div className="error">{error}</div>}
            <label className="field"><span>Full name</span><input className="input" value={form.full_name} onChange={set('full_name')} required /></label>
            <label className="field"><span>Username</span><input className="input" value={form.username} onChange={set('username')} required /></label>
            <label className="field"><span>E-mail (optional)</span><input className="input" type="email" value={form.email} onChange={set('email')} /></label>
            <label className="field"><span>Password</span><input className="input" type="password" value={form.password} onChange={set('password')} required /></label>
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating…' : 'Create admin account'}</button>
            <div className="small muted" style={{ marginTop: 14, textAlign: 'center' }}><Link to="/">Back to login</Link></div>
          </>
        )}
      </form>
    </div>
  );
}
