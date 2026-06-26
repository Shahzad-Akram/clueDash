import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import StreakRewardsModal from '@/components/streak-rewards-modal';
import { useAuth } from '@/contexts/auth-context';
import { useLeaderboard } from '@/hooks/use-leaderboard';
import { useStreakRewards } from '@/hooks/use-streak-rewards';
import { loadDailyChallengeState } from '@/lib/daily-challenge-storage';
import { getProfileAvatarSource } from '@/lib/profile-avatars';

const LANDING_RANK_IMAGES = [
  require('@/assets/images/rank1.png'),
  require('@/assets/images/rank2.png'),
  require('@/assets/images/rank3.png'),
] as const;

type GameCardProps = {
  title: string;
  subtitle: string;
  imageSource: number;
  colors: [string, string];
  fontsLoaded: boolean;
  onPress?: () => void;
};

const splitIntoWordTexts = (phrase: string, baseKey: string) => {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  return words.map((word, index) => (
    <Text key={`${baseKey}-${index}-${word}`}>
      {index > 0 ? ' ' : ''}
      {word}
    </Text>
  ));
};

function GameCard({ title, subtitle, imageSource, colors, fontsLoaded, onPress }: GameCardProps) {
  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const subtitleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const titleStyle = [
    styles.gameCardTitle,
    titleFont,
    !fontsLoaded && styles.fontFallbackBold,
  ];
  const subtitleStyle = [
    styles.gameCardSubtitle,
    subtitleFont,
    !fontsLoaded && styles.fontFallbackSemi,
  ];

  const cardInner = (
    <View style={styles.gameCardOuter}>
      <View style={[styles.gameCardFace, { backgroundColor: colors[0] }]}>
        <View style={styles.gameCardShine} pointerEvents="none" />
        <View style={[styles.gameCardShade, { backgroundColor: colors[1] }]} pointerEvents="none" />
        <View style={styles.gameCardRow}>
          <View style={styles.cardIconCol}>
            <Image source={imageSource} style={styles.gameCardImage} contentFit="contain" />
          </View>
          <View style={styles.cardText}>
            <Text
              style={titleStyle}
              numberOfLines={3}
              adjustsFontSizeToFit
              minimumFontScale={0.68}
              maxFontSizeMultiplier={1.2}>
              {splitIntoWordTexts(title, 't')}
            </Text>
            <Text
              style={subtitleStyle}
              numberOfLines={4}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              maxFontSizeMultiplier={1.25}>
              {splitIntoWordTexts(subtitle, 's')}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.gameCardShell}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${subtitle}`}
          onPress={onPress}
          style={({ pressed }) => [styles.gameCardPressable, pressed && styles.gameCardPressed]}>
          {cardInner}
        </Pressable>
      ) : (
        cardInner
      )}
    </View>
  );
}

export default function LandingPage() {
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const {
    currentStreak,
    generalMaxStreak,
    claimedRewardMilestones,
    rewardsModalVisible,
    openRewards,
    closeRewards,
    syncOnFocus,
    isLoggedIn: rewardsLoggedIn,
  } = useStreakRewards();
  const { topThree: leaderboardTopThree, loading: leaderboardLoading } = useLeaderboard(3);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const hintType = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;
  const boldType = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const refreshStreakData = async () => {
        const dailyState = await loadDailyChallengeState();
        if (!active) {
          return;
        }
        setDailyStreak(dailyState.streak);
        await syncOnFocus();
      };

      void refreshStreakData();

      return () => {
        active = false;
      };
    }, [syncOnFocus]),
  );

  const handleGuessTheNamePress = () => {
    router.push('/guess-the-name');
  };

  const handleDailyPlayPress = useCallback(() => {
    router.push('/daily-challenge');
  }, [router]);

  const handleCategoriesPress = useCallback(() => {
    router.push('/categories');
  }, [router]);

  const handleDifficultyPress = useCallback(() => {
    router.push('/difficulty');
  }, [router]);

  const handleViewAllLeaderboard = useCallback(() => {
    router.push('/leaderboard');
  }, [router]);

  const handleProfilePress = useCallback(() => {
    router.push(isLoggedIn ? '/profile' : '/login');
  }, [isLoggedIn, router]);

  const handlePlayWithFriendsPress = useCallback(() => {
    router.push('/multiplayer' as Href);
  }, [router]);

  const handleRewardsPress = useCallback(() => {
    openRewards();
  }, [openRewards]);

  const handleCloseRewardsModal = useCallback(() => {
    closeRewards();
  }, [closeRewards]);

  const handleShareWithFriendsPress = useCallback(async () => {
    const appLink = Linking.createURL('/');
    const shareMessage = `Think you can beat me? Play GuessUp — solve clues, guess the name, and climb the leaderboard!\n\n${appLink}`;

    try {
      if (Platform.OS === 'web') {
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
          await navigator.share({
            title: 'GuessUp',
            text: shareMessage,
          });
          return;
        }
        await Share.share({ message: shareMessage, title: 'GuessUp' });
        return;
      }

      await Share.share(
        Platform.OS === 'ios'
          ? { message: shareMessage }
          : { message: shareMessage, title: 'GuessUp' },
      );
    } catch {
      // User dismissed the share sheet.
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <ScrollView
          style={styles.scrollFill}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.topBar}>
            <View style={styles.logoWrap}>
              <Image
                source={require('@/assets/images/logo.png')}
                style={styles.logoImage}
                contentFit="contain"
                accessibilityLabel="GuessUp"
              />
            </View>
            <View style={styles.topBarRight}>
              {isLoggedIn && user ? (
                <View
                  style={styles.coinPill}
                  accessibilityLabel={`Points: ${user.points.toLocaleString()}`}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open leaderboard"
                    onPress={handleViewAllLeaderboard}
                    style={({ pressed }) => [styles.headerCoinDisc, pressed && styles.coinActionPressed]}>
                    <MaterialCommunityIcons name="star" size={12} color="#FFF8E1" />
                  </Pressable>
                  <Text style={styles.coinText} numberOfLines={1}>
                    {user.points.toLocaleString()}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Play guess the name"
                    onPress={handleGuessTheNamePress}
                    style={({ pressed }) => [styles.plusBadge, pressed && styles.coinActionPressed]}>
                    <Text style={styles.plusText}>+</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open profile"
                onPress={handleProfilePress}
                style={({ pressed }) => [styles.avatarBtn, pressed && styles.coinActionPressed]}>
                <Image
                  source={getProfileAvatarSource(user?.avatarId ?? 'user1')}
                  style={styles.avatarImage}
                  contentFit="cover"
                  accessibilityLabel="Your avatar"
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.dailyRowSection}>
            <View style={styles.dailyTopRow}>
              <View style={styles.dailyMainCardOuter}>
                <Image
                  source={require('@/assets/images/dailyChallege.png')}
                  style={styles.dailyBannerImage}
                  contentFit="contain"
                  accessibilityLabel="Daily challenge"
                />
                <View style={styles.dailyMainCardInner}>
                  <View style={styles.dailyMainInset}>
                    <View style={styles.dailyMainBody}>
                      <Image
                        source={require('@/assets/images/guesswhat.png')}
                        style={styles.dailyCameraImage}
                        contentFit="contain"
                        accessibilityLabel="Movie camera"
                      />
                      <View style={styles.dailyTextColumn}>
                        <Text
                          style={[
                            styles.dailyHint,
                            hintType,
                            !fontsLoaded && styles.fontFallbackSemi,
                          ]}
                          numberOfLines={1}>
                          Think untamed.
                        </Text>
                        <Text
                          style={[
                            styles.dailyHint,
                            hintType,
                            !fontsLoaded && styles.fontFallbackSemi,
                          ]}
                          numberOfLines={1}>
                          Think nature.
                        </Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Play daily challenge"
                          onPress={handleDailyPlayPress}
                          style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}>
                          <Text
                            style={[
                              styles.playButtonText,
                              boldType,
                              !fontsLoaded && styles.fontFallbackBold,
                            ]}>
                            PLAY NOW
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </View>
              </View>

              <View style={styles.streakColumn}>
                <View style={styles.streakCardOuter}>
                  <View style={styles.streakCardInner}>
                    <View style={styles.streakFireWrap}>
                      <Image
                        source={require('@/assets/images/fire.png')}
                        style={styles.streakFireImage}
                        contentFit="contain"
                        accessibilityLabel="Daily streak flame"
                      />
                    </View>
                    <Text
                      style={[styles.streakCount, boldType, !fontsLoaded && styles.fontFallbackBold]}
                      accessibilityLabel={`${dailyStreak} day streak`}>
                      {dailyStreak}
                    </Text>
                    <Text
                      style={[styles.streakLabel, boldType, !fontsLoaded && styles.fontFallbackBold]}
                      numberOfLines={2}>
                      DAY STREAK
                    </Text>
                  </View>
                </View>

                <View style={styles.streakCardOuter}>
                  <View style={styles.streakCardInner}>
                    <View style={styles.streakFireWrap}>
                      <MaterialCommunityIcons
                        name="trophy"
                        size={32}
                        color="#F57C00"
                        accessibilityLabel="Best solve streak"
                      />
                    </View>
                    <Text
                      style={[styles.streakCount, boldType, !fontsLoaded && styles.fontFallbackBold]}
                      accessibilityLabel={`${generalMaxStreak} best solve streak`}>
                      {generalMaxStreak}
                    </Text>
                    <Text
                      style={[styles.streakLabel, boldType, !fontsLoaded && styles.fontFallbackBold]}
                      numberOfLines={2}>
                      BEST STREAK
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.grid}>
            <GameCard
              title="RANDOM MIX"
              subtitle="Solve clues and reveal letters!"
              imageSource={require('@/assets/images/Guess.png')}
              colors={['#2A93F4', '#1B6ED4']}
              fontsLoaded={fontsLoaded}
              onPress={handleGuessTheNamePress}
            />
            <GameCard
              title="CATEGORIES"
              subtitle="Explore topics you love!"
              imageSource={require('@/assets/images/categories.png')}
              colors={['#7B57D7', '#5D3BB3']}
              fontsLoaded={fontsLoaded}
              onPress={handleCategoriesPress}
            />
            <GameCard
              title="DIFFICULTY LEVELS"
              subtitle="Easy, medium or hard?"
              imageSource={require('@/assets/images/fire.png')}
              colors={['#F25C54', '#D63B33']}
              fontsLoaded={fontsLoaded}
              onPress={handleDifficultyPress}
            />
            <GameCard
              title="SHARE WITH FRIENDS"
              subtitle="Invite your friends to play!"
              imageSource={require('@/assets/images/friends.png')}
              colors={['#F2992E', '#D97510']}
              fontsLoaded={fontsLoaded}
              onPress={() => void handleShareWithFriendsPress()}
            />
            <GameCard
              title="PLAY WITH FRIENDS"
              subtitle="Race a friend in real time!"
              imageSource={require('@/assets/images/friends.png')}
              colors={['#72BE2C', '#4E961B']}
              fontsLoaded={fontsLoaded}
              onPress={handlePlayWithFriendsPress}
            />
            <GameCard
              title="STREAK REWARDS"
              subtitle="Bonus points for solve streaks!"
              imageSource={require('@/assets/images/star.png')}
              colors={['#FFB300', '#F57C00']}
              fontsLoaded={fontsLoaded}
              onPress={handleRewardsPress}
            />
          </View>

          <StreakRewardsModal
            visible={rewardsModalVisible}
            onClose={handleCloseRewardsModal}
            currentStreak={currentStreak}
            generalMaxStreak={generalMaxStreak}
            claimedMilestones={claimedRewardMilestones}
            isLoggedIn={rewardsLoggedIn}
            fontsLoaded={fontsLoaded}
          />

          {isLoggedIn ? (
          <View style={styles.leaderboardSection}>
            <View style={styles.bottomCard}>
              <View style={styles.leaderboardHeaderRow}>
                <View style={styles.leaderboardTitleWrap}>
                  <Text
                    style={[styles.bottomCardHeading, boldType, !fontsLoaded && styles.fontFallbackBold]}
                    numberOfLines={1}
                    ellipsizeMode="tail">
                    LEADERBOARD
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View full leaderboard"
                  onPress={handleViewAllLeaderboard}
                  style={({ pressed }) => [styles.viewAllPressable, pressed && styles.viewAllPressed]}>
                  <Image
                    source={require('@/assets/images/viewAll.png')}
                    style={styles.viewAllImage}
                    contentFit="contain"
                    accessibilityLabel="View all"
                  />
                </Pressable>
              </View>
              <View style={styles.bottomCardInset}>
                {leaderboardLoading ? (
                  <ActivityIndicator
                    style={styles.leaderboardLoading}
                    color="#2A93F4"
                    accessibilityLabel="Loading leaderboard"
                  />
                ) : leaderboardTopThree.length === 0 ? (
                  <Text style={[styles.leaderboardEmpty, hintType, !fontsLoaded && styles.fontFallbackSemi]}>
                    No players on the board yet. Sign up and play to appear here!
                  </Text>
                ) : (
                  leaderboardTopThree.map((row, index) => (
                    <View
                      key={row.uid}
                      style={[
                        styles.leaderboardRow,
                        index < leaderboardTopThree.length - 1 && styles.leaderboardRowDivider,
                      ]}>
                      <Image
                        source={LANDING_RANK_IMAGES[index] ?? LANDING_RANK_IMAGES[2]}
                        style={styles.rankBadgeImage}
                        contentFit="contain"
                        accessibilityLabel={`Rank ${row.rank}`}
                      />
                      <Image
                        source={row.avatarSource}
                        style={styles.leaderAvatar}
                        contentFit="cover"
                        accessibilityLabel={row.name}
                      />
                      <Text
                        style={[styles.leaderName, boldType, !fontsLoaded && styles.fontFallbackBold]}
                        numberOfLines={1}>
                        {row.name}
                        {row.isYou ? ' (You)' : ''}
                      </Text>
                      <View style={styles.leaderScoreWrap}>
                        <Image
                          source={require('@/assets/images/star.png')}
                          style={styles.leaderStarIcon}
                          contentFit="contain"
                          accessible={false}
                          importantForAccessibility="no"
                        />
                        <Text
                          style={[styles.leaderScoreText, boldType, !fontsLoaded && styles.fontFallbackBold]}>
                          {row.scoreLabel}
                        </Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollFill: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 10,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  logoWrap: {
    flexShrink: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginRight: 8,
  },
  logoImage: {
    height: 48,
    width: 200,
    maxWidth: '100%',
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#FFD54F',
    backgroundColor: '#FFF8EF',
    overflow: 'hidden',
    shadowColor: '#5C3D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 1,
    elevation: 3,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD54F',
    borderRadius: 22,
    borderWidth: 2,
    borderTopColor: '#FFECB3',
    borderLeftColor: '#FFE082',
    borderRightColor: '#E6AC00',
    borderBottomColor: '#C99400',
    paddingLeft: 8,
    paddingRight: 5,
    paddingVertical: 5,
    shadowColor: '#5C3D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 1,
    elevation: 3,
  },
  headerCoinDisc: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E6AC00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderTopColor: '#F5C84A',
    borderLeftColor: '#F0BC3A',
    borderRightColor: '#C99400',
    borderBottomColor: '#A67A00',
  },
  coinText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    minWidth: 40,
    textAlign: 'center',
  },
  plusBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#6BCF3A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderTopColor: '#A8E878',
    borderLeftColor: '#92E05E',
    borderRightColor: '#4CAF2E',
    borderBottomColor: '#3A8F24',
    shadowColor: '#1E5A12',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 2,
  },
  plusText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: -1,
  },
  coinActionPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.94 }],
  },
  dailyRowSection: {
    marginBottom: 12,
  },
  dailyTopRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
  },
  dailyMainCardOuter: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  dailyBannerImage: {
    position: 'absolute',
    top: 2,
    left: 8,
    width: '72%',
    maxWidth: 236,
    height: 42,
    zIndex: 2,
  },
  dailyMainCardInner: {
    marginTop: 28,
    flex: 1,
    minHeight: 140,
    backgroundColor: '#F8F4EA',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#D8C59A',
    paddingHorizontal: 8,
    paddingBottom: 10,
    paddingTop: 10,
    shadowColor: '#2A1D08',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  dailyMainInset: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8B565',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  dailyMainBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dailyCameraImage: {
    width: 76,
    height: 76,
  },
  dailyTextColumn: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  dailyHint: {
    color: '#5C3D2E',
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: -0.2,
  },
  playButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#FF952C',
    borderRadius: 16,
    borderWidth: 2,
    borderTopColor: '#FFB366',
    borderLeftColor: '#FFA64D',
    borderRightColor: '#E86F00',
    borderBottomColor: '#CC5F00',
    paddingVertical: 9,
    paddingHorizontal: 16,
    shadowColor: '#7A3D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 1,
    elevation: 3,
  },
  playButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  playButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  streakColumn: {
    width: 108,
    marginTop: 28,
    gap: 8,
  },
  streakCardOuter: {
    width: '100%',
  },
  streakCardInner: {
    minHeight: 66,
    backgroundColor: '#F8F4EA',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#D8C59A',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    shadowColor: '#2A1D08',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 3,
  },
  streakFireWrap: {
    marginBottom: 0,
  },
  streakFireImage: {
    width: 36,
    height: 36,
  },
  streakCount: {
    color: '#F57C00',
    fontSize: 32,
    lineHeight: 34,
    textShadowColor: 'rgba(181, 71, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  streakLabel: {
    marginTop: 2,
    color: '#E65100',
    fontSize: 10,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  fontFallbackBold: {
    fontWeight: '800',
  },
  fontFallbackSemi: {
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignContent: 'flex-start',
    marginBottom: 6,
  },
  gameCardShell: {
    width: '48.5%',
    marginBottom: 8,
  },
  gameCardPressable: {
    width: '100%',
  },
  gameCardOuter: {
    width: '100%',
    borderRadius: 28,
    padding: 6,
    backgroundColor: '#FFFBEB',
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 5,
  },
  gameCardFace: {
    position: 'relative',
    width: '100%',
    borderRadius: 22,
    overflow: 'hidden',
    minHeight: 124,
  },
  gameCardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '52%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  gameCardShade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '48%',
    opacity: 0.22,
  },
  gameCardRow: {
    width: '100%',
    minHeight: 124,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 8,
    gap: 6,
  },
  gameCardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  cardIconCol: {
    width: 58,
    flexShrink: 0,
    flexGrow: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameCardImage: {
    width: 56,
    height: 56,
  },
  cardText: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 2,
    alignItems: 'flex-start',
  },
  gameCardTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  gameCardSubtitle: {
    marginTop: 6,
    color: 'rgba(255, 255, 255, 0.96)',
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'left',
    textShadowColor: 'rgba(0, 0, 0, 0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  leaderboardSection: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 8,
  },
  bottomCard: {
    width: '100%',
    flexDirection: 'column',
    backgroundColor: '#F8F4EA',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#D8C59A',
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 7,
    shadowColor: '#2A1D08',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  bottomCardHeading: {
    color: '#2A85E8',
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: 'left',
  },
  bottomCardInset: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8B565',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  leaderboardHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 4,
    gap: 0,
    minHeight: 46,
  },
  leaderboardTitleWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
    justifyContent: 'center',
  },
  viewAllPressable: {
    flexShrink: 0,
    marginLeft: 'auto',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 0,
  },
  viewAllPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  viewAllImage: {
    height: 42,
    // Matches the source asset aspect ratio (410x246) so `contain` adds no horizontal letterboxing.
    width: 70,
    alignSelf: 'flex-end',
    maxWidth: '100%',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 6,
    minHeight: 34,
  },
  leaderboardLoading: {
    paddingVertical: 20,
  },
  leaderboardEmpty: {
    textAlign: 'center',
    color: '#5A3A0A',
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  leaderboardRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(92, 61, 46, 0.18)',
  },
  rankBadgeImage: {
    width: 22,
    height: 22,
  },
  leaderAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#F0E6D4',
    backgroundColor: '#EDE4D8',
  },
  leaderName: {
    flex: 1,
    minWidth: 0,
    color: '#4A3728',
    fontSize: 13,
    lineHeight: 17,
    textAlign: 'left',
    paddingRight: 4,
  },
  leaderScoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    flexShrink: 0,
  },
  leaderStarIcon: {
    width: 14,
    height: 14,
  },
  leaderScoreText: {
    color: '#4A3728',
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'right',
    includeFontPadding: false,
  },
});
