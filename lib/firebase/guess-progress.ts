import { collection, doc, getDocs, increment, runTransaction, serverTimestamp } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/app';
import { USERS_COLLECTION } from '@/lib/firebase/user-profile';

/** Points added to the user's Firestore profile when they solve a phrase (first time only). */
export const POINTS_PER_SOLVED_PHRASE = 50;

const normalizePhraseKey = (phrase: string) =>
  phrase
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const hashPhrase = (normalized: string): string => {
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (Math.imul(31, h) + normalized.charCodeAt(i)) | 0;
  }
  return `fb_${(h >>> 0).toString(16)}`;
};

/**
 * Stable id for Firestore: use `guesses` document id when present, else a deterministic hash
 * (offline / fallback puzzles).
 */
export const getPuzzleFirestoreId = (puzzle: { id?: string; phrase: string }): string => {
  if (puzzle.id && puzzle.id.trim().length > 0) {
    return puzzle.id;
  }
  return hashPhrase(normalizePhraseKey(puzzle.phrase));
};

const solvedGuessesCollection = (uid: string) => collection(getFirebaseDb(), USERS_COLLECTION, uid, 'solvedGuesses');

/** All puzzle ids this user has already solved (for filtering the play queue). */
export const fetchSolvedGuessIds = async (uid: string): Promise<Set<string>> => {
  try {
    const snap = await getDocs(solvedGuessesCollection(uid));
    return new Set(snap.docs.map((d) => d.id));
  } catch {
    return new Set();
  }
};

/**
 * Marks a phrase solved for this user and awards points once.
 * Idempotent: second call for the same `puzzleId` returns `pointsAwarded: 0`.
 */
export const recordPuzzleSolved = async (
  uid: string,
  puzzleId: string,
): Promise<{ pointsAwarded: number }> => {
  const db = getFirebaseDb();
  const solvedRef = doc(db, USERS_COLLECTION, uid, 'solvedGuesses', puzzleId);
  const userRef = doc(db, USERS_COLLECTION, uid);

  return runTransaction(db, async (transaction) => {
    const solvedSnap = await transaction.get(solvedRef);
    if (solvedSnap.exists()) {
      return { pointsAwarded: 0 };
    }
    transaction.set(solvedRef, {
      puzzleId,
      solvedAt: serverTimestamp(),
    });
    transaction.update(userRef, {
      points: increment(POINTS_PER_SOLVED_PHRASE),
    });
    return { pointsAwarded: POINTS_PER_SOLVED_PHRASE };
  });
};
