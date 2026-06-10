import { deleteUser, type User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

/**
 * Firestore `users` collection — document ID = Firebase Auth `uid`.
 * Enable Email/Password in Firebase Console → Authentication → Sign-in method.
 *
 * Example rules (adjust for your app):
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId} {
 *       // Leaderboard: any signed-in user may read all profiles (name, points, avatarId).
 *       allow read: if request.auth != null;
 *       allow create: if request.auth != null && request.auth.uid == userId;
 *       allow update: if request.auth != null && request.auth.uid == userId;
 *       // Account deletion: users may delete their own profile.
 *       allow delete: if request.auth != null && request.auth.uid == userId;
 *     }
 *     match /users/{userId}/solvedGuesses/{guessId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */

import { getFirebaseDb } from '@/lib/firebase/app';
import type { ProfileAvatarId } from '@/lib/profile-avatars';

/** Firestore collection for extended user data (Auth holds email/password). */
export const USERS_COLLECTION = 'users';

/** Points granted to every new account at signup. */
export const NEW_USER_POINTS = 300;

export type UserProfileDoc = {
  email: string;
  name: string;
  avatarId: ProfileAvatarId;
  points: number;
};

export type AppUserProfile = UserProfileDoc & {
  uid: string;
};

const isAvatarId = (v: unknown): v is ProfileAvatarId => v === 'user1' || v === 'user2' || v === 'user3';

export const parseUserProfileDoc = (uid: string, data: Record<string, unknown>, fallbackEmail: string): AppUserProfile => {
  const email = typeof data.email === 'string' ? data.email : fallbackEmail;
  const name = typeof data.name === 'string' ? data.name : '';
  const avatarId = isAvatarId(data.avatarId) ? data.avatarId : 'user1';
  const rawPoints = data.points;
  const points =
    typeof rawPoints === 'number' && Number.isFinite(rawPoints)
      ? rawPoints
      : typeof rawPoints === 'string' && Number.isFinite(Number(rawPoints))
        ? Number(rawPoints)
        : NEW_USER_POINTS;

  return { uid, email, name, avatarId, points };
};

export type FetchUserProfileOptions = {
  /**
   * Read from the Firestore server so UI reflects writes immediately after mutations
   * (default `getDoc` can return a stale cached document right after `increment`).
   */
  preferServer?: boolean;
};

export const fetchUserProfile = async (
  user: User,
  opts?: FetchUserProfileOptions,
): Promise<AppUserProfile | null> => {
  const ref = doc(getFirebaseDb(), USERS_COLLECTION, user.uid);
  const snap = opts?.preferServer
    ? await (async () => {
        try {
          return await getDocFromServer(ref);
        } catch {
          return await getDoc(ref);
        }
      })()
    : await getDoc(ref);
  if (!snap.exists()) {
    return null;
  }
  return parseUserProfileDoc(user.uid, snap.data() as Record<string, unknown>, user.email ?? '');
};

/** Used after sign-up: Firestore doc may appear shortly after Auth user creation. */
export const fetchUserProfileWithRetry = async (
  user: User,
  opts: { attempts: number; delayMs: number } = { attempts: 8, delayMs: 120 },
): Promise<AppUserProfile | null> => {
  for (let i = 0; i < opts.attempts; i++) {
    const profile = await fetchUserProfile(user);
    if (profile) {
      return profile;
    }
    if (i < opts.attempts - 1) {
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
  }
  return null;
};

export const createUserProfileDoc = async (
  user: User,
  profile: Pick<UserProfileDoc, 'email' | 'name' | 'avatarId'>,
): Promise<void> => {
  await setDoc(doc(getFirebaseDb(), USERS_COLLECTION, user.uid), {
    ...profile,
    points: NEW_USER_POINTS,
    createdAt: serverTimestamp(),
  });
};

/** If Firestore write fails after Auth account creation, remove the Auth user to avoid orphans. */
export const rollbackNewAuthUser = async (user: User): Promise<void> => {
  try {
    await deleteUser(user);
  } catch {
    // best-effort
  }
};

/**
 * Permanently deletes the user's data and Firebase Auth account:
 * solved-puzzle progress → profile doc → Auth user (last, since Firestore
 * rules require an authenticated request).
 *
 * May throw `auth/requires-recent-login` — Firebase requires a recent sign-in
 * for account deletion; the caller should ask the user to log in again.
 */
export const deleteUserAccount = async (user: User): Promise<void> => {
  const db = getFirebaseDb();

  const solvedSnap = await getDocs(collection(db, USERS_COLLECTION, user.uid, 'solvedGuesses'));
  await Promise.all(solvedSnap.docs.map((d) => deleteDoc(d.ref)));

  await deleteDoc(doc(db, USERS_COLLECTION, user.uid));
  await deleteUser(user);
};
