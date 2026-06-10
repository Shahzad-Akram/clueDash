import AsyncStorage from '@react-native-async-storage/async-storage';

import { getLocalCalendarDateKey } from '@/lib/daily-challenge-storage';

export const INTERSTITIAL_AD_GATE_STORAGE_KEY = '@numtease/interstitial_ad_gate_v1';

/** Max interstitials per user per day (resets at local midnight). */
export const MAX_INTERSTITIALS_PER_DAY = 3;

type AdGatePersistedState = {
  /** Local calendar date `YYYY-MM-DD` the counter belongs to. */
  date: string;
  /** Interstitials shown on `date`. */
  count: number;
};

const loadAdGateState = async (): Promise<AdGatePersistedState> => {
  const today = getLocalCalendarDateKey();
  try {
    const raw = await AsyncStorage.getItem(INTERSTITIAL_AD_GATE_STORAGE_KEY);
    if (!raw) {
      return { date: today, count: 0 };
    }
    const parsed = JSON.parse(raw) as Partial<AdGatePersistedState>;
    if (parsed.date !== today || typeof parsed.count !== 'number' || Number.isNaN(parsed.count)) {
      return { date: today, count: 0 };
    }
    return { date: today, count: parsed.count };
  } catch {
    return { date: today, count: 0 };
  }
};

const saveAdGateState = async (state: AdGatePersistedState): Promise<void> => {
  try {
    await AsyncStorage.setItem(INTERSTITIAL_AD_GATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: worst case the user sees one extra ad.
  }
};

export const getInterstitialsRemainingToday = async (): Promise<number> => {
  const { count } = await loadAdGateState();
  return Math.max(0, MAX_INTERSTITIALS_PER_DAY - count);
};

/**
 * Shows an interstitial only if the daily cap (3/day) hasn't been reached.
 * Counts toward the cap only when an ad actually shows.
 *
 * @returns true if an ad was shown.
 */
export const tryShowInterstitialWithinDailyCap = async (
  showAdAndWaitForClose: (opts?: { timeoutMs?: number }) => Promise<boolean>,
  opts: { timeoutMs?: number } = {},
): Promise<boolean> => {
  const state = await loadAdGateState();
  if (state.count >= MAX_INTERSTITIALS_PER_DAY) {
    return false;
  }

  let shown = false;
  try {
    shown = await showAdAndWaitForClose(opts);
  } catch {
    shown = false;
  }

  if (shown) {
    await saveAdGateState({ date: state.date, count: state.count + 1 });
  }
  return shown;
};
