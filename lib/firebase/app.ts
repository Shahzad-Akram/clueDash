import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

import { getFirebaseWebConfig, isFirebaseConfigComplete } from './config';

let appInstance: FirebaseApp | null = null;
let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

/** Throws if env is incomplete — see `.env.example`. */
export const getFirebaseApp = (): FirebaseApp => {
  if (appInstance) {
    return appInstance;
  }
  const config = getFirebaseWebConfig();
  if (!isFirebaseConfigComplete(config)) {
    throw new Error(
      '[Firebase] Missing EXPO_PUBLIC_FIREBASE_* variables. Copy .env.example to .env and fill in your Firebase web config, then restart Expo.',
    );
  }
  appInstance = getApps().length === 0 ? initializeApp(config) : getApp();
  return appInstance;
};

export const getFirebaseDb = (): Firestore => {
  if (dbInstance) {
    return dbInstance;
  }
  dbInstance = getFirestore(getFirebaseApp());
  return dbInstance;
};

export const getFirebaseAuth = (): Auth => {
  if (authInstance) {
    return authInstance;
  }
  authInstance = getAuth(getFirebaseApp());
  return authInstance;
};

/** Safe startup: no throw so the UI still loads if `.env` is missing. */
export const tryInitFirebase = (): boolean => {
  try {
    getFirebaseApp();
    return true;
  } catch {
    return false;
  }
};
