import { initializeApp, getApps, getApp } from 'firebase/app';
import * as FirebaseAuth from 'firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, query, where, increment,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig, isConfigured, USERNAME_DOMAIN } from './firebaseConfig';

export type Row = { id: string; [key: string]: any };

const app = isConfigured ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : null;

// Keep the login after the app is closed. getReactNativePersistence exists in
// Firebase's React Native build but is missing from its web type definitions.
function makeAuth() {
  if (!app) return null;
  const getRNPersistence = (FirebaseAuth as any).getReactNativePersistence;
  try {
    return FirebaseAuth.initializeAuth(app, getRNPersistence ? { persistence: getRNPersistence(AsyncStorage) } : {});
  } catch {
    return FirebaseAuth.getAuth(app);
  }
}

export const auth = makeAuth();
export const db = app ? getFirestore(app) : null;

export const toEmail = (login: string) => {
  const v = login.trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`;
};

export const signIn = (login: string, password: string) =>
  FirebaseAuth.signInWithEmailAndPassword(auth!, toEmail(login), password);
export const signOutUser = () => FirebaseAuth.signOut(auth!);
export const onAuth = (cb: (uid: string | null) => void) =>
  FirebaseAuth.onAuthStateChanged(auth!, (u) => cb(u ? u.uid : null));

type Opts = { where?: [string, any][]; orderBy?: [string, 'asc' | 'desc'] };

function sortRows(rows: Row[], opts: Opts) {
  if (!opts.orderBy) return rows;
  const [f, dir] = opts.orderBy;
  const m = dir === 'desc' ? -1 : 1;
  return rows.sort((a, b) => ((a[f] ?? 0) > (b[f] ?? 0) ? m : (a[f] ?? 0) < (b[f] ?? 0) ? -m : 0));
}

export function sub(path: string, opts: Opts, cb: (rows: Row[]) => void) {
  const parts = (opts.where || []).map(([f, v]) => where(f, '==', v));
  const q = parts.length ? query(collection(db!, path), ...parts) : collection(db!, path);
  return onSnapshot(q, (s) => cb(sortRows(s.docs.map((d) => ({ id: d.id, ...d.data() })), opts)),
    (e) => { console.warn('sub', path, e.message); cb([]); });
}

export function subDoc(path: string, cb: (row: Row | null) => void) {
  return onSnapshot(doc(db!, path), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null),
    (e) => { console.warn('subDoc', path, e.message); cb(null); });
}

export const add = async (path: string, data: object) => (await addDoc(collection(db!, path), data)).id;
export const set = (path: string, data: object, merge = false) => setDoc(doc(db!, path), data, merge ? { merge: true } : {});
export const update = (path: string, data: object) => updateDoc(doc(db!, path), data as any);
export const newId = (path: string) => doc(collection(db!, path)).id;
export const inc = (n: number) => increment(n);

export const ONLINE_WINDOW_MS = 75 * 1000;
export const isOnline = (p?: Row | null) => !!p && Date.now() - (p.last_active || 0) < ONLINE_WINDOW_MS;

export function authError(e: any) {
  const c = String(e?.code || '');
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email'))
    return 'Invalid username or password.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Please wait and try again.';
  if (c.includes('network')) return 'No internet connection.';
  return e?.message || 'Something went wrong.';
}
