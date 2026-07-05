import AsyncStorage from '@react-native-async-storage/async-storage';
import type { FirebaseApp } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';

// Resolved to the React Native Firebase Auth bundle via metro.config.js.
import { getReactNativePersistence } from 'firebase/auth';

export const createFirebaseAuth = (app: FirebaseApp): Auth => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
};
