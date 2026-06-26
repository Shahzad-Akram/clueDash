import { useCallback, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import { tryInitFirebase } from '@/lib/firebase';
import { loadGeneralGameStreakState } from '@/lib/general-game-streak-storage';
import { processStreakMilestones } from '@/lib/streak-rewards';

export const useStreakRewards = () => {
  const { user, isLoggedIn, refreshProfile } = useAuth();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [generalMaxStreak, setGeneralMaxStreak] = useState(0);
  const [claimedRewardMilestones, setClaimedRewardMilestones] = useState<number[]>([]);
  const [rewardsModalVisible, setRewardsModalVisible] = useState(false);

  const applyState = useCallback((state: Awaited<ReturnType<typeof loadGeneralGameStreakState>>) => {
    setCurrentStreak(state.currentStreak);
    setGeneralMaxStreak(state.generalMaxStreak);
    setClaimedRewardMilestones(state.claimedRewardMilestones);
  }, []);

  const refreshStreakRewards = useCallback(async (): Promise<{ totalAwarded: number }> => {
    const generalState = await loadGeneralGameStreakState();
    applyState(generalState);

    if (!isLoggedIn || !user?.uid || !tryInitFirebase()) {
      return { totalAwarded: 0 };
    }

    const { state, totalAwarded } = await processStreakMilestones(user.uid);
    applyState(state);

    if (totalAwarded > 0) {
      await refreshProfile({
        untilPointsAtLeast: (user.points ?? 0) + totalAwarded,
      });
    }

    return { totalAwarded };
  }, [applyState, isLoggedIn, refreshProfile, user?.points, user?.uid]);

  const openRewards = useCallback(() => {
    void refreshStreakRewards().then(() => {
      setRewardsModalVisible(true);
    });
  }, [refreshStreakRewards]);

  const closeRewards = useCallback(() => {
    setRewardsModalVisible(false);
  }, []);

  const syncOnFocus = useCallback(() => {
    void refreshStreakRewards();
  }, [refreshStreakRewards]);

  return {
    currentStreak,
    generalMaxStreak,
    claimedRewardMilestones,
    rewardsModalVisible,
    openRewards,
    closeRewards,
    refreshStreakRewards,
    syncOnFocus,
    isLoggedIn,
  };
};
