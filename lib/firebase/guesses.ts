import { collection, getDocs, getDocsFromServer, orderBy, query } from 'firebase/firestore';

import { getFirebaseDb } from './app';

/** Matches Firestore documents in the `guesses` collection and fields used by GuessTheNameGame. */
export type GuessPuzzleDoc = {
  id: string;
  phrase: string;
  clue: string;
  category: string;
  /** Shown in the clue box (decorative). */
  clueEmoji?: string;
  /** For ordering when loading many puzzles. */
  sortOrder: number;
  /** Optional — for future UI (filters, rewards). */
  difficulty?: 'easy' | 'medium' | 'hard';
};

const guessesCollection = () => collection(getFirebaseDb(), 'guesses');

export const fetchGuessPuzzlesOrdered = async (): Promise<GuessPuzzleDoc[]> => {
  const q = query(guessesCollection(), orderBy('sortOrder', 'asc'));
  // Prefer the server so seeded/updated puzzles aren't masked by stale offline cache.
  const snap = await (async () => {
    try {
      return await getDocsFromServer(q);
    } catch {
      return await getDocs(q);
    }
  })();
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
