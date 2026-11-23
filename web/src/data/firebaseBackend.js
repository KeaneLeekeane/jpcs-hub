import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged, signOut, inMemoryPersistence, setPersistence,
} from 'firebase/auth';
import {
  getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, getDocs, getDoc, increment, writeBatch,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseConfig, isDemoMode } from '../firebaseConfig';
import { toEmail, uploadToCloudinary, hasCloudinary, fileToStorableDataURL } from './common';

// Not initialized in demo mode (no config yet).
const app = isDemoMode ? null : initializeApp(firebaseConfig);
const auth = app ? getAuth(app) : null;
const db = app ? getFirestore(app) : null;

const toRow = (snap) => (snap.exists() ? { id: snap.id, ...snap.data() } : null);

function buildQuery(path, opts = {}) {
  const parts = (opts.where || []).map(([f, v]) => where(f, '==', v));
  return parts.length ? query(collection(db, path), ...parts) : collection(db, path);
}

function sortRows(rows, opts = {}) {
  if (!opts.orderBy) return rows;
  const [field, dir = 'asc'] = opts.orderBy;
  const m = dir === 'desc' ? -1 : 1;
  return rows.sort((a, b) => ((a[field] ?? 0) > (b[field] ?? 0) ? m : (a[field] ?? 0) < (b[field] ?? 0) ? -m : 0));
}

export const firebaseBackend = {
  isDemo: false,
  inc: (n) => increment(n),

  auth: {
    uid: () => auth.currentUser?.uid || null,
    async signIn(login, password) {
      const cred = await signInWithEmailAndPassword(auth, toEmail(login), password);
      return cred.user.uid;
    },
    signOut: () => signOut(auth),
    onChange: (cb) => onAuthStateChanged(auth, (u) => cb(u ? u.uid : null)),
    // Creates another person's login without signing the current user out,
    // by using a temporary second Firebase app instance.
    async createAccount(login, password) {
      const tmp = initializeApp(firebaseConfig, 'create-' + Date.now());
      try {
        const tmpAuth = getAuth(tmp);
        await setPersistence(tmpAuth, inMemoryPersistence);
        const cred = await createUserWithEmailAndPassword(tmpAuth, toEmail(login), password);
        const uid = cred.user.uid;
        await signOut(tmpAuth);
        return uid;
      } finally {
        await deleteApp(tmp);
      }
    },
    // First-time setup: creates the first admin and writes its records while
    // signed in as that new admin (in a temporary app instance).
    async bootstrap(login, password, opsFor) {
      const tmp = initializeApp(firebaseConfig, 'setup-' + Date.now());
      try {
        const tmpAuth = getAuth(tmp);
        await setPersistence(tmpAuth, inMemoryPersistence);
        const cred = await createUserWithEmailAndPassword(tmpAuth, toEmail(login), password);
        const tdb = getFirestore(tmp);
        const b = writeBatch(tdb);
        for (const o of opsFor(cred.user.uid)) b.set(doc(tdb, o.path), o.data);
        await b.commit();
        await signOut(tmpAuth);
      } finally {
        await deleteApp(tmp);
      }
    },
  },

  sub(path, opts, cb) {
    return onSnapshot(buildQuery(path, opts), (snap) => {
      cb(sortRows(snap.docs.map(toRow), opts));
    }, (err) => { console.error('sub', path, err); cb([]); });
  },
  subDoc(path, cb) {
    return onSnapshot(doc(db, path), (s) => cb(toRow(s)), (err) => { console.error('subDoc', path, err); cb(null); });
  },
  async list(path, opts) {
    const snap = await getDocs(buildQuery(path, opts));
    return sortRows(snap.docs.map(toRow), opts);
  },
  async get(path) { return toRow(await getDoc(doc(db, path))); },
  async add(path, data) { return (await addDoc(collection(db, path), data)).id; },
  set: (path, data, opts = {}) => setDoc(doc(db, path), data, opts.merge ? { merge: true } : {}),
  update: (path, data) => updateDoc(doc(db, path), data),
  remove: (path) => deleteDoc(doc(db, path)),
  async batch(ops) {
    const b = writeBatch(db);
    for (const o of ops) {
      const r = doc(db, o.path);
      if (o.op === 'set') b.set(r, o.data);
      else if (o.op === 'update') b.update(r, o.data);
      else if (o.op === 'delete') b.delete(r);
    }
    await b.commit();
  },
  newId: (path) => doc(collection(db, path)).id,

  async upload(file, folder) {
    if (hasCloudinary()) return uploadToCloudinary(file, folder);
    if (import.meta.env.VITE_USE_FIREBASE_STORAGE !== '1') {
      // Free plan: keep the file inside Firestore.
      const data = await fileToStorableDataURL(file);
      const ref2 = await addDoc(collection(db, 'files'), {
        data, name: file.name, folder, created_by: auth.currentUser?.uid || '', created_at: Date.now(),
      });
      return { url: `fsfile:${ref2.id}`, name: file.name };
    }
    const r = ref(getStorage(app), `${folder}/${Date.now()}_${file.name}`);
    await uploadBytes(r, file);
    return { url: await getDownloadURL(r), name: file.name };
  },
};
