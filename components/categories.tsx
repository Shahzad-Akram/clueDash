import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';
import { useGuessPuzzles } from '@/contexts/guess-puzzles-context';
import { tryInitFirebase } from '@/lib/firebase';
import { fetchSolvedGuessIds, getPuzzleFirestoreId } from '@/lib/firebase/guess-progress';

type CategoryTab = 'all' | 'popular' | 'new';

type CategoryItem = {
  id: string;
  title: string;
  description: string;
  /** Card face + light tint */
  bg: string;
  /** Bottom depth tint (like reference gradient) */
  bgDepth: string;
  titleColor: string;
  descriptionColor: string;
  /** PNG icon; falls back to `emojiIcon` when absent. */
  imageSource?: number;
  emojiIcon?: string;
  /** Matches `category` field on Firestore `guesses` documents. */
  firestoreCategory: string;
  tags: CategoryTab[];
};

type CategoryProgress = {
  solved: number;
  total: number;
};

const CATEGORY_DATA: CategoryItem[] = [
  {
    id: 'movies',
    title: 'Movies',
    description: 'Guess famous films and quotes.',
    bg: '#B8DCFF',
    bgDepth: '#8FC4F8',
    titleColor: '#1565C0',
    descriptionColor: '#2E5F8A',
    imageSource: require('@/assets/images/cinema.png'),
    firestoreCategory: 'MOVIES',
    tags: ['all', 'popular'],
  },
  {
    id: 'actors',
    title: 'Actors',
    description: 'Stars from stage and screen.',
    bg: '#FFE4B8',
    bgDepth: '#F5C98A',
    titleColor: '#E65100',
    descriptionColor: '#8B4513',
    imageSource: require('@/assets/images/starCategories.png'),
    firestoreCategory: 'ACTORS',
    tags: ['all', 'popular'],
  },
  {
    id: 'cricket',
    title: 'Cricket',
    description: 'Players, teams, and records.',
    bg: '#C8EFC9',
    bgDepth: '#9AD99C',
    titleColor: '#2E7D32',
    descriptionColor: '#3D6B40',
    imageSource: require('@/assets/images/cricket.png'),
    firestoreCategory: 'CRICKET',
    tags: ['all', 'new'],
  },
  {
    id: 'football',
    title: 'Football',
    description: 'Clubs, cups, and legends.',
    bg: '#B8E4FF',
    bgDepth: '#8FCEF5',
    titleColor: '#0277BD',
    descriptionColor: '#2E5F7A',
    imageSource: require('@/assets/images/football.png'),
    firestoreCategory: 'FOOTBALL',
    tags: ['all', 'popular'],
  },
  {
    id: 'countries',
    title: 'Countries',
    description: 'Capitals, flags, and trivia.',
    bg: '#E0D4F5',
    bgDepth: '#C4B0E8',
    titleColor: '#6A1B9A',
    descriptionColor: '#5A4578',
    imageSource: require('@/assets/images/countries.png'),
    firestoreCategory: 'COUNTRIES',
    tags: ['all', 'new'],
  },
  {
    id: 'music',
    title: 'Music',
    description: 'Bands, albums, and hits.',
    bg: '#FFD4E0',
    bgDepth: '#F5A8BC',
    titleColor: '#C2185B',
    descriptionColor: '#8B3D55',
    imageSource: require('@/assets/images/music.png'),
    firestoreCategory: 'MUSIC',
    tags: ['all', 'popular'],
  },
  {
    id: 'brands',
    title: 'Brands',
    description: 'Logos and slogans you know.',
    bg: '#B8EEE8',
    bgDepth: '#8EDDD4',
    titleColor: '#00695C',
    descriptionColor: '#2E6B62',
    imageSource: require('@/assets/images/brands.png'),
    firestoreCategory: 'BRANDS',
    tags: ['all', 'new'],
  },
  {
    id: 'history',
    title: 'History',
    description: 'Dates, rulers, and events.',
    bg: '#EDE4D4',
    bgDepth: '#D4C4A8',
    titleColor: '#5D4037',
    descriptionColor: '#6B5344',
    imageSource: require('@/assets/images/history.png'),
    firestoreCategory: 'HISTORY',
    tags: ['all'],
  },
  {
    id: 'science',
    title: 'Science',
    description: 'Discoveries, elements, and space.',
    bg: '#D6E4FF',
    bgDepth: '#A9C3F5',
    titleColor: '#283593',
    descriptionColor: '#3D4E8B',
    imageSource: require('@/assets/images/science.png'),
    firestoreCategory: 'SCIENCE',
    tags: ['all', 'new'],
  },
  {
    id: 'animals',
    title: 'Animals',
    description: 'Creatures from land, sea, and sky.',
    bg: '#E4F3C8',
    bgDepth: '#C2DE9A',
    titleColor: '#558B2F',
    descriptionColor: '#5E7A40',
    imageSource: require('@/assets/images/animals.png'),
    firestoreCategory: 'ANIMALS',
    tags: ['all', 'new'],
  },
];

