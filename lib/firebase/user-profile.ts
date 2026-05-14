import { deleteUser, type User } from 'firebase/auth';
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';

/**
 * Firestore `users` collection — document ID = Firebase Auth `uid`.
 * Enable Email/Password in Firebase Console → Authentication → Sign-in method.
 *
 * Example rules (adjust for your app):
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId} {
 *       allow read: if request.auth != null && request.auth.uid == userId;
 *       allow create: if request.auth != null && request.auth.uid == userId;
 *       allow update: if request.auth != null && request.auth.uid == userId;
 *       allow delete: if false;
 *     }
 *     match /users/{userId}/solvedGuesses/{guessId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */

import type { Gender } from '@/lib/auth-types';
import { getFirebaseDb } from '@/lib/firebase/app';
import type { ProfileAvatarId } from '@/lib/profile-avatars';

/** Firestore collection for extended user data (Auth holds email/password). */
export const USERS_COLLECTION = 'users';

/** Points granted to every new account at signup. */
export const NEW_USER_POINTS = 300;

export type UserProfileDoc = {
  email: string;
  name: string;
  age: string;
  gender: Gender;
  avatarId: ProfileAvatarId;
  points: number;
};

export type AppUserProfile = UserProfileDoc & {
  uid: string;
};

const isGender = (v: unknown): v is Gender =>
  v === 'male' || v === 'female' || v === 'other' || v === 'prefer_not';

const isAvatarId = (v: unknown): v is ProfileAvatarId => v === 'user1' || v === 'user2' || v === 'user3';

export const parseUserProfileDoc = (uid: string, data: Record<string, unknown>, fallbackEmail: string): AppUserProfile => {
  const email = typeof data.email === 'string' ? data.email : fallbackEmail;
  const name = typeof data.name === 'string' ? data.name : '';
  const age = data.age !== undefined && data.age !== null ? String(data.age) : '';
  const gender = isGender(data.gender) ? data.gender : 'prefer_not';
  const avatarId = isAvatarId(data.avatarId) ? data.avatarId : 'user1';
  const rawPoints = data.points;
  const points =
    typeof rawPoints === 'number' && Number.isFinite(rawPoints)
      ? rawPoints
      : typeof rawPoints === 'string' && Number.isFinite(Number(rawPoints))
        ? Number(rawPoints)
        : NEW_USER_POINTS;

  return { uid, email, name, age, gender, avatarId, points };
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
  profile: Pick<UserProfileDoc, 'email' | 'name' | 'age' | 'gender' | 'avatarId'>,
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
