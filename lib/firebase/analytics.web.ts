import { getAnalytics, isSupported } from 'firebase/analytics';

import { getFirebaseApp } from './app';

/** Call only on web; Firebase Analytics requires a browser environment. */
export const tryInitFirebaseAnalytics = async (): Promise<void> => {
  if (!(await isSupported())) {
    return;
  }
  getAnalytics(getFirebaseApp());
};
