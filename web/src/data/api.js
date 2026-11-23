import { isDemoMode } from '../firebaseConfig';
import { localBackend } from './localBackend';
import { firebaseBackend } from './firebaseBackend';

// Demo mode (no Firebase config) keeps data in the browser; otherwise Firebase.
export const api = isDemoMode ? localBackend : firebaseBackend;

export const ROLES = {
  admin: 'Admin',
  officer: 'Officer',
  treasurer: 'Treasurer',
  auditor: 'Auditor',
  student: 'Student',
};

export const isStaff = (role) => ['admin', 'officer', 'treasurer', 'auditor'].includes(role);

// Which sidebar pages each role can open.
export const ACCESS = {
  dashboard: ['admin', 'officer', 'treasurer', 'auditor', 'student'],
  members: ['admin', 'officer'],
  accounts: ['admin'],
  announcements: ['admin', 'officer', 'treasurer', 'auditor', 'student'],
  events: ['admin', 'officer', 'treasurer', 'auditor', 'student'],
  membership: ['student'],
  documents: ['admin', 'officer', 'treasurer', 'auditor'],
  finance: ['admin', 'treasurer', 'auditor'],
  reports: ['admin', 'officer', 'treasurer', 'auditor'],
  messenger: ['admin', 'officer', 'treasurer', 'auditor', 'student'],
};

export const can = (role, page) => (ACCESS[page] || []).includes(role);
// Only the Admin and Officers can create, edit or delete announcements and events.
export const canManage = (role) => ['admin', 'officer'].includes(role);

export const ONLINE_WINDOW_MS = 75 * 1000;
export const isOnline = (user) => !!user && Date.now() - (user.last_active || 0) < ONLINE_WINDOW_MS;

export const peso = (n) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString('en-US') : '—');
export const fmtDateTime = (ms) =>
  ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
export const fmtTime = (ms) =>
  ms ? new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';

export function authError(e) {
  const c = e?.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found'))
    return 'Invalid username or password.';
  if (c.includes('email-already-in-use')) return 'That username is already in use. If this account was deleted before, its login still holds the username — use a different username (for example add a number).';
  if (c.includes('weak-password')) return 'Password must be at least 6 characters.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
  if (c.includes('network')) return 'No internet connection.';
  if (c.includes('permission-denied')) return 'You do not have permission to do that.';
  return e?.message || 'Something went wrong.';
}
