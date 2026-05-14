import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppBottomNav,
  APP_BOTTOM_NAV_HOME,
  APP_BOTTOM_NAV_LEADERBOARD,
  APP_BOTTOM_NAV_PROFILE,
} from '@/components/app-bottom-nav';
import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';

type LeaderTab = 'global' | 'friends' | 'weekly';

type PodiumPlayer = {
  place: 1 | 2 | 3;
  name: string;
  score: string;
  avatar: number;
  podiumColor: string;
  podiumBorder: string;
  podiumHeight: number;
  badgeImage: number;
};

const PODIUM: PodiumPlayer[] = [
  {
    place: 2,
    name: 'PuzzlePro',
    score: '9,820',
    avatar: require('@/assets/images/user1.png'),
    podiumColor: '#C5D9E8',
    podiumBorder: '#8FA8BC',
    podiumHeight: 100,
    badgeImage: require('@/assets/images/rank2.png'),
  },
  {
    place: 1,
    name: 'LexiGamez',
    score: '12,450',
    avatar: require('@/assets/images/user2.png'),
    podiumColor: '#FFD54F',
    podiumBorder: '#E6A800',
    podiumHeight: 132,
    badgeImage: require('@/assets/images/rank1.png'),
  },
  {
    place: 3,
    name: 'WordWiz',
    score: '7,610',
    avatar: require('@/assets/images/user3.png'),
    podiumColor: '#E8B89A',
    podiumBorder: '#C67D52',
    podiumHeight: 82,
    badgeImage: require('@/assets/images/rank3.png'),
  },
];

type ListRow = {
  rank: number;
  name: string;
  score: string;
  avatar: number;
  isYou?: boolean;
};

const LIST_ROWS: ListRow[] = [
  { rank: 4, name: 'BrainyBee', score: '6,230', avatar: require('@/assets/images/user1.png') },
  { rank: 5, name: 'ClueQueen', score: '5,410', avatar: require('@/assets/images/user2.png') },
  { rank: 6, name: 'WordSeeker', score: '4,980', avatar: require('@/assets/images/user3.png'), isYou: true },
  { rank: 7, name: 'HintHero', score: '4,120', avatar: require('@/assets/images/user1.png') },
  { rank: 8, name: 'LetterLynx', score: '3,780', avatar: require('@/assets/images/user2.png') },
];

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
  const { isLoggedIn } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [tab, setTab] = useState<LeaderTab>('global');
  const [activeNavIndex, setActiveNavIndex] = useState(APP_BOTTOM_NAV_LEADERBOARD);

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleBottomNavPress = useCallback(
    (index: number) => {
      setActiveNavIndex(index);
      if (index === APP_BOTTOM_NAV_HOME) {
        router.push('/');
        return;
      }
      if (index === APP_BOTTOM_NAV_LEADERBOARD) {
        return;
      }
      if (index === APP_BOTTOM_NAV_PROFILE) {
        router.push(isLoggedIn ? '/profile' : '/login');
      }
    },
    [isLoggedIn, router],
  );

  const handleTabPress = useCallback((next: LeaderTab) => {
    setTab(next);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <AppScreenHeader title="LEADERBOARD" onBack={handleBack} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 88 + insets.bottom }]}
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

          <View style={styles.podiumRow}>
            {PODIUM.map((p) => (
              <View key={p.place} style={[styles.podiumCol, p.place === 1 && styles.podiumColCenter]}>
                <View style={styles.podiumAvatarBlock}>
                  {p.place === 1 ? (
                    <View style={styles.crownWrap} accessibilityElementsHidden>
                      <MaterialCommunityIcons name="crown" size={22} color="#FFD700" />
                    </View>
                  ) : (
                    <View style={styles.crownSpacer} />
                  )}
                  <Image
                    source={p.avatar}
                    style={[styles.podiumAvatar, p.place === 1 && styles.podiumAvatarFirst]}
                    contentFit="cover"
                    accessibilityLabel={p.name}
                  />
                </View>
                <Text
                  style={[styles.podiumName, titleFont, !fontsLoaded && styles.fontFallbackBold]}
                  numberOfLines={1}>
                  {p.name}
                </Text>
                <View style={styles.podiumScoreRow}>
                  <Image
                    source={require('@/assets/images/star.png')}
                    style={styles.podiumStar}
                    contentFit="contain"
                    accessible={false}
                  />
                  <Text style={[styles.podiumScore, titleFont, !fontsLoaded && styles.fontFallbackBold]}>{p.score}</Text>
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
            ))}
          </View>

          <View style={styles.listCard}>
            {LIST_ROWS.map((row, index) => (
              <View
                key={row.rank}
                style={[
                  styles.listRow,
                  index < LIST_ROWS.length - 1 && styles.listRowDivider,
                  row.isYou && styles.listRowYou,
                ]}>
                <Text style={[styles.listRank, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>{row.rank}</Text>
                <Image source={row.avatar} style={styles.listAvatar} contentFit="cover" accessibilityLabel={row.name} />
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
                  <Text style={[styles.listScore, titleFont, !fontsLoaded && styles.fontFallbackBold]}>{row.score}</Text>
                </View>
              </View>
            ))}
          </View>

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

        <AppBottomNav activeIndex={activeNavIndex} onTabPress={handleBottomNavPress} />
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 4,
  },
  body: {
    paddingHorizontal: 14,
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
