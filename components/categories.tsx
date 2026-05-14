import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
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

import {
  AppBottomNav,
  APP_BOTTOM_NAV_HOME,
  APP_BOTTOM_NAV_LEADERBOARD,
  APP_BOTTOM_NAV_PLAY,
  APP_BOTTOM_NAV_PROFILE,
} from '@/components/app-bottom-nav';
import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';

type CategoryTab = 'all' | 'popular' | 'new';

type CategoryItem = {
  id: string;
  title: string;
  description: string;
  bg: string;
  titleColor: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  current: number;
  total: number;
  tags: CategoryTab[];
};

const CATEGORY_DATA: CategoryItem[] = [
  {
    id: 'movies',
    title: 'Movies',
    description: 'Guess famous films and quotes.',
    bg: '#D6EBFF',
    titleColor: '#1565C0',
    icon: 'movie-open',
    current: 18,
    total: 25,
    tags: ['all', 'popular'],
  },
  {
    id: 'actors',
    title: 'Actors',
    description: 'Stars from stage and screen.',
    bg: '#FFE8CC',
    titleColor: '#E65100',
    icon: 'star',
    current: 12,
    total: 20,
    tags: ['all', 'popular'],
  },
  {
    id: 'cricket',
    title: 'Cricket',
    description: 'Players, teams, and records.',
    bg: '#DFF5E1',
    titleColor: '#2E7D32',
    icon: 'cricket',
    current: 9,
    total: 15,
    tags: ['all', 'new'],
  },
  {
    id: 'football',
    title: 'Football',
    description: 'Clubs, cups, and legends.',
    bg: '#D9F7FA',
    titleColor: '#0277BD',
    icon: 'soccer',
    current: 21,
    total: 30,
    tags: ['all', 'popular'],
  },
  {
    id: 'countries',
    title: 'Countries',
    description: 'Capitals, flags, and trivia.',
    bg: '#EDE7F6',
    titleColor: '#6A1B9A',
    icon: 'earth',
    current: 14,
    total: 22,
    tags: ['all', 'new'],
  },
  {
    id: 'music',
    title: 'Music',
    description: 'Bands, albums, and hits.',
    bg: '#FCE4EC',
    titleColor: '#C2185B',
    icon: 'music-note',
    current: 16,
    total: 24,
    tags: ['all', 'popular'],
  },
  {
    id: 'brands',
    title: 'Brands',
    description: 'Logos and slogans you know.',
    bg: '#E0F2F1',
    titleColor: '#00695C',
    icon: 'shopping',
    current: 10,
    total: 18,
    tags: ['all', 'new'],
  },
  {
    id: 'history',
    title: 'History',
    description: 'Dates, rulers, and events.',
    bg: '#EFEBE9',
    titleColor: '#5D4037',
    icon: 'bank',
    current: 7,
    total: 12,
    tags: ['all'],
  },
];

type CategoryCardProps = {
  item: CategoryItem;
  fontsLoaded: boolean;
  titleFont: { fontFamily: string } | undefined;
  bodyFont: { fontFamily: string } | undefined;
  onPress?: () => void;
};

const CategoryCard = ({ item, fontsLoaded, titleFont, bodyFont, onPress }: CategoryCardProps) => {
  const progress = item.total > 0 ? Math.min(1, item.current / item.total) : 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.description}`}
      onPress={onPress}
      style={({ pressed }) => [styles.cardOuter, pressed && styles.cardPressed]}>
      <View style={[styles.cardFace, { backgroundColor: item.bg }]}>
        <View style={styles.cardRow}>
          <View style={styles.cardIconWrap} accessibilityElementsHidden>
            <MaterialCommunityIcons name={item.icon} size={40} color={item.titleColor} />
          </View>
          <View style={styles.cardTextCol}>
            <Text
              style={[styles.cardTitle, { color: item.titleColor }, titleFont, !fontsLoaded && styles.fontFallbackBold]}
              numberOfLines={1}>
              {item.title}
            </Text>
            <Text
              style={[styles.cardDesc, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
              numberOfLines={2}>
              {item.description}
            </Text>
          </View>
        </View>
        <View style={styles.progressTrack} accessibilityLabel={`Progress ${item.current} of ${item.total}`}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          <Text style={[styles.progressLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            {item.current} / {item.total}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const CategoriesScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [activeNavIndex, setActiveNavIndex] = useState(APP_BOTTOM_NAV_PLAY);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<CategoryTab>('all');

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

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

  const handleBottomNavPress = useCallback(
    (index: number) => {
      setActiveNavIndex(index);
      if (index === APP_BOTTOM_NAV_HOME) {
        router.push('/');
        return;
      }
      if (index === APP_BOTTOM_NAV_LEADERBOARD) {
        router.push('/leaderboard');
        return;
      }
      if (index === APP_BOTTOM_NAV_PROFILE) {
        router.push(isLoggedIn ? '/profile' : '/login');
      }
    },
    [isLoggedIn, router],
  );

  const handleTabPress = useCallback((tab: CategoryTab) => {
    setActiveTab(tab);
  }, []);

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
            contentContainerStyle={[styles.gridContent, { paddingBottom: 88 + insets.bottom }]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <Text style={[styles.emptyText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                No categories match your search.
              </Text>
            }
            renderItem={({ item }) => (
              <View style={styles.gridCell}>
                <CategoryCard item={item} fontsLoaded={fontsLoaded} titleFont={titleFont} bodyFont={bodyFont} />
              </View>
            )}
          />
        </View>

        <AppBottomNav activeIndex={activeNavIndex} onTabPress={handleBottomNavPress} />
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
    paddingHorizontal: 14,
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
    gap: 10,
    marginBottom: 10,
  },
  gridCell: {
    flex: 1,
    paddingHorizontal: 4,
  },
  cardOuter: {
    flex: 1,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.98 }],
  },
  cardFace: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    padding: 12,
    minHeight: 148,
    shadowColor: '#2A1810',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  cardIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  cardTextCol: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4E342E',
    lineHeight: 16,
  },
  progressTrack: {
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFF8EF',
    borderWidth: 1,
    borderColor: '#D7C4B0',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#72BE2C',
    borderRadius: 12,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#3E2723',
    zIndex: 1,
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
  pressed: {
    opacity: 0.88,
  },
});
