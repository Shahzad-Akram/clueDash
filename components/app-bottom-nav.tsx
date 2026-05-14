import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const APP_BOTTOM_NAV_HOME = 0;
export const APP_BOTTOM_NAV_PLAY = 1;
export const APP_BOTTOM_NAV_FRIENDS = 2;
export const APP_BOTTOM_NAV_LEADERBOARD = 3;
export const APP_BOTTOM_NAV_PROFILE = 4;

const TAB_ITEMS = [
  { key: 'home', label: 'HOME', source: require('@/assets/images/home.png') },
  { key: 'play', label: 'PLAY', source: require('@/assets/images/play.png') },
  { key: 'friends', label: 'FRIENDS', source: require('@/assets/images/friends.png') },
  { key: 'leader', label: 'LEADERBOARD', source: require('@/assets/images/leader.png') },
  { key: 'profile', label: 'PROFILE', source: require('@/assets/images/profile.png') },
] as const;

export type AppBottomNavProps = {
  activeIndex: number;
  onTabPress: (index: number) => void;
};

const NavItem = ({
  imageSource,
  label,
  active,
  onPress,
}: {
  imageSource: number;
  label: string;
  active: boolean;
  onPress: () => void;
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={({ pressed }) => [
      styles.navItemCell,
      active && styles.navItemCellActive,
      pressed && active && styles.navItemCellPressedActive,
      pressed && !active && styles.navItemCellPressedInactive,
    ]}>
    <Image source={imageSource} style={styles.navIconImage} contentFit="contain" />
    <Text style={styles.navLabel} numberOfLines={1}>
      {label}
    </Text>
  </Pressable>
);

export const AppBottomNav = ({ activeIndex, onTabPress }: AppBottomNavProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.outer} accessibilityRole="tablist">
      <View style={styles.topSheen} pointerEvents="none" />
      <View style={[styles.row, { paddingBottom: Math.max(10, insets.bottom) }]}>
        {TAB_ITEMS.map((tab, index) => (
          <NavItem
            key={tab.key}
            imageSource={tab.source}
            label={tab.label}
            active={activeIndex === index}
            onPress={() => onTabPress(index)}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#1E8CE9',
    shadowColor: '#0A3D66',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 12,
  },
  topSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'rgba(200, 235, 255, 0.55)',
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    paddingTop: 10,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
  },
  navItemCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginHorizontal: 2,
    borderRadius: 16,
  },
  navItemCellActive: {
    backgroundColor: '#0F6CBD',
    borderWidth: 2,
    borderColor: '#9FD8FF',
  },
  navItemCellPressedActive: {
    opacity: 0.9,
  },
  navItemCellPressedInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  navIconImage: {
    width: 32,
    height: 32,
  },
  navLabel: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
    width: '100%',
  },
});
