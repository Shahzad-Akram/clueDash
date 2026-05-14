export type ProfileAvatarId = 'user1' | 'user2' | 'user3';

export const PROFILE_AVATARS = [
  {
    id: 'user1' as const,
    source: require('@/assets/images/user1.png'),
    accessibilityLabel: 'Profile avatar one',
  },
  {
    id: 'user2' as const,
    source: require('@/assets/images/user2.png'),
    accessibilityLabel: 'Profile avatar two',
  },
  {
    id: 'user3' as const,
    source: require('@/assets/images/user3.png'),
    accessibilityLabel: 'Profile avatar three',
  },
] as const;

export const getProfileAvatarSource = (id: ProfileAvatarId) =>
  PROFILE_AVATARS.find((a) => a.id === id)?.source ?? PROFILE_AVATARS[0].source;
