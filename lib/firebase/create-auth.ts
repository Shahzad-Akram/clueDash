import type { FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

export const createFirebaseAuth = (app: FirebaseApp): Auth => getAuth(app);
