import { cloudinary, USERNAME_DOMAIN } from '../firebaseConfig';

export function toEmail(login) {
  const v = String(login || '').trim().toLowerCase();
  return v.includes('@') ? v : `${v}@${USERNAME_DOMAIN}`;
}

export const hasCloudinary = () => !!(cloudinary.cloudName && cloudinary.uploadPreset);

export async function uploadToCloudinary(file, folder) {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', cloudinary.uploadPreset);
  form.append('folder', `jpcs-hub/${folder}`);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudinary.cloudName}/auto/upload`, {
    method: 'POST', body: form,
  });
  if (!res.ok) throw new Error('Upload failed. Check the Cloudinary upload preset.');
  const json = await res.json();
  return { url: json.secure_url, name: file.name };
}

// ---- Free file storage -------------------------------------------------
// The free Firebase (Spark) plan has no Cloud Storage, so files are saved as
// compressed data inside Firestore (collection "files", up to ~900 KB each).
export const MAX_FILE_CHARS = 950_000;

export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Shrinks photos (receipts, proofs) so they fit: max 1600 px, JPEG.
export async function compressImage(file) {
  const src = await readAsDataURL(file);
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  let max = 1600;
  let quality = 0.8;
  for (let tries = 0; tries < 6; tries++) {
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL('image/jpeg', quality);
    if (out.length <= MAX_FILE_CHARS) return out;
    max = Math.round(max * 0.8);
    quality = Math.max(0.45, quality - 0.1);
  }
  throw new Error('This photo is too large even after compressing. Try a smaller photo.');
}

export async function fileToStorableDataURL(file) {
  if (file.type.startsWith('image/') && !file.type.includes('svg') && !file.type.includes('gif')) return compressImage(file);
  const data = await readAsDataURL(file);
  if (data.length > MAX_FILE_CHARS) {
    throw new Error('File is too large for the free plan (max about 700 KB). Compress the PDF/document or upload a photo instead.');
  }
  return data;
}

export const isStoredFile = (url) => typeof url === 'string' && url.startsWith('fsfile:');

export function dataURLToBlobURL(dataUrl) {
  const [head, b64] = dataUrl.split(',');
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime }));
}
