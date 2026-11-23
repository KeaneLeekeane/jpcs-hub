import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, authError } from '../data/api';
import { DEMO_ACCOUNTS } from '../data/seed';
import InstallButton from '../components/InstallButton';

export default function Login({ notice, clearNotice }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    clearNotice?.();
    setBusy(true);
    try {
      await api.auth.signIn(login, password);
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
        <h1>JPCS HUB</h1>
        <div className="sub">Membership Records and Operations Management Portal · JPCS–PTC</div>
        {(error || notice) && <div className="error">{error || notice}</div>}
        <label className="field">
          <span>Username or e-mail</span>
          <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" required autoFocus />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        <button className="btn" style={{ width: '100%', marginTop: 4 }} disabled={busy}>{busy ? 'Signing in…' : 'Log In'}</button>
        <InstallButton style={{ width: '100%', marginTop: 10 }} />

        {api.isDemo ? (
          <div className="demo-box">
            <b>Demo mode</b> (no Firebase connected yet). Sample logins:
            <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
              {DEMO_ACCOUNTS.map((a) => (
                <div key={a.username}>
                  <code>{a.username}</code> / <code>{a.password}</code> · {a.role}
                </div>
              ))}
            </div>
            <button type="button" className="link small" style={{ marginTop: 8 }} onClick={() => { api.resetDemo(); setError(''); }}>
              Reset demo data
            </button>
          </div>
        ) : (
          <div className="small muted" style={{ marginTop: 16, textAlign: 'center' }}>
            First time setting up? <Link to="/setup">Create the admin account</Link>
          </div>
        )}
      </form>
    </div>
  );
}
