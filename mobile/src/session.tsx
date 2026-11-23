import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { onAuth, signOutUser, subDoc, set, sub, type Row } from './firebase';

export type Session = {
  uid: string;
  user: Row; // users/{uid}
  isStudent: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Session | null>(null);
export const useSession = () => useContext(Ctx)!;

const HEARTBEAT_MS = 30000;

export function useAuthState() {
  const [uid, setUid] = useState<string | null | undefined>(undefined);
  const [user, setUser] = useState<Row | null | undefined>(undefined);
  const [notice, setNotice] = useState('');

  useEffect(() => onAuth(setUid), []);

  useEffect(() => {
    if (!uid) { setUser(uid === null ? null : undefined); return undefined; }
    setUser(undefined);
    return subDoc(`users/${uid}`, (doc) => {
      if (!doc) { setNotice('This login has no JPCS HUB account. Please contact a JPCS officer.'); signOutUser(); }
      else if (doc.status === 'inactive') { setNotice('This account is deactivated. Please contact a JPCS officer.'); signOutUser(); }
      else setUser(doc);
    });
  }, [uid]);

  // Presence ("Active now") while the app is in the foreground.
  useEffect(() => {
    if (!uid || !user) return undefined;
    const staff = user.role !== 'student';
    const beat = () => {
      if (AppState.currentState === 'active') set(`presence/${uid}`, { last_active: Date.now(), staff }, true).catch(() => {});
    };
    beat();
    const t = setInterval(beat, HEARTBEAT_MS);
    const s = AppState.addEventListener('change', (st) => {
      if (st === 'active') beat();
      else set(`presence/${uid}`, { last_active: 0, staff }, true).catch(() => {});
    });
    return () => { clearInterval(t); s.remove(); };
  }, [uid, !!user]); // eslint-disable-line react-hooks/exhaustive-deps

  return { uid, user, notice, setNotice };
}

// Profile pictures: profiles/{uid}.photo (small JPEG data URL), shared app-wide.
const PhotosCtx = createContext<Record<string, string>>({});
export function usePhoto(uid?: string) {
  const map = useContext(PhotosCtx);
  return uid ? map[uid] || '' : '';
}

export function SessionProvider({ uid, user, children }: { uid: string; user: Row; children: ReactNode }) {
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => sub('profiles', {}, (rows) => {
    const m: Record<string, string> = {};
    for (const r of rows) if (r.photo) m[r.id] = r.photo;
    setPhotos(m);
  }), []);
  const signOut = async () => {
    await set(`presence/${uid}`, { last_active: 0 }, true).catch(() => {});
    await signOutUser();
  };
  return (
    <Ctx.Provider value={{ uid, user, isStudent: user.role === 'student', signOut }}>
      <PhotosCtx.Provider value={photos}>{children}</PhotosCtx.Provider>
    </Ctx.Provider>
  );
}

export function useCollection(path: string | null, opts: Parameters<typeof sub>[1] = {}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const key = path ? path + JSON.stringify(opts) : '';
  useEffect(() => {
    if (!path) { setRows([]); return undefined; }
    setRows(null);
    return sub(path, opts, setRows);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return rows;
}

export function useNow(ms = 15000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
