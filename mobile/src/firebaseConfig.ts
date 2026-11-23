// Same Firebase project as the web portal (Firebase console > Project settings >
// Your apps > Web app config). These values identify the project; they are not
// secret. Access is protected by firestore.rules.
export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCF4JNbMpbwmBrsG5NRvqTq8Dp9IBdYKcs',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'jpcs-hub-e1240.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'jpcs-hub-e1240',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'jpcs-hub-e1240.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '732408659586',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:732408659586:web:221e681f89cdb1627fbe9b',
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
