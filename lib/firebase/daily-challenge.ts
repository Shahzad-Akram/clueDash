import { collection, getDocs, orderBy, query } from 'firebase/firestore';

import { getFirebaseDb } from './app';
import type { GuessPuzzleDoc } from './guesses';

const dailyChallengeCollection = () => collection(getFirebaseDb(), 'dailyChallenge');

/** Loads puzzles from the `dailyChallenge` Firestore collection (same fields as `guesses`). */
export const fetchDailyChallengePuzzlesOrdered = async (): Promise<GuessPuzzleDoc[]> => {
  const q = query(dailyChallengeCollection(), orderBy('sortOrder', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const x = docSnap.data();
    return {
      id: docSnap.id,
      phrase: String(x.phrase ?? ''),
      clue: String(x.clue ?? ''),
      category: String(x.category ?? '').toUpperCase(),
      clueEmoji: x.clueEmoji != null ? String(x.clueEmoji) : undefined,
      sortOrder: typeof x.sortOrder === 'number' ? x.sortOrder : Number(x.sortOrder ?? 0),
      difficulty:
        x.difficulty === 'easy' || x.difficulty === 'medium' || x.difficulty === 'hard'
          ? x.difficulty
          : undefined,
    };
  });
};
