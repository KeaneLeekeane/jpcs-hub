// Firebase web app config (Firebase console > Project settings > Your apps > Web app).
// These values identify the project; they are not secret. Access is protected by
// firestore.rules in the repo root.
//
// Project: JPCS HUB (jpcs-hub-e1240).
// While apiKey is empty the portal runs in DEMO MODE: data is kept in this
// browser only, so you can try every screen without a Firebase project.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCF4JNbMpbwmBrsG5NRvqTq8Dp9IBdYKcs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jpcs-hub-e1240.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jpcs-hub-e1240',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jpcs-hub-e1240.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '732408659586',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:732408659586:web:221e681f89cdb1627fbe9b',
};

// Optional: free Cloudinary account for receipt photos and documents
// (Settings > Upload > add an *unsigned* upload preset). When both are set,
// uploads go to Cloudinary; otherwise they go to Firebase Storage (Blaze plan).
export const cloudinary = {
  cloudName: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || '',
  uploadPreset: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || '',
};

// Optional TURN server for video calls between different networks
// (e.g. student on mobile data, officer on school Wi-Fi).
export const turn = {
  url: import.meta.env.VITE_TURN_URL || '',
  username: import.meta.env.VITE_TURN_USERNAME || '',
  credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
};

// Set VITE_DEMO=1 to force demo mode (sample data in the browser, no internet needed).
export const isDemoMode = !firebaseConfig.apiKey || import.meta.env.VITE_DEMO === '1';

// Usernames are turned into login e-mails so users can sign in with
// "admin", "treasurer", a student number, etc.
export const USERNAME_DOMAIN = 'jpcshub.app';
