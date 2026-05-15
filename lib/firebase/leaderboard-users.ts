import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase/app';
import type { AppUserProfile } from '@/lib/firebase/user-profile';
import { parseUserProfileDoc, USERS_COLLECTION } from '@/lib/firebase/user-profile';

/** Leaderboard row from Firestore `users`, sorted by `points` descending. */
export const fetchLeaderboardUsers = async (maxCount = 50): Promise<AppUserProfile[]> => {
  const q = query(
    collection(getFirebaseDb(), USERS_COLLECTION),
    orderBy('points', 'desc'),
    limit(maxCount),
  );
  const snap = await getDocs(q);
  return snap.docs.map((docSnap) =>
    parseUserProfileDoc(docSnap.id, docSnap.data() as Record<string, unknown>, ''),
  );
};
