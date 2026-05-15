import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { getFirebaseDb } from './app';

export { getFirebaseApp, getFirebaseAuth, getFirebaseDb, tryInitFirebase } from './app';
export { fetchDailyChallengePuzzlesOrdered } from './daily-challenge';
export { fetchGuessPuzzlesOrdered, type GuessPuzzleDoc } from './guesses';
export {
  POINTS_PER_SOLVED_PHRASE,
  fetchSolvedGuessIds,
  getPuzzleFirestoreId,
  recordPuzzleSolved,
} from './guess-progress';
export { fetchLeaderboardUsers } from './leaderboard-users';

/** Example Firestore helpers — set Security Rules in Firebase console before production. */
export type LeaderboardEntry = {
  name: string;
  score: number;
};

const leaderboardCollection = () => collection(getFirebaseDb(), 'leaderboard');

export const addLeaderboardEntry = async (entry: LeaderboardEntry): Promise<void> => {
  await addDoc(leaderboardCollection(), {
    ...entry,
    createdAt: serverTimestamp(),
  });
};

export const fetchTopLeaderboard = async (maxCount = 10): Promise<(LeaderboardEntry & { id: string })[]> => {
  const q = query(leaderboardCollection(), orderBy('score', 'desc'), limit(maxCount));
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as LeaderboardEntry;
    return { id: docSnap.id, name: data.name, score: data.score };
  });
};
