import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../data/api';

const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

// Public sign-up page for students. The new account starts as "pending":
// it cannot log in until an officer or the admin approves it in
// Membership Records.
export default function Register() {
  const [form, setForm] = useState({
    student_no: '', first_name: '', last_name: '', course: 'BSIT', year_level: '1st Year',
    email: '', contact_no: '', username: '', password: '', confirm: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirm) { setError('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const username = (form.username || form.student_no).trim().toLowerCase();
      const full_name = `${form.first_name.trim()} ${form.last_name.trim()}`.trim();
      const now = Date.now();
      await api.auth.register(username, form.password, (uid) => [
        {
          path: `users/${uid}`,
          data: {
            full_name, username, email: form.email.trim(), role: 'student', status: 'pending',
            member_id: uid, date_created: now, last_active: 0, self_registered: true,
          },
        },
        {
          path: `members/${uid}`,
          data: {
            student_no: form.student_no.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(),
            course: form.course.trim(), year_level: form.year_level, email: form.email.trim(),
            contact_no: form.contact_no.trim(), membership_status: 'Pending',
            uid, username, self_registered: true, date_registered: now, updated_by: uid,
          },
        },
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
      <form className="login-card" style={{ maxWidth: 520 }} onSubmit={submit}>
        <div className="logo">JH</div>
        <h1>Create an account</h1>
        <div className="sub">Register as a JPCS–PTC member. A JPCS officer will review and approve your account.</div>
        {done ? (
          <>
            <div className="note">
              Registration sent. Your account is waiting for approval by a JPCS officer. You can log in once it is approved.
            </div>
            <Link className="btn" style={{ width: '100%', marginTop: 16 }} to="/">Back to login</Link>
          </>
        ) : (
          <>
            {error && <div className="error">{error}</div>}
            <div className="grid g2" style={{ gap: '0 14px' }}>
              <label className="field"><span>Student No.</span><input className="input" value={form.student_no} onChange={set('student_no')} placeholder="e.g. 2026-00123" required autoFocus /></label>
              <label className="field"><span>Course</span><input className="input" value={form.course} onChange={set('course')} required /></label>
              <label className="field"><span>First name</span><input className="input" value={form.first_name} onChange={set('first_name')} required /></label>
              <label className="field"><span>Last name</span><input className="input" value={form.last_name} onChange={set('last_name')} required /></label>
              <label className="field"><span>Year level</span>
                <select className="input" value={form.year_level} onChange={set('year_level')}>{YEARS.map((y) => <option key={y}>{y}</option>)}</select>
              </label>
              <label className="field"><span>Contact No.</span><input className="input" value={form.contact_no} onChange={set('contact_no')} /></label>
            </div>
            <label className="field"><span>E-mail</span><input className="input" type="email" value={form.email} onChange={set('email')} /></label>
            <label className="field"><span>Username (leave blank to use your Student No.)</span>
              <input className="input" value={form.username} onChange={set('username')} placeholder={form.student_no || 'Student No.'} autoComplete="username" />
            </label>
            <div className="grid g2" style={{ gap: '0 14px' }}>
              <label className="field"><span>Password</span><input className="input" type="password" value={form.password} onChange={set('password')} autoComplete="new-password" required /></label>
              <label className="field"><span>Confirm password</span><input className="input" type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" required /></label>
            </div>
            <button className="btn" style={{ width: '100%' }} disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
            <div className="small muted" style={{ marginTop: 14, textAlign: 'center' }}>
              Already have an account? <Link to="/">Log in</Link>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
