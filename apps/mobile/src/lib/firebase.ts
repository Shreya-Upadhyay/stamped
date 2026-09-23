import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  getReactNativePersistence,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * The one place Firebase is created.
 *
 * Config comes from `EXPO_PUBLIC_FIREBASE_*` in `apps/mobile/.env` (see
 * `.env.example`). Those keys ship inside the app and are not secrets — they
 * identify the project, they don't authorise anything. What actually protects
 * the data is `firebase/firestore.rules`, which only lets a signed-in user
 * touch their own documents.
 *
 * Everything is optional: with no config the app still runs, `getFirebase()`
 * returns null, and the session reports itself unconfigured rather than
 * crashing on a white screen. That keeps the app testable before the Firebase
 * project exists.
 */
const config = {
  // Referenced one by one, not through a loop: Expo inlines EXPO_PUBLIC_*
  // variables at build time by matching the literal text, so a computed key
  // would come back undefined on a device.
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export type FirebaseServices = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
};

/** Whether the build carries a complete Firebase config. */
export const isFirebaseConfigured: boolean = Object.values(config).every(
  (value) => typeof value === 'string' && value.length > 0,
);

let services: FirebaseServices | null = null;

/**
 * The initialised services, or null when this build has no config.
 *
 * Memoised because `initializeApp` and `initializeAuth` both throw if called
 * twice, and Fast Refresh re-evaluates modules freely.
 */
export function getFirebase(): FirebaseServices | null {
  if (!isFirebaseConfigured) return null;
  if (services) return services;

  const app = getApps()[0] ?? initializeApp(config);

  // Without an explicit persistence, the Firebase JS SDK keeps the session in
  // memory on React Native and signs the user out on every reload — the exact
  // problem this whole change exists to fix.
  const auth = initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  const db = getFirestore(app);

  // Point at the local Firebase emulators when asked, so accounts and trips
  // can be exercised end to end without touching a real project — and without
  // a real project existing at all. `firebase emulators:start` from the repo
  // root; the host is 10.0.2.2 from an Android emulator, which is how it
  // reaches the machine's localhost.
  const emulatorHost = process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST;
  if (emulatorHost) {
    connectAuthEmulator(auth, `http://${emulatorHost}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emulatorHost, 8080);
  }

  services = { app, auth, db };
  return services;
}
