// DEMO MODE backend: keeps all data in this browser's localStorage and syncs
// between open tabs, so the messenger and video call can be tried with two tabs
// (one signed in as an officer, one as a student). Used only when no Firebase
// config is set.
import { toEmail } from './common';
import { demoSeed } from './seed';
import { isDemoMode } from '../firebaseConfig';

const KEY = 'jpcs-hub-demo-db-v1';
const SESSION = 'jpcs-hub-demo-session';
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('jpcs-hub-demo') : null;

let state = isDemoMode ? load() : null;
const subs = new Set();
const authSubs = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  const seeded = demoSeed();
  localStorage.setItem(KEY, JSON.stringify(seeded));
  return seeded;
}

// Each write starts from the newest copy (this tab's memory or what another
// tab saved), bumps a version number and sends the whole state to the other
// tabs, so open tabs never overwrite each other's changes with an old copy.
function newest() {
  const stored = load();
  return (stored.v || 0) > (state?.v || 0) ? stored : state;
}

function mutate(fn) {
  state = newest();
  const out = fn();
  state.v = (state.v || 0) + 1;
  save();
  return out;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  channel?.postMessage(state);
  notify();
}

if (isDemoMode && channel) {
  channel.onmessage = (ev) => {
    if (ev.data && (ev.data.v || 0) > (state?.v || 0)) { state = ev.data; notify(); }
  };
}

const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function splitPath(path) {
  const i = path.lastIndexOf('/');
  return [path.slice(0, i), path.slice(i + 1)];
}

function coll(path) { return state.db[path] || {}; }

function query(path, opts = {}) {
  let rows = Object.entries(coll(path)).map(([id, d]) => ({ id, ...d }));
  for (const [f, v] of opts.where || []) rows = rows.filter((r) => r[f] === v);
  if (opts.orderBy) {
    const [field, dir = 'asc'] = opts.orderBy;
    const m = dir === 'desc' ? -1 : 1;
    rows.sort((a, b) => ((a[field] ?? 0) > (b[field] ?? 0) ? m : (a[field] ?? 0) < (b[field] ?? 0) ? -m : 0));
  }
  return rows;
}

function getDoc(path) {
  const [c, id] = splitPath(path);
  const d = coll(c)[id];
  return d ? { id, ...d } : null;
}

function applyData(prev, data) {
  const out = { ...prev };
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && '__inc' in v) out[k] = (Number(out[k]) || 0) + v.__inc;
    else out[k] = v;
  }
  return out;
}

function writeDoc(path, data, mode) {
  const [c, id] = splitPath(path);
  state.db[c] = state.db[c] || {};
  const prev = state.db[c][id];
  if (mode === 'update' && !prev) throw new Error('Document not found: ' + path);
  state.db[c][id] = mode === 'set' ? applyData({}, data) : applyData(prev || {}, data);
}

function notify() {
  for (const s of [...subs]) {
    try { s(); } catch (e) { console.error('demo subscriber failed', e); }
  }
  const uid = currentUid();
  for (const cb of authSubs) cb(uid);
}

function currentUid() { return sessionStorage.getItem(SESSION) || null; }

const tick = () => new Promise((r) => setTimeout(r, 0));

export const localBackend = {
  isDemo: true,
  inc: (n) => ({ __inc: n }),

  auth: {
    uid: currentUid,
    async signIn(login, password) {
      await tick();
      const acc = state.auth[toEmail(login)];
      if (!acc || acc.password !== password) {
        const e = new Error('Invalid username or password.');
        e.code = 'auth/invalid-credential';
        throw e;
      }
      sessionStorage.setItem(SESSION, acc.uid);
      notify();
      return acc.uid;
    },
    async signOut() { sessionStorage.removeItem(SESSION); notify(); },
    onChange(cb) {
      authSubs.add(cb);
      setTimeout(() => cb(currentUid()), 0);
      return () => authSubs.delete(cb);
    },
    async createAccount(login, password) {
      const email = toEmail(login);
      if (state.auth[email]) {
        const e = new Error('That username or e-mail is already in use.');
        e.code = 'auth/email-already-in-use';
        throw e;
      }
      const uid = 'u_' + rid();
      mutate(() => { state.auth[email] = { uid, password }; });
      return uid;
    },
    async bootstrap(login, password, opsFor) {
      const uid = await this.createAccount(login, password);
      mutate(() => { for (const o of opsFor(uid)) writeDoc(o.path, o.data, 'set'); });
    },
  },

  sub(path, opts, cb) {
    let last = '';
    const run = () => {
      const rows = query(path, opts);
      const s = JSON.stringify(rows);
      if (s !== last) { last = s; cb(rows); }
    };
    subs.add(run);
    setTimeout(run, 0);
    return () => subs.delete(run);
  },
  subDoc(path, cb) {
    let last = '';
    const run = () => {
      const d = getDoc(path);
      const s = JSON.stringify(d);
      if (s !== last) { last = s; cb(d); }
    };
    subs.add(run);
    setTimeout(run, 0);
    return () => subs.delete(run);
  },
  async list(path, opts) { await tick(); return query(path, opts); },
  async get(path) { await tick(); return getDoc(path); },
  async add(path, data) { const id = rid(); mutate(() => writeDoc(`${path}/${id}`, data, 'set')); return id; },
  async set(path, data, opts = {}) { mutate(() => writeDoc(path, data, opts.merge ? 'merge' : 'set')); },
  async update(path, data) { mutate(() => writeDoc(path, data, 'update')); },
  async remove(path) {
    const [c, id] = splitPath(path);
    mutate(() => { if (state.db[c]) delete state.db[c][id]; });
  },
  async batch(ops) {
    mutate(() => {
      for (const o of ops) {
        if (o.op === 'delete') { const [c, id] = splitPath(o.path); if (state.db[c]) delete state.db[c][id]; }
        else writeDoc(o.path, o.data, o.op === 'set' ? 'set' : 'update');
      }
    });
  },
  newId: () => rid(),

  async upload(file) {
    if (file.size > 1.5 * 1024 * 1024) throw new Error('Demo mode keeps files in the browser, so the limit is 1.5 MB per file.');
    const url = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    return { url, name: file.name };
  },

  resetDemo() {
    const v = (state?.v || 0) + 1;
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(SESSION);
    state = load();
    state.v = v;
    save();
  },
};
