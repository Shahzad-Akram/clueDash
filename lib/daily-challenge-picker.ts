import type { GuessPuzzle } from '@/contexts/guess-puzzles-context';
import {
  getLocalCalendarDateKey,
  type DailyChallengePersistedState,
  saveDailyChallengeState,
} from '@/lib/daily-challenge-storage';
import { getPuzzleFirestoreId } from '@/lib/firebase/guess-progress';

/** Deterministic index for a calendar day — same date always picks the same slot in the pool. */
export const pickDailyPuzzleIndex = (dateKey: string, poolSize: number): number => {
  if (poolSize <= 0) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash % poolSize;
};

export type ResolveDailyPuzzleResult = {
  puzzle: GuessPuzzle | null;
  /** Updated persisted state when a new puzzle was assigned for today. */
  persisted: DailyChallengePersistedState;
};

/**
 * Picks today's daily puzzle from the current guesses pool.
 * - Same calendar day → same puzzle (stable across app restarts).
 * - Reuses a stored assignment when still present in the pool.
 */
export const resolveDailyPuzzleForToday = async (
  pool: GuessPuzzle[],
  persisted: DailyChallengePersistedState,
  dateKey: string = getLocalCalendarDateKey(),
): Promise<ResolveDailyPuzzleResult> => {
  if (pool.length === 0) {
    return { puzzle: null, persisted };
  }

  const findInPool = (id: string | undefined): GuessPuzzle | undefined => {
    if (!id) {
      return undefined;
    }
    return pool.find((p) => getPuzzleFirestoreId(p) === id);
  };

  const assignedForToday =
    persisted.assignedPuzzleDate === dateKey ? persisted.assignedPuzzleId : undefined;
  const fromAssignment = findInPool(assignedForToday);
  if (fromAssignment) {
    return { puzzle: fromAssignment, persisted };
  }

  // Attempted today but assignment missing (older saves) — keep date-locked pick.
  if (persisted.dateOfAttempt === dateKey && persisted.assignedPuzzleId) {
    const fromAttempt = findInPool(persisted.assignedPuzzleId);
    if (fromAttempt) {
      return { puzzle: fromAttempt, persisted };
    }
  }

  const index = pickDailyPuzzleIndex(dateKey, pool.length);
  const puzzle = pool[index]!;
  const assignedPuzzleId = getPuzzleFirestoreId(puzzle);
  const nextPersisted: DailyChallengePersistedState = {
    ...persisted,
    assignedPuzzleId,
    assignedPuzzleDate: dateKey,
  };
  await saveDailyChallengeState(nextPersisted);
  return { puzzle, persisted: nextPersisted };
};
