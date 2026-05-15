import { doc, increment, runTransaction } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/app';
import { USERS_COLLECTION } from '@/lib/firebase/user-profile';

export const HINT_POINTS_COST = 20;
export const REVEAL_CLUE_POINTS_COST = 20;
/** Points awarded when the daily challenge is solved before the timer runs out. */
export const DAILY_CHALLENGE_WIN_POINTS = 100;

export type DeductPointsResult =
  | { ok: true; newPoints: number }
  | { ok: false; reason: 'insufficient' | 'missing_profile' | 'error' };

const readPoints = (raw: unknown): number => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string' && Number.isFinite(Number(raw))) {
    return Number(raw);
  }
  return 0;
};

/** Atomically deducts points if the user has enough balance. */
export const deductUserPoints = async (uid: string, amount: number): Promise<DeductPointsResult> => {
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { ok: false, reason: 'error' };
  }
  const db = getFirebaseDb();
  const userRef = doc(db, USERS_COLLECTION, uid);
  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) {
        return { ok: false, reason: 'missing_profile' };
      }
      const points = readPoints(snap.data()?.points);
      if (points < amount) {
        return { ok: false, reason: 'insufficient' };
      }
      transaction.update(userRef, { points: increment(-amount) });
      return { ok: true, newPoints: points - amount };
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
};

export type AwardPointsResult =
  | { ok: true; pointsAwarded: number }
  | { ok: false; reason: 'missing_profile' | 'error' };

/** Atomically adds points to the user's profile. */
export const awardUserPoints = async (uid: string, amount: number): Promise<AwardPointsResult> => {
  if (amount <= 0 || !Number.isFinite(amount)) {
    return { ok: false, reason: 'error' };
  }
  const db = getFirebaseDb();
  const userRef = doc(db, USERS_COLLECTION, uid);
  try {
    return await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(userRef);
      if (!snap.exists()) {
        return { ok: false, reason: 'missing_profile' };
      }
      transaction.update(userRef, { points: increment(amount) });
      return { ok: true, pointsAwarded: amount };
    });
  } catch {
    return { ok: false, reason: 'error' };
  }
};