type CategoryCardProps = {
  item: CategoryItem;
  progress: CategoryProgress;
  showProgress: boolean;
  fontsLoaded: boolean;
  titleFont: { fontFamily: string } | undefined;
  bodyFont: { fontFamily: string } | undefined;
  onPress?: () => void;
};

const CategoryCard = ({
  item,
  progress,
  showProgress,
  fontsLoaded,
  titleFont,
  bodyFont,
  onPress,
}: CategoryCardProps) => {
  const fillRatio =
    progress.total > 0 ? Math.min(1, progress.solved / progress.total) : 0;
  const progressPct = `${Math.round(fillRatio * 100)}%` as const;
  const progressLabel = `${progress.solved} / ${progress.total}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        showProgress
          ? `${item.title}. ${item.description}. Progress ${progressLabel}`
          : `${item.title}. ${item.description}`
      }
      onPress={onPress}
      style={({ pressed }) => [styles.cardOuter, pressed && styles.cardPressed]}>
      <View style={styles.cardShadowWrap}>
        <View
          style={[
            styles.cardFace,
            { backgroundColor: item.bg },
            !showProgress && styles.cardFaceNoProgress,
          ]}>
          <View style={[styles.cardDepth, { backgroundColor: item.bgDepth }]} pointerEvents="none" />
          <View style={styles.cardShine} pointerEvents="none" />

          <View style={styles.cardBody}>
            <View style={styles.cardRow}>
              <View style={styles.cardIconWrap}>
                {item.imageSource !== undefined ? (
                  <Image
                    source={item.imageSource}
                    style={styles.cardIconImage}
                    contentFit="contain"
                    accessibilityLabel={`${item.title} icon`}
                  />
                ) : (
                  <Text style={styles.cardIconEmoji} accessibilityLabel={`${item.title} icon`}>
                    {item.emojiIcon}
                  </Text>
                )}
              </View>
              <View style={styles.cardTextCol}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: item.titleColor },
                    titleFont,
                    !fontsLoaded && styles.fontFallbackBold,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}>
                  {item.title}
                </Text>
                <Text
                  style={[
                    styles.cardDesc,
                    { color: item.descriptionColor },
                    bodyFont,
                    !fontsLoaded && styles.fontFallbackSemi,
                  ]}
                  numberOfLines={2}>
                  {item.description}
                </Text>
              </View>
            </View>

            {showProgress ? (
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: progress.total, now: progress.solved }}>
                <View style={[styles.progressFill, { width: progressPct }]} />
                <View style={[styles.progressFillHighlight, { width: progressPct }]} pointerEvents="none" />
                <Text style={[styles.progressLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                  {progressLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const buildProgressByCategory = (
  puzzles: { id?: string; phrase: string; category: string }[],
  solvedIds: Set<string>,
): Record<string, CategoryProgress> => {
  const result: Record<string, CategoryProgress> = {};
  for (const cat of CATEGORY_DATA) {
    const inCategory = puzzles.filter(
      (p) => p.category.trim().toUpperCase() === cat.firestoreCategory,
    );
    const total = inCategory.length;
    const solved = inCategory.filter((p) => solvedIds.has(getPuzzleFirestoreId(p))).length;
    result[cat.id] = { solved, total };
  }
  return result;
};

const CategoriesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn } = useAuth();
  const { puzzles, refetch } = useGuessPuzzles();
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set());
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');

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

  const progressByCategoryId = useMemo(
    () => buildProgressByCategory(puzzles, solvedIds),
    [puzzles, solvedIds],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return CATEGORY_DATA.filter((c) => {
      if (activeTab !== 'all' && !c.tags.includes(activeTab)) {
        return false;
      }
      if (!q) {
        return true;
      }
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [search, activeTab]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleTabPress = useCallback((tab: CategoryTab) => {
    setActiveTab(tab);
  }, []);

  const handleCategoryPress = useCallback(
    (item: CategoryItem) => {
      router.push({
        pathname: '/guess-the-name',
        params: {
          category: item.firestoreCategory,
          categoryTitle: item.title,
        },
      });
    },
    [router],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.screen}>
        <AppScreenHeader title="CATEGORIES" onBack={handleBack} />
        <View style={styles.body}>
          <View style={styles.searchWrap}>
            <MaterialCommunityIcons name="magnify" size={22} color="#8B7355" style={styles.searchIcon} />
            <TextInput
              accessibilityLabel="Search categories"
              placeholder="Search categories..."
              placeholderTextColor="#A08B78"
              value={search}
              onChangeText={setSearch}
              style={[styles.searchInput, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
            />
          </View>

          <View style={styles.tabBar}>
            {(['all', 'popular', 'new'] as const).map((tab) => {
              const active = activeTab === tab;
              const label = tab === 'all' ? 'All' : tab === 'popular' ? 'Popular' : 'New';
              return (
                <Pressable
                  key={tab}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  onPress={() => handleTabPress(tab)}
                  style={[styles.tabPill, active && styles.tabPillActive]}>
                  <Text
                    style={[
                      styles.tabPillText,
                      active && styles.tabPillTextActive,
                      bodyFont,
                      !fontsLoaded && styles.fontFallbackSemi,
                    ]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            numColumns={2}
            style={styles.list}
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={[styles.gridContent, { paddingBottom: Math.max(16, insets.bottom) }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.emptyText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                No categories match your search.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.gridCell}>
                <CategoryCard
                  item={item}
                  progress={progressByCategoryId[item.id] ?? { solved: 0, total: 0 }}
                  showProgress={isLoggedIn}
                  fontsLoaded={fontsLoaded}
                  titleFont={titleFont}
                  bodyFont={bodyFont}
                  onPress={() => handleCategoryPress(item)}
                />
              </View>
            )}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CategoriesScreen;

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
  list: {
    flex: 1,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8EF',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E8D9C8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 14,
    marginBottom: 12,
    shadowColor: '#3D2914',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#5A3A0A',
    paddingVertical: 0,
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
  gridContent: {
    paddingTop: 4,
  },
  gridRow: {
    gap: 12,
    marginBottom: 12,
  },
  gridCell: {
    flex: 1,
  },
  cardOuter: {
    flex: 1,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
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
    minHeight: 168,
  },
  cardFaceNoProgress: {
    minHeight: 140,
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
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  cardRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  cardIconWrap: {
    width: 70,
    height: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconImage: {
    width: 86,
    height: 86,
  },
  cardIconEmoji: {
    fontSize: 54,
    lineHeight: 64,
  },
  cardTextCol: {
    flexShrink: 1,
    maxWidth: '56%',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  cardDesc: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 13,
  },
  progressTrack: {
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
  emptyText: {
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 24,
    paddingHorizontal: 20,
  },
  fontFallbackBold: {
    fontWeight: '900',
  },
  fontFallbackSemi: {
    fontWeight: '600',
  },
});
