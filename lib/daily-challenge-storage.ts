import AsyncStorage from '@react-native-async-storage/async-storage';

export const DAILY_CHALLENGE_STORAGE_KEY = '@GuessUp/daily_challenge_v1';

/** Persisted daily challenge progress (AsyncStorage — same role as localStorage on web). */
export type DailyChallengePersistedState = {
  attempted: boolean;
  /** Local calendar date `YYYY-MM-DD` of the last completed attempt (win or loss). */
  dateOfAttempt: string;
  /** Consecutive **win** days; resets to 0 on a loss. */
  streak: number;
  /** Local calendar date `YYYY-MM-DD` of the last **win** (for streak math). */
  lastWinDate?: string;
  /** Firestore/hash id of the puzzle assigned for `assignedPuzzleDate`. */
  assignedPuzzleId?: string;
  /** Local calendar date when `assignedPuzzleId` was chosen. */
  assignedPuzzleDate?: string;
};

export const getLocalCalendarDateKey = (d = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** True if `beforeYmd` is the calendar day immediately before `afterYmd` (local time). */
export const isPreviousCalendarDay = (beforeYmd: string, afterYmd: string): boolean => {
  const [y, m, d] = afterYmd.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return getLocalCalendarDateKey(dt) === beforeYmd;
};

export const defaultDailyChallengeState = (): DailyChallengePersistedState => ({
  attempted: false,
  dateOfAttempt: '',
  streak: 0,
});

export const loadDailyChallengeState = async (): Promise<DailyChallengePersistedState> => {
  try {
    const raw = await AsyncStorage.getItem(DAILY_CHALLENGE_STORAGE_KEY);
    if (!raw) {
      return defaultDailyChallengeState();
    }
    const parsed = JSON.parse(raw) as Partial<DailyChallengePersistedState>;
    return {
      attempted: Boolean(parsed.attempted),
      dateOfAttempt: typeof parsed.dateOfAttempt === 'string' ? parsed.dateOfAttempt : '',
      streak: typeof parsed.streak === 'number' && !Number.isNaN(parsed.streak) ? parsed.streak : 0,
      lastWinDate: typeof parsed.lastWinDate === 'string' ? parsed.lastWinDate : undefined,
      assignedPuzzleId: typeof parsed.assignedPuzzleId === 'string' ? parsed.assignedPuzzleId : undefined,
      assignedPuzzleDate: typeof parsed.assignedPuzzleDate === 'string' ? parsed.assignedPuzzleDate : undefined,
    };
  } catch {
    return defaultDailyChallengeState();
  }
};

export const saveDailyChallengeState = async (state: DailyChallengePersistedState): Promise<void> => {
  await AsyncStorage.setItem(DAILY_CHALLENGE_STORAGE_KEY, JSON.stringify(state));
};

/** Removes persisted daily challenge data (e.g. dev reset). */
export const clearDailyChallengeState = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(DAILY_CHALLENGE_STORAGE_KEY);
  } catch (e) {
    console.warn('[DailyChallengeStorage] clear failed', e);
  }
};
