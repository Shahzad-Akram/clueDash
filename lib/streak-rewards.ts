import { awardUserPoints } from '@/lib/firebase/points';
import {
  loadGeneralGameStreakState,
  saveGeneralGameStreakState,
  type GeneralGameStreakState,
} from '@/lib/general-game-streak-storage';

/** Points for hitting a 5-in-a-row solve streak. */
export const STREAK_REWARD_5_POINTS = 250;

/** Points for every other streak reward milestone. */
export const STREAK_REWARD_STANDARD_POINTS = 500;

/** Milestones shown in the rewards modal before the recurring rule. */
export const STREAK_REWARD_DISPLAY_MILESTONES = [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100] as const;

export const getPointsForStreakMilestone = (streak: number): number | null => {
  if (streak === 5) {
    return STREAK_REWARD_5_POINTS;
  }
  if (streak === 10 || streak === 15 || streak === 20) {
    return STREAK_REWARD_STANDARD_POINTS;
  }
  if (streak > 20 && streak % 10 === 0) {
    return STREAK_REWARD_STANDARD_POINTS;
  }
  return null;
};

export const isStreakRewardMilestone = (streak: number): boolean =>
  getPointsForStreakMilestone(streak) !== null;

/** All reward milestones the player has reached at or below `maxStreak`. */
export const getEarnedStreakMilestones = (maxStreak: number): number[] => {
  const milestones: number[] = [];
  for (const milestone of [5, 10, 15, 20]) {
    if (maxStreak >= milestone) {
      milestones.push(milestone);
    }
  }
  for (let milestone = 30; milestone <= maxStreak; milestone += 10) {
    milestones.push(milestone);
  }
  return milestones;
};

const getUnclaimedMilestones = (maxStreak: number, claimed: number[]): number[] => {
  const claimedSet = new Set(claimed);
  return getEarnedStreakMilestones(maxStreak).filter((milestone) => !claimedSet.has(milestone));
};

export type ProcessStreakRewardsResult = {
  state: GeneralGameStreakState;
  totalAwarded: number;
  newlyClaimed: number[];
};

/**
 * Awards any unclaimed streak milestones up to `generalMaxStreak` for a signed-in user.
 * Idempotent per milestone via persisted `claimedRewardMilestones`.
 */
export const processStreakMilestones = async (uid: string): Promise<ProcessStreakRewardsResult> => {
  const state = await loadGeneralGameStreakState();
  const unclaimed = getUnclaimedMilestones(state.generalMaxStreak, state.claimedRewardMilestones);

  if (unclaimed.length === 0) {
    return { state, totalAwarded: 0, newlyClaimed: [] };
  }

  let totalAwarded = 0;
  const newlyClaimed: number[] = [];
  const claimedRewardMilestones = [...state.claimedRewardMilestones];

  for (const milestone of unclaimed) {
    const points = getPointsForStreakMilestone(milestone);
    if (!points) {
      continue;
    }
    const result = await awardUserPoints(uid, points);
    if (!result.ok) {
      break;
    }
    totalAwarded += points;
    newlyClaimed.push(milestone);
    claimedRewardMilestones.push(milestone);
  }

  if (newlyClaimed.length === 0) {
    return { state, totalAwarded: 0, newlyClaimed: [] };
  }

  const nextState: GeneralGameStreakState = {
    ...state,
    claimedRewardMilestones: [...new Set(claimedRewardMilestones)].sort((a, b) => a - b),
  };
  await saveGeneralGameStreakState(nextState);

  return { state: nextState, totalAwarded, newlyClaimed };
};
