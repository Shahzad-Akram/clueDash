import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';
import { useGuessPuzzles, type GuessDifficulty } from '@/contexts/guess-puzzles-context';
import { tryInitFirebase } from '@/lib/firebase';
import { fetchSolvedGuessIds, getPuzzleFirestoreId } from '@/lib/firebase/guess-progress';

type DifficultyInfo = {
  id: GuessDifficulty;
  title: string;
  description: string;
  /** Card face tint */
  bg: string;
  /** Bottom depth tint */
  bgDepth: string;
  titleColor: string;
  descriptionColor: string;
  imageSource: number;
};

const DIFFICULTY_DATA: DifficultyInfo[] = [
  {
    id: 'easy',
    title: 'Easy',
    description: 'Short, friendly names to warm up. Perfect for a quick win!',
    bg: '#C8EFC9',
    bgDepth: '#9AD99C',
    titleColor: '#2E7D32',
    descriptionColor: '#3D6B40',
    imageSource: require('@/assets/images/sun.png'),
  },
  {
    id: 'medium',
    title: 'Medium',
    description: 'Trickier names and phrases for seasoned guessers.',
    bg: '#FFE4B8',
    bgDepth: '#F5C98A',
    titleColor: '#E65100',
    descriptionColor: '#8B4513',
    imageSource: require('@/assets/images/starCategories.png'),
  },
  {
    id: 'hard',
    title: 'Hard',
    description: 'Long, tough phrases for true word masters. Dare to try?',
    bg: '#FFD4D4',
    bgDepth: '#F5A8A8',
    titleColor: '#C62828',
    descriptionColor: '#8B3D3D',
    imageSource: require('@/assets/images/fire.png'),
  },
];

const DifficultyLevelsScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const { puzzles, refetch } = useGuessPuzzles();
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set());
  const [activeTab, setActiveTab] = useState<GuessDifficulty>('easy');
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  useFocusEffect(
    useCallback(() => {
      if (!isLoggedIn || !user?.uid || !tryInitFirebase()) {
        setSolvedIds(new Set());
        return;
      }
      let active = true;
      void fetchSolvedGuessIds(user.uid).then((ids) => {
        if (active) {
          setSolvedIds(ids);
        }
      });
      return () => {
        active = false;
      };
    }, [isLoggedIn, user?.uid]),
  );

  const progressByDifficulty = useMemo(() => {
    const result: Record<GuessDifficulty, { solved: number; total: number }> = {
      easy: { solved: 0, total: 0 },
      medium: { solved: 0, total: 0 },
      hard: { solved: 0, total: 0 },
    };
    for (const p of puzzles) {
      if (!p.difficulty) {
        continue;
      }
      result[p.difficulty].total += 1;
      if (solvedIds.has(getPuzzleFirestoreId(p))) {
        result[p.difficulty].solved += 1;
      }
    }
    return result;
  }, [puzzles, solvedIds]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTabPress = useCallback((tab: GuessDifficulty) => {
    setActiveTab(tab);
  }, []);

  const handlePlayPress = useCallback(() => {
    router.push({
      pathname: '/guess-the-name',
      params: { difficulty: activeTab },
    });
  }, [activeTab, router]);

  const active = DIFFICULTY_DATA.find((d) => d.id === activeTab) ?? DIFFICULTY_DATA[0];
  const progress = progressByDifficulty[active.id];
  const fillRatio = progress.total > 0 ? Math.min(1, progress.solved / progress.total) : 0;
  const progressPct = `${Math.round(fillRatio * 100)}%` as const;
  const remaining = Math.max(0, progress.total - progress.solved);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <AppScreenHeader title="DIFFICULTY LEVELS" onBack={handleBack} />
        <ScrollView
          style={styles.body}
          contentContainerStyle={[styles.bodyContent, { paddingBottom: Math.max(16, insets.bottom) }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.tabBar}>
            {DIFFICULTY_DATA.map((d) => {
              const selected = activeTab === d.id;
              return (
                <Pressable
                  key={d.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  accessibilityLabel={d.title}
                  onPress={() => handleTabPress(d.id)}
                  style={[styles.tabPill, selected && styles.tabPillActive]}>
                  <Text
                    style={[
                      styles.tabPillText,
                      selected && styles.tabPillTextActive,
                      bodyFont,
                      !fontsLoaded && styles.fontFallbackSemi,
                    ]}>
                    {d.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.cardShadowWrap}>
            <View style={[styles.cardFace, { backgroundColor: active.bg }]}>
              <View style={[styles.cardDepth, { backgroundColor: active.bgDepth }]} pointerEvents="none" />
              <View style={styles.cardShine} pointerEvents="none" />

              <View style={styles.cardBody}>
                <Image
                  source={active.imageSource}
                  style={styles.cardImage}
                  contentFit="contain"
                  accessibilityLabel={`${active.title} difficulty`}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    { color: active.titleColor },
                    titleFont,
                    !fontsLoaded && styles.fontFallbackBold,
                  ]}>
                  {active.title.toUpperCase()}
                </Text>
                <Text
                  style={[
                    styles.cardDesc,
                    { color: active.descriptionColor },
                    bodyFont,
                    !fontsLoaded && styles.fontFallbackSemi,
                  ]}>
                  {active.description}
                </Text>

                <Text style={[styles.countLine, { color: active.titleColor }, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                  {progress.total > 0
                    ? isLoggedIn
                      ? `${remaining} of ${progress.total} puzzles left to solve`
                      : `${progress.total} puzzles to play`
                    : 'No puzzles in this level yet'}
                </Text>

                {isLoggedIn && progress.total > 0 ? (
                  <View
                    style={styles.progressTrack}
                    accessibilityRole="progressbar"
                    accessibilityValue={{ min: 0, max: progress.total, now: progress.solved }}>
                    <View style={[styles.progressFill, { width: progressPct }]} />
                    <View style={[styles.progressFillHighlight, { width: progressPct }]} pointerEvents="none" />
                    <Text style={[styles.progressLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                      {progress.solved} / {progress.total}
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Play ${active.title} puzzles`}
                  accessibilityState={{ disabled: progress.total === 0 }}
                  disabled={progress.total === 0}
                  onPress={handlePlayPress}
                  style={({ pressed }) => [
                    styles.playBtn,
                    pressed && styles.playBtnPressed,
                    progress.total === 0 && styles.playBtnDisabled,
                  ]}>
                  <Text style={[styles.playBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
                    PLAY {active.title.toUpperCase()}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

export default DifficultyLevelsScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  body: {
    flex: 1,
    paddingHorizontal: 10,
  },
  bodyContent: {
    paddingTop: 14,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFF8EF',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    padding: 4,
    marginBottom: 14,
    gap: 4,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabPillActive: {
    backgroundColor: '#2A93F4',
    borderWidth: 2,
    borderColor: '#1B6ED4',
  },
  tabPillText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#5D4037',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
  },
  cardShadowWrap: {
    shadowColor: '#2A1810',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.22,
    shadowRadius: 6,
    elevation: 6,
  },
  cardFace: {
    borderRadius: 22,
    borderWidth: 3,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFFFF',
    borderRightColor: '#F5F5F5',
    borderBottomColor: '#E8E8E8',
    overflow: 'hidden',
  },
  cardDepth: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '42%',
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    opacity: 0.55,
  },
  cardShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '38%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  cardBody: {
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 22,
    paddingBottom: 20,
  },
  cardImage: {
    width: 110,
    height: 110,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 12,
  },
  countLine: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 12,
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: 26,
    borderRadius: 14,
    backgroundColor: '#FFF6E8',
    borderWidth: 2,
    borderTopColor: '#FFFFFF',
    borderLeftColor: '#FFFDF8',
    borderRightColor: '#E8DCC8',
    borderBottomColor: '#D9CBB5',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#6BCF3A',
    borderRadius: 12,
  },
  progressFillHighlight: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: '45%',
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
    zIndex: 2,
    textShadowColor: 'rgba(45, 35, 20, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  playBtn: {
    alignSelf: 'stretch',
    backgroundColor: '#FF952C',
    borderRadius: 16,
    borderWidth: 2,
    borderTopColor: '#FFB366',
    borderLeftColor: '#FFA64D',
    borderRightColor: '#E86F00',
    borderBottomColor: '#CC5F00',
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#7A3D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 1,
    elevation: 3,
  },
  playBtnPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  playBtnDisabled: {
    opacity: 0.6,
  },
  playBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0, 0, 0, 0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  fontFallbackBold: {
    fontWeight: '900',
  },
  fontFallbackSemi: {
    fontWeight: '600',
  },
});
