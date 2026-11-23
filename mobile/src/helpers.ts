import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { add, get, auth } from './firebase';

export const ROLES: Record<string, string> = {
  admin: 'Admin', officer: 'Officer', treasurer: 'Treasurer', auditor: 'Auditor', student: 'Student',
};

// Same access table as the web portal.
export const ACCESS: Record<string, string[]> = {
  dashboard: ['admin', 'officer', 'treasurer', 'auditor'],
  members: ['admin', 'officer'],
  accounts: ['admin'],
  announcements: ['admin', 'officer'],
  events: ['admin', 'officer', 'treasurer'],
  documents: ['admin', 'officer', 'treasurer', 'auditor'],
  finance: ['admin', 'treasurer', 'auditor'],
  reports: ['admin', 'officer', 'treasurer', 'auditor'],
};
export const can = (role: string, page: string) => (ACCESS[page] || []).includes(role);
export const canManage = (role: string) => ['admin', 'officer'].includes(role);

export const peso = (n: any) =>
  '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtDate = (ms?: number) => (ms ? new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—');
export const today = () => new Date().toISOString().slice(0, 10);

// Free-plan file storage: compressed photo saved in Firestore "files".
const MAX = 950_000;
export async function savePhoto(uri: string, folder: string) {
  let width = 1400;
  let compress = 0.6;
  for (let i = 0; i < 5; i++) {
    const out = await manipulateAsync(uri, [{ resize: { width } }], { compress, format: SaveFormat.JPEG, base64: true });
    const data = `data:image/jpeg;base64,${out.base64}`;
    if (data.length <= MAX) {
      const id = await add('files', { data, name: `${folder}-${Date.now()}.jpg`, folder, created_by: auth?.currentUser?.uid || '', created_at: Date.now() });
      return `fsfile:${id}`;
    }
    width = Math.round(width * 0.75);
    compress = Math.max(0.35, compress - 0.1);
  }
  throw new Error('Photo is too large. Try another photo.');
}

const fileCache = new Map<string, string>();
// Returns something an <Image> or Linking can open.
export async function resolveFile(url: string) {
  if (!url?.startsWith('fsfile:')) return url;
  if (fileCache.has(url)) return fileCache.get(url)!;
  const doc = await get(`files/${url.slice(7)}`);
  const data = (doc?.data as string) || '';
  fileCache.set(url, data);
  return data;
}
