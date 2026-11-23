import { createContext, useContext, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { api } from '../data/api';
import { useCollection, useSession } from '../data/hooks';
import { readAsDataURL } from '../data/common';
import { Modal, initials } from './ui';

// Profile pictures live in profiles/{uid}.photo (small JPEG data URL).
const ProfilesContext = createContext({});

export function ProfilesProvider({ children }) {
  const rows = useCollection('profiles');
  const map = {};
  for (const r of rows || []) if (r.photo) map[r.id] = r.photo;
  return <ProfilesContext.Provider value={map}>{children}</ProfilesContext.Provider>;
}

export const usePhoto = (uid) => useContext(ProfilesContext)[uid] || '';

export function Avatar({ uid, name = '', size = 38, online, onClick, className = '' }) {
  const photo = usePhoto(uid);
  return (
    <div className={`avatar ${className}`} style={{ width: size, height: size, fontSize: size * 0.36 }} onClick={onClick}>
      {photo ? <img src={photo} alt={name} /> : initials(name)}
      {online !== undefined && <span className={`dot${online ? ' on' : ''}`} />}
    </div>
  );
}

// Square-crop and shrink a picture to 256x256 JPEG (~20-40 KB).
async function toProfilePhoto(file) {
  const src = await readAsDataURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const side = Math.min(img.width, img.height);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 256, 256);
  return c.toDataURL('image/jpeg', 0.8);
}

export function ProfileModal({ onClose }) {
  const { uid, user } = useSession();
  const photo = usePhoto(uid);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError('');
    setBusy(true);
    try {
      if (!f.type.startsWith('image/')) throw new Error('Please choose a picture.');
      await api.set(`profiles/${uid}`, { photo: await toProfilePhoto(f), updated: Date.now() });
    } catch (err) { setError(err.message || 'Could not save the picture.'); } finally { setBusy(false); }
  };
  return (
    <Modal title="My Profile" onClose={onClose} width={420}>
      {error && <div className="error">{error}</div>}
      <div style={{ textAlign: 'center' }}>
        <Avatar uid={uid} name={user.full_name || user.username} size={110} className="avatar-edit" onClick={() => ref.current?.click()} />
        <div style={{ fontWeight: 700, fontSize: 17, marginTop: 12 }}>{user.full_name || user.username}</div>
        <div className="muted small">{user.username} · {user.role}</div>
        <input ref={ref} type="file" accept="image/*" hidden onChange={pick} />
        <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
          <button className="btn" onClick={() => ref.current?.click()} disabled={busy}><Camera /> {busy ? 'Saving…' : photo ? 'Change Picture' : 'Upload Picture'}</button>
          {photo && <button className="btn light" disabled={busy} onClick={() => api.set(`profiles/${uid}`, { photo: '', updated: Date.now() })}>Remove</button>}
        </div>
      </div>
      <div className="modal-actions"><button className="btn light" onClick={onClose}>Close</button></div>
    </Modal>
  );
}
