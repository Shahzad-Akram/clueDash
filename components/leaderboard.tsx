import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';
import { useLeaderboard, type LeaderboardRow } from '@/hooks/use-leaderboard';

type LeaderTab = 'global' | 'friends' | 'weekly';

type PodiumSlotStyle = {
  place: 1 | 2 | 3;
  podiumColor: string;
  podiumBorder: string;
  podiumHeight: number;
  badgeImage: number;
};

const PODIUM_SLOT_STYLES: PodiumSlotStyle[] = [
  {
    place: 2,
    podiumColor: '#C5D9E8',
    podiumBorder: '#8FA8BC',
    podiumHeight: 100,
    badgeImage: require('@/assets/images/rank2.png'),
  },
  {
    place: 1,
    podiumColor: '#FFD54F',
    podiumBorder: '#E6A800',
    podiumHeight: 132,
    badgeImage: require('@/assets/images/rank1.png'),
  },
  {
    place: 3,
    podiumColor: '#E8B89A',
    podiumBorder: '#C67D52',
    podiumHeight: 82,
    badgeImage: require('@/assets/images/rank3.png'),
  },
];

type PodiumDisplaySlot = PodiumSlotStyle & {
  player: LeaderboardRow | null;
};

/** Visual order: 2nd (left), 1st (center), 3rd (right) — each slot keeps its rank badge. */
const PODIUM_VISUAL_ORDER: Array<1 | 2 | 3> = [2, 1, 3];

const buildPodiumDisplay = (topThree: LeaderboardRow[]): PodiumDisplaySlot[] => {
  const byRank = new Map(topThree.map((player) => [player.rank, player] as const));
  return PODIUM_VISUAL_ORDER.map((place) => {
    const slot = PODIUM_SLOT_STYLES.find((s) => s.place === place)!;
    return {
      ...slot,
      player: byRank.get(place) ?? null,
    };
  });
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  current: number;
  total: number;
  reward: string;
  accent: string;
  trackBg: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
};

const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'hunter',
    title: 'Word Hunter',
    description: 'Find 200 words in any mode',
    current: 150,
    total: 200,
    reward: '+150',
    accent: '#1E88E5',
    trackBg: '#BBDEFB',
    icon: 'alphabetical-variant',
  },
  {
    id: 'clue',
    title: 'Clue Master',
    description: 'Reveal 100 letters',
    current: 72,
    total: 100,
    reward: '+200',
    accent: '#43A047',
    trackBg: '#C8E6C9',
    icon: 'lightbulb-on',
  },
  {
    id: 'champ',
    title: 'Puzzle Champion',
    description: 'Win 25 games in any mode',
    current: 18,
    total: 25,
    reward: '+250',
    accent: '#FB8C00',
    trackBg: '#FFE0B2',
    icon: 'trophy',
  },
];

const LeaderboardScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isHydrated, isLoggedIn } = useAuth();
  const { topThree, rest, loading, error } = useLeaderboard(50);
  const podiumDisplay = useMemo(() => buildPodiumDisplay(topThree), [topThree]);
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [tab, setTab] = useState<LeaderTab>('global');

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  useEffect(() => {
    if (!isHydrated || isLoggedIn) {
      return;
    }
    router.replace('/login');
  }, [isHydrated, isLoggedIn, router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTabPress = useCallback((next: LeaderTab) => {
    setTab(next);
  }, []);

  if (!isHydrated || !isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AppScreenHeader title="LEADERBOARD" onBack={handleBack} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2A93F4" accessibilityLabel="Loading leaderboard" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <AppScreenHeader title="LEADERBOARD" onBack={handleBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(16, insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled>
          <View style={styles.body}>
          <View style={styles.scopeTabs}>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'global' }}
              accessibilityLabel="Global leaderboard"
              onPress={() => handleTabPress('global')}
              style={[styles.scopePill, tab === 'global' && styles.scopePillActive]}>
              <MaterialCommunityIcons
                name="earth"
                size={18}
                color={tab === 'global' ? '#FFFFFF' : '#5D4037'}
              />
              <Text
                style={[
                  styles.scopePillText,
                  tab === 'global' && styles.scopePillTextActive,
                  bodyFont,
                  !fontsLoaded && styles.fontFallbackSemi,
                ]}>
                Global
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'friends' }}
              accessibilityLabel="Friends leaderboard"
              onPress={() => handleTabPress('friends')}
              style={[styles.scopePill, tab === 'friends' && styles.scopePillActive]}>
              <MaterialCommunityIcons
                name="account-group"
                size={18}
                color={tab === 'friends' ? '#FFFFFF' : '#5D4037'}
              />
              <Text
                style={[
                  styles.scopePillText,
                  tab === 'friends' && styles.scopePillTextActive,
                  bodyFont,
                  !fontsLoaded && styles.fontFallbackSemi,
                ]}>
                Friends
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === 'weekly' }}
              accessibilityLabel="Weekly leaderboard"
              onPress={() => handleTabPress('weekly')}
              style={[styles.scopePill, tab === 'weekly' && styles.scopePillActive]}>
              <MaterialCommunityIcons
                name="calendar-week"
                size={18}
                color={tab === 'weekly' ? '#FFFFFF' : '#5D4037'}
              />
              <Text
                style={[
                  styles.scopePillText,
                  tab === 'weekly' && styles.scopePillTextActive,
                  bodyFont,
                  !fontsLoaded && styles.fontFallbackSemi,
                ]}>
                Weekly
              </Text>
            </Pressable>
          </View>

          {tab !== 'global' ? (
            <Text style={[styles.tabPlaceholder, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              {tab === 'friends'
                ? 'Friends leaderboard is coming soon. Use Global to see top players by points.'
                : 'Weekly leaderboard is coming soon. Use Global to see top players by points.'}
            </Text>
          ) : loading ? (
            <ActivityIndicator
              style={styles.leaderboardLoading}
              color="#2A93F4"
              accessibilityLabel="Loading leaderboard"
            />
          ) : error ? (
            <Text style={[styles.tabPlaceholder, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>{error}</Text>
          ) : topThree.length === 0 ? (
            <Text style={[styles.tabPlaceholder, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              No players on the board yet. Play games to earn points and appear here!
            </Text>
          ) : (
            <>
          <View style={styles.podiumRow}>
            {podiumDisplay.map((p) => {
              if (!p.player) {
                return <View key={`podium-empty-${p.place}`} style={styles.podiumColEmpty} />;
              }
              return (
              <View
                key={p.player.uid}
                style={[styles.podiumCol, p.place === 1 && styles.podiumColCenter]}
                accessibilityLabel={`Rank ${p.place}, ${p.player.name}, ${p.player.scoreLabel} points`}>
                <View style={styles.podiumAvatarBlock}>
                  {p.place === 1 ? (
                    <View style={styles.crownWrap} accessibilityElementsHidden>
                      <MaterialCommunityIcons name="crown" size={22} color="#FFD700" />
                    </View>
                  ) : (
                    <View style={styles.crownSpacer} />
                  )}
                  <Image
                    source={p.player.avatarSource}
                    style={[styles.podiumAvatar, p.place === 1 && styles.podiumAvatarFirst]}
                    contentFit="cover"
                    accessibilityLabel={p.player.name}
                  />
                </View>
                <Text
                  style={[styles.podiumName, titleFont, !fontsLoaded && styles.fontFallbackBold]}
                  numberOfLines={1}>
                  {p.player.name}
                </Text>
                <View style={styles.podiumScoreRow}>
                  <Image
                    source={require('@/assets/images/star.png')}
                    style={styles.podiumStar}
                    contentFit="contain"
                    accessible={false}
                  />
                  <Text style={[styles.podiumScore, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
                    {p.player.scoreLabel}
                  </Text>
                </View>
                <View
                  style={[
                    styles.podiumStand,
                    {
                      height: p.podiumHeight,
                      backgroundColor: p.podiumColor,
                      borderColor: p.podiumBorder,
                    },
                  ]}>
                  <Image source={p.badgeImage} style={styles.podiumRankBadge} contentFit="contain" accessibilityLabel={`Rank ${p.place}`} />
                </View>
              </View>
              );
            })}
          </View>

          <View style={styles.listCard}>
            {rest.length === 0 ? (
              <Text style={[styles.listEmpty, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                No more players to show.
              </Text>
            ) : (
              rest.map((row, index) => (
              <View
                key={row.uid}
                style={[
                  styles.listRow,
                  index < rest.length - 1 && styles.listRowDivider,
                  row.isYou && styles.listRowYou,
                ]}>
                <Text style={[styles.listRank, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>{row.rank}</Text>
                <Image source={row.avatarSource} style={styles.listAvatar} contentFit="cover" accessibilityLabel={row.name} />
                <View style={styles.listNameCol}>
                  <View style={styles.listNameRow}>
                    <Text style={[styles.listName, titleFont, !fontsLoaded && styles.fontFallbackBold]} numberOfLines={1}>
                      {row.name}
                    </Text>
                    {row.isYou ? (
                      <View style={styles.youTag}>
                        <Text style={[styles.youTagText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>You</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.listScoreWrap}>
                  <Image
                    source={require('@/assets/images/star.png')}
                    style={styles.listStar}
                    contentFit="contain"
                    accessible={false}
                  />
                  <Text style={[styles.listScore, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
                    {row.scoreLabel}
                  </Text>
                </View>
              </View>
              ))
            )}
          </View>
            </>
          )}

          <View style={styles.achievementsBanner}>
            <MaterialCommunityIcons name="star-four-points" size={16} color="#FFF176" style={styles.sparkle} />
            <Text style={[styles.achievementsTitle, titleFont, !fontsLoaded && styles.fontFallbackBold]}>ACHIEVEMENTS</Text>
            <MaterialCommunityIcons name="star-four-points" size={16} color="#FFF176" style={styles.sparkle} />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.achievementsRow}
            accessibilityRole="list">
            {ACHIEVEMENTS.map((a) => {
              const progress = a.total > 0 ? Math.min(1, a.current / a.total) : 0;
              return (
                <View key={a.id} style={styles.achievementCard} accessibilityRole="summary">
                  <View style={[styles.achievementIconWrap, { borderColor: a.accent }]}>
                    <MaterialCommunityIcons name={a.icon} size={28} color={a.accent} />
                  </View>
                  <Text style={[styles.achievementCardTitle, titleFont, !fontsLoaded && styles.fontFallbackBold]} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <Text style={[styles.achievementDesc, bodyFont, !fontsLoaded && styles.fontFallbackSemi]} numberOfLines={3}>
                    {a.description}
                  </Text>
                  <View style={[styles.achievementTrack, { backgroundColor: a.trackBg }]}>
                    <View style={[styles.achievementFill, { width: `${Math.round(progress * 100)}%`, backgroundColor: a.accent }]} />
                    <Text style={[styles.achievementProgressLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                      {a.current}/{a.total}
                    </Text>
                  </View>
                  <View style={styles.achievementRewardRow}>
                    <Text style={[styles.achievementReward, titleFont, !fontsLoaded && styles.fontFallbackBold]}>{a.reward}</Text>
                    <Image
                      source={require('@/assets/images/star.png')}
                      style={styles.achievementStar}
                      contentFit="contain"
                      accessible={false}
                    />
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <Text style={[styles.footerNote, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Leaderboards reset every Sunday at 12:00 AM (UTC).
          </Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default LeaderboardScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  body: {
    paddingHorizontal: 14,
  },
  leaderboardLoading: {
    paddingVertical: 32,
  },
  tabPlaceholder: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    paddingVertical: 28,
    paddingHorizontal: 12,
  },
  listEmpty: {
    textAlign: 'center',
    color: '#5A3A0A',
    fontSize: 14,
    paddingVertical: 14,
  },
  scopeTabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF8EF',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  scopePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 18,
  },
  scopePillActive: {
    backgroundColor: '#2A93F4',
    borderWidth: 2,
    borderColor: '#1B6ED4',
  },
  scopePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#5D4037',
  },
  scopePillTextActive: {
    color: '#FFFFFF',
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 120,
  },
  podiumColCenter: {
    maxWidth: 128,
    zIndex: 1,
  },
  podiumColEmpty: {
    flex: 1,
    maxWidth: 120,
    minHeight: 1,
  },
  podiumAvatarBlock: {
    alignItems: 'center',
    marginBottom: 6,
  },
  crownWrap: {
    marginBottom: -4,
    zIndex: 2,
  },
  crownSpacer: {
    height: 18,
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  podiumAvatarFirst: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#FFF8E1',
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginBottom: 2,
    width: '100%',
  },
  podiumScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  podiumStar: {
    width: 14,
    height: 14,
  },
  podiumScore: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFDE7',
  },
  podiumStand: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    shadowColor: '#2A1810',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  podiumRankBadge: {
    width: 56,
    height: 56,
  },
  listCard: {
    backgroundColor: '#FFF8EF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 16,
    shadowColor: '#3D2914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  listRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0D2C4',
  },
  listRowYou: {
    backgroundColor: '#E8F5E9',
  },
  listRank: {
    width: 22,
    fontSize: 14,
    fontWeight: '800',
    color: '#5D4037',
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  listNameCol: {
    flex: 1,
    minWidth: 0,
  },
  listNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  listName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#3E2723',
    flexShrink: 1,
  },
  youTag: {
    backgroundColor: '#1E88E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  youTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  listScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  listStar: {
    width: 16,
    height: 16,
  },
  listScore: {
    fontSize: 14,
    fontWeight: '900',
    color: '#4E342E',
  },
  achievementsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: '#43A047',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#2E7D32',
    marginBottom: 12,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  sparkle: {
    marginHorizontal: 2,
  },
  achievementsTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  achievementsRow: {
    gap: 10,
    paddingBottom: 8,
    paddingHorizontal: 2,
  },
  achievementCard: {
    width: 168,
    backgroundColor: '#FFF8EF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    padding: 12,
    marginRight: 10,
    shadowColor: '#3D2914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  achievementIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: 8,
  },
  achievementCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#3E2723',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5D4037',
    lineHeight: 15,
    marginBottom: 10,
    minHeight: 45,
  },
  achievementTrack: {
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D7C4B0',
  },
  achievementFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
  },
  achievementProgressLabel: {
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '900',
    color: '#3E2723',
    zIndex: 1,
  },
  achievementRewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  achievementReward: {
    fontSize: 15,
    fontWeight: '900',
    color: '#F57F17',
  },
  achievementStar: {
    width: 18,
    height: 18,
  },
  footerNote: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.92)',
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginTop: 8,
    lineHeight: 16,
  },
  fontFallbackBold: {
    fontWeight: '900',
  },
  fontFallbackSemi: {
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.88,
  },
});
