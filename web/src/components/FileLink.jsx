import { useEffect, useState } from 'react';
import { api } from '../data/api';
import { isStoredFile, dataURLToBlobURL } from '../data/common';

// Resolves a saved file (Firestore "fsfile:<id>", data URL or normal URL).
const cache = new Map();
export async function resolveFile(url) {
  if (!isStoredFile(url)) return url;
  if (cache.has(url)) return cache.get(url);
  const doc = await api.get(`files/${url.slice(7)}`);
  const data = doc?.data || '';
  cache.set(url, data);
  return data;
}

function openResolved(resolved, name) {
  if (!resolved) return;
  const href = resolved.startsWith('data:') ? dataURLToBlobURL(resolved) : resolved;
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  if (name && resolved.startsWith('data:') && !resolved.startsWith('data:image') && !resolved.startsWith('data:application/pdf')) a.download = name;
  a.click();
}

export async function openFile(url, name) {
  // Already loaded: open right away (keeps the click's popup permission).
  if (!isStoredFile(url) || cache.has(url)) { openResolved(isStoredFile(url) ? cache.get(url) : url, name); return; }
  openResolved(await resolveFile(url), name);
}

export function useFileSrc(url) {
  const [src, setSrc] = useState(isStoredFile(url) ? '' : url);
  useEffect(() => {
    let live = true;
    if (isStoredFile(url)) resolveFile(url).then((d) => live && setSrc(d)).catch(() => {});
    else setSrc(url);
    return () => { live = false; };
  }, [url]);
  return src;
}

export function FileLink({ url, name, children = 'Open' }) {
  const prefetch = () => { if (isStoredFile(url)) resolveFile(url).catch(() => {}); };
  return (
    <a href="#" onMouseEnter={prefetch} onFocus={prefetch} onTouchStart={prefetch}
      onClick={(e) => { e.preventDefault(); openFile(url, name); }}>{children}</a>
  );
}

const looksImage = (u = '') => u.startsWith('data:image') || /\.(png|jpe?g|gif|webp|heic)(\?|$)/i.test(u) || u.includes('/image/upload/');

export function Attachment({ url, label }) {
  const src = useFileSrc(url);
  if (!url) return <span className="muted">—</span>;
  return (
    <a href="#" title={label} onClick={(e) => { e.preventDefault(); openFile(url, label); }}>
      {src && looksImage(src) ? <img className="receipt-thumb" src={src} alt={label} /> : 'View'}
    </a>
  );
}
