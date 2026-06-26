import AsyncStorage from '@react-native-async-storage/async-storage';

export const GENERAL_GAME_STREAK_STORAGE_KEY = '@GuessUp/general_game_streak_v1';

/** Consecutive puzzle wins in random mix / category modes (not difficulty). */
export type GeneralGameStreakState = {
  /** Active run of consecutive wins; resets to 0 on a loss. */
  currentStreak: number;
  /** All-time best consecutive wins; only increases when the current run beats it. */
  generalMaxStreak: number;
  /** Streak reward milestones already paid out (e.g. 5, 10, 15). */
  claimedRewardMilestones: number[];
};

export const defaultGeneralGameStreakState = (): GeneralGameStreakState => ({
  currentStreak: 0,
  generalMaxStreak: 0,
  claimedRewardMilestones: [],
});

const parseStreakCount = (raw: unknown): number => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.round(raw));
};

export const loadGeneralGameStreakState = async (): Promise<GeneralGameStreakState> => {
  try {
    const raw = await AsyncStorage.getItem(GENERAL_GAME_STREAK_STORAGE_KEY);
    if (!raw) {
      return defaultGeneralGameStreakState();
    }
    const parsed = JSON.parse(raw) as Partial<GeneralGameStreakState>;
    return {
      currentStreak: parseStreakCount(parsed.currentStreak),
      generalMaxStreak: parseStreakCount(parsed.generalMaxStreak),
      claimedRewardMilestones: Array.isArray(parsed.claimedRewardMilestones)
        ? parsed.claimedRewardMilestones
            .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
            .map((value) => Math.max(0, Math.round(value)))
        : [],
    };
  } catch {
    return defaultGeneralGameStreakState();
  }
};

export const saveGeneralGameStreakState = async (state: GeneralGameStreakState): Promise<void> => {
  await AsyncStorage.setItem(GENERAL_GAME_STREAK_STORAGE_KEY, JSON.stringify(state));
};

/** Increment the active streak after a win; update `generalMaxStreak` when the record is broken. */
export const recordGeneralGameWin = async (): Promise<GeneralGameStreakState> => {
  const prev = await loadGeneralGameStreakState();
  const currentStreak = prev.currentStreak + 1;
  const generalMaxStreak = Math.max(prev.generalMaxStreak, currentStreak);
  const next: GeneralGameStreakState = {
    currentStreak,
    generalMaxStreak,
    claimedRewardMilestones: prev.claimedRewardMilestones,
  };
  await saveGeneralGameStreakState(next);
  return next;
};

/** Reset the active streak after a loss. `generalMaxStreak` is unchanged. */
export const recordGeneralGameLoss = async (): Promise<GeneralGameStreakState> => {
  const prev = await loadGeneralGameStreakState();
  if (prev.currentStreak === 0) {
    return prev;
  }
  const next: GeneralGameStreakState = { ...prev, currentStreak: 0 };
  await saveGeneralGameStreakState(next);
  return next;
};
