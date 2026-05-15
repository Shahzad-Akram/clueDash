import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState } from 'react';

import type { AppUserProfile } from '@/lib/firebase/user-profile';
import {
  deductUserPoints,
  HINT_POINTS_COST,
  REVEAL_CLUE_POINTS_COST,
} from '@/lib/firebase/points';
import { tryInitFirebase } from '@/lib/firebase';

type RefreshProfile = (opts?: { untilPointsAtLeast?: number }) => Promise<void>;

type UsePaidHintActionsOptions = {
  isLoggedIn: boolean;
  user: AppUserProfile | null;
  refreshProfile: RefreshProfile;
  isGameLocked: boolean;
  clueRevealed: boolean;
  clueEmojiRevealed: boolean;
  onHintRevealed: () => void;
  onEmojiRevealed: () => void;
};

export const usePaidHintActions = ({
  isLoggedIn,
  user,
  refreshProfile,
  isGameLocked,
  clueRevealed,
  clueEmojiRevealed,
  onHintRevealed,
  onEmojiRevealed,
}: UsePaidHintActionsOptions) => {
  const [spendingHint, setSpendingHint] = useState(false);
  const [spendingReveal, setSpendingReveal] = useState(false);

  const canUsePaidActions = isLoggedIn && Boolean(user?.uid);
  const userPoints = user?.points ?? 0;

  const hintDisabled = useMemo(
    () =>
      !canUsePaidActions ||
      isGameLocked ||
      clueRevealed ||
      spendingHint ||
      userPoints < HINT_POINTS_COST,
    [canUsePaidActions, clueRevealed, isGameLocked, spendingHint, userPoints],
  );

  const revealClueDisabled = useMemo(
    () =>
      !canUsePaidActions ||
      isGameLocked ||
      clueEmojiRevealed ||
      spendingReveal ||
      userPoints < REVEAL_CLUE_POINTS_COST,
    [canUsePaidActions, clueEmojiRevealed, isGameLocked, spendingReveal, userPoints],
  );

  const handleHintPress = useCallback(async () => {
    if (hintDisabled || !user?.uid) {
      return;
    }
    if (!tryInitFirebase()) {
      return;
    }
    setSpendingHint(true);
    try {
      const result = await deductUserPoints(user.uid, HINT_POINTS_COST);
      if (!result.ok) {
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onHintRevealed();
      await refreshProfile();
    } finally {
      setSpendingHint(false);
    }
  }, [hintDisabled, onHintRevealed, refreshProfile, user?.uid]);

  const handleRevealCluePress = useCallback(async () => {
    if (revealClueDisabled || !user?.uid) {
      return;
    }
    if (!tryInitFirebase()) {
      return;
    }
    setSpendingReveal(true);
    try {
      const result = await deductUserPoints(user.uid, REVEAL_CLUE_POINTS_COST);
      if (!result.ok) {
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onEmojiRevealed();
      await refreshProfile();
    } finally {
      setSpendingReveal(false);
    }
  }, [onEmojiRevealed, refreshProfile, revealClueDisabled, user?.uid]);

  return {
    hintDisabled,
    revealClueDisabled,
    handleHintPress,
    handleRevealCluePress,
    hintCost: HINT_POINTS_COST,
    revealClueCost: REVEAL_CLUE_POINTS_COST,
    canUsePaidActions,
  };
};
