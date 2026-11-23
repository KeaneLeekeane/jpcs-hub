// Same Firebase project as the web portal (Firebase console > Project settings >
// Your apps > Web app config). These values identify the project; they are not
// secret. Access is protected by firestore.rules.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || '',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '',
};

// Optional TURN server for calls between different networks.
export const turn = {
  url: process.env.EXPO_PUBLIC_TURN_URL || '',
  username: process.env.EXPO_PUBLIC_TURN_USERNAME || '',
  credential: process.env.EXPO_PUBLIC_TURN_CREDENTIAL || '',
};

export const isConfigured = !!firebaseConfig.apiKey;

// Must match the web portal: usernames become "<username>@jpcshub.app".
export const USERNAME_DOMAIN = 'jpcshub.app';
