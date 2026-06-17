import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/contexts/auth-context';
import type { AppUserProfile } from '@/lib/firebase/user-profile';
import { tryInitFirebase } from '@/lib/firebase';
import { fetchLeaderboardUsers } from '@/lib/firebase/leaderboard-users';
import { getProfileAvatarSource, type ProfileAvatarId } from '@/lib/profile-avatars';

export type LeaderboardRow = {
  uid: string;
  rank: number;
  name: string;
  points: number;
  scoreLabel: string;
  avatarId: ProfileAvatarId;
  avatarSource: number;
  isYou: boolean;
};

const displayName = (profile: AppUserProfile): string => {
  const name = profile.name.trim();
  if (name.length > 0) {
    return name;
  }
  const emailLocal = profile.email.split('@')[0]?.trim();
  return emailLocal && emailLocal.length > 0 ? emailLocal : 'Player';
};

const mapProfilesToRows = (profiles: AppUserProfile[], currentUid?: string): LeaderboardRow[] =>
  profiles.map((profile, index) => ({
    uid: profile.uid,
    rank: index + 1,
    name: displayName(profile),
    points: profile.points,
    scoreLabel: profile.points.toLocaleString(),
    avatarId: profile.avatarId,
    avatarSource: getProfileAvatarSource(profile.avatarId),
    isYou: Boolean(currentUid && profile.uid === currentUid),
  }));

export const useLeaderboard = (maxCount = 50) => {
  const { user, isLoggedIn } = useAuth();
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (!tryInitFirebase()) {
      setRows([]);
      setError('Firebase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profiles = await fetchLeaderboardUsers(maxCount);
      setRows(mapProfilesToRows(profiles, user?.uid));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load leaderboard';
      setError(message);
      setRows([]);
      console.warn('[Leaderboard]', message, e);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, maxCount, user?.uid]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const topThree = useMemo(() => rows.slice(0, 3), [rows]);
  const rest = useMemo(() => rows.slice(3), [rows]);

  return { rows, topThree, rest, loading, error, refetch: load };
};
