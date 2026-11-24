import { useEffect, useState } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api, can, isStaff } from './data/api';
import { SessionContext, useSession } from './data/hooks';
import Layout from './components/Layout';
import { CallProvider } from './components/Calls';
import { ProfilesProvider } from './components/Avatar';
import Login from './pages/Login';
import Setup from './pages/Setup';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Members from './pages/Members';
import Accounts from './pages/Accounts';
import Announcements from './pages/Announcements';
import Events from './pages/Events';
import Documents from './pages/Documents';
import Finance from './pages/Finance';
import Reports from './pages/Reports';
import Messenger from './pages/Messenger';
import MyMembership from './pages/MyMembership';

const HEARTBEAT_MS = 30000;

function useAuthSession() {
  const [uid, setUid] = useState(undefined);
  const [user, setUser] = useState(undefined);
  const [notice, setNotice] = useState('');

  useEffect(() => api.auth.onChange((u) => setUid(u)), []);

  useEffect(() => {
    if (!uid) { setUser(uid === null ? null : undefined); return undefined; }
    setUser(undefined);
    return api.subDoc(`users/${uid}`, (doc) => {
      if (!doc) {
        // Account deleted by the Admin: remove the leftover login too.
        api.get(`deleted_users/${uid}`).then((d) => (d ? api.auth.deleteSelf() : null)).catch(() => {})
          .finally(() => api.auth.signOut().catch(() => {}));
        setNotice('This account was deleted or has no JPCS HUB record. Please contact the JPCS admin.');
      } else if (doc.status === 'pending') {
        setNotice('Your account is waiting for approval by a JPCS officer. Please try again once it is approved.');
        api.auth.signOut();
      } else if (doc.status === 'inactive') {
        setNotice('This account has been deactivated. Please contact the JPCS admin.');
        api.auth.signOut();
      } else {
        setUser(doc);
      }
    });
  }, [uid]);

  // Presence: "Active now" while the portal is open.
  useEffect(() => {
    if (!uid || !user) return undefined;
    const beat = () => {
      if (document.visibilityState === 'visible') {
        api.set(`presence/${uid}`, { last_active: Date.now(), staff: isStaff(user.role) }, { merge: true }).catch(() => {});
      }
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', beat); };
  }, [uid, !!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = async () => {
    if (uid) await api.set(`presence/${uid}`, { last_active: 0 }, { merge: true }).catch(() => {});
    await api.auth.signOut();
  };

  return { uid, user, notice, setNotice, signOut };
}

function Guard({ page, children }) {
  const { user } = useSession();
  if (!can(user.role, page)) return <Navigate to={user.role === 'student' ? '/messenger' : '/'} replace />;
  return children;
}

export default function App() {
  const session = useAuthSession();

  if (session.uid === undefined || (session.uid && session.user === undefined)) {
    return <div className="login-page"><div style={{ color: '#fff' }}>Loading JPCS HUB…</div></div>;
  }

  if (!session.user) {
    return (
      <HashRouter>
        <Routes>
          <Route path="/setup" element={<Setup />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Login notice={session.notice} clearNotice={() => session.setNotice('')} />} />
        </Routes>
      </HashRouter>
    );
  }

  return (
    <SessionContext.Provider value={session}>
      <ProfilesProvider>
      <HashRouter>
        <CallProvider>
          <Layout demo={api.isDemo}>
            <Routes>
              <Route path="/" element={<Guard page="dashboard"><Dashboard /></Guard>} />
              <Route path="/members" element={<Guard page="members"><Members /></Guard>} />
              <Route path="/accounts" element={<Guard page="accounts"><Accounts /></Guard>} />
              <Route path="/announcements" element={<Guard page="announcements"><Announcements /></Guard>} />
              <Route path="/events" element={<Guard page="events"><Events /></Guard>} />
              <Route path="/documents" element={<Guard page="documents"><Documents /></Guard>} />
              <Route path="/finance" element={<Guard page="finance"><Finance /></Guard>} />
              <Route path="/reports" element={<Guard page="reports"><Reports /></Guard>} />
              <Route path="/messenger" element={<Guard page="messenger"><Messenger /></Guard>} />
              <Route path="/membership" element={<Guard page="membership"><MyMembership /></Guard>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </CallProvider>
      </HashRouter>
      </ProfilesProvider>
    </SessionContext.Provider>
  );
}
