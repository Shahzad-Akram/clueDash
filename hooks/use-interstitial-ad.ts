import { useCallback } from 'react';
import { Platform } from 'react-native';

import adMobService from '@/lib/admob';
import { tryShowInterstitialWithinDailyCap } from '@/lib/interstitial-ad-gate';

/**
 * Game-completion interstitials, capped at 3 per user per day.
 * No-ops on web and in Expo Go (native ads module unavailable).
 */
export const useInterstitialAd = () => {
  const showInterstitialAfterGameComplete = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return false;
    }
    try {
      return await tryShowInterstitialWithinDailyCap(
        (opts) => adMobService.showInterstitialAdAndWaitForClose(opts),
        { timeoutMs: 8000 },
      );
    } catch {
      return false;
    }
  }, []);

  return { showInterstitialAfterGameComplete };
};
