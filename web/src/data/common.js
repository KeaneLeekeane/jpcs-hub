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
