import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutGrid, User, Settings, Megaphone, CalendarDays, FileText, PhilippinePeso, BarChart3,
  MessageSquare, LogOut, IdCard,
} from 'lucide-react';
import { ROLES, can } from '../data/api';
import { useSession, useCollection } from '../data/hooks';
import InstallButton from './InstallButton';
import { Avatar, ProfileModal } from './Avatar';

const MAIN = [
  ['/', 'dashboard', 'Dashboard', LayoutGrid],
  ['/members', 'members', 'Membership Records', User],
  ['/accounts', 'accounts', 'User Accounts', Settings],
  ['/announcements', 'announcements', 'Announcements', Megaphone],
  ['/events', 'events', 'Events', CalendarDays],
  ['/documents', 'documents', 'Documents', FileText],
  ['/membership', 'membership', 'My Membership', IdCard],
];
const MANAGEMENT = [
  ['/finance', 'finance', 'Financial Management', PhilippinePeso],
  ['/reports', 'reports', 'Reports', BarChart3],
];

export const TITLES = {
  '/': 'Dashboard', '/members': 'Membership Records', '/accounts': 'User Accounts',
  '/announcements': 'Announcements', '/events': 'Events Management', '/documents': 'Document Management',
  '/finance': 'Financial Management', '/reports': 'Reports', '/messenger': 'Messenger', '/membership': 'My Membership',
};

function Section({ label, items, role }) {
  const visible = items.filter(([, key]) => can(role, key));
  if (!visible.length) return null;
  return (
    <>
      <div className="nav-label">{label}</div>
      {visible.map(([to, , text, Icon]) => (
        <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <Icon /> {text}
        </NavLink>
      ))}
    </>
  );
}

export default function Layout({ children, demo }) {
  const { uid, user, signOut } = useSession();
  const [profile, setProfile] = useState(false);
  const { pathname } = useLocation();
  const role = user.role;
  const staff = role !== 'student';
  const convos = useCollection(staff ? 'conversations' : null);
  const dms = useCollection('dms', { where: [['members', uid, 'array-contains']] });
  const mine = useCollection(staff ? null : 'conversations', { where: [['student_uid', uid]] });
  const unread = (convos || []).reduce((n, c) => n + (c.staff_unread || 0), 0)
    + (dms || []).reduce((n, d) => n + (d[`unread_${uid}`] || 0), 0)
    + (mine || []).reduce((n, c) => n + (c.student_unread || 0), 0);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="logo">JH</div>
          <div>
            <div className="brand-name">JPCS HUB</div>
            <div className="brand-sub">PTC Organization</div>
          </div>
        </div>
        <div className="me" style={{ cursor: 'pointer' }} onClick={() => setProfile(true)} title="My profile and picture">
          <Avatar uid={uid} name={user.full_name || user.username} size={40} />
          <div>
            <div className="me-name">{user.username}</div>
            <div className="me-role">{ROLES[role]}</div>
          </div>
        </div>
        <Section label="MAIN MENU" items={MAIN} role={role} />
        <Section label="MANAGEMENT" items={MANAGEMENT} role={role} />
        <div className="nav-label">COMMUNICATION</div>
        <NavLink to="/messenger" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <MessageSquare /> Messenger
          {unread > 0 && <span className="nav-badge">{unread}</span>}
        </NavLink>
        <div className="sidebar-bottom">
          <button className="logout" onClick={signOut}><LogOut size={16} /> Log Out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <h1>{TITLES[pathname] || 'JPCS HUB'}</h1>
            <p>Welcome to JPCS HUB Management Portal</p>
          </div>
          <div className="row">
            <InstallButton className="btn light sm" />
            {demo && <span className="demo-pill" title="No Firebase config yet: data is saved in this browser only">Demo mode</span>}
            <div className="top-user" style={{ cursor: 'pointer' }} onClick={() => setProfile(true)}><span className="green-dot" /> {user.username}</div>
          </div>
        </header>
        <main className="content">{children}</main>
        {profile && <ProfileModal onClose={() => setProfile(false)} />}
        <div className="footer">JPCS HUB · Pateros Technological College</div>
      </div>
    </div>
  );
}
