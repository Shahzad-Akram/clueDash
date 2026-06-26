import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type StreakRewardsBannerProps = {
  currentStreak: number;
  generalMaxStreak: number;
  onPress: () => void;
  fontsLoaded: boolean;
};

const StreakRewardsBanner = ({
  currentStreak,
  generalMaxStreak,
  onPress,
  fontsLoaded,
}: StreakRewardsBannerProps) => {
  const boldType = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const semiType = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Solve streak ${currentStreak}, best ${generalMaxStreak}. Open streak rewards.`}
      onPress={onPress}
      style={({ pressed }) => [styles.banner, pressed && styles.pressed]}>
      <View style={styles.left}>
        <MaterialCommunityIcons name="fire" size={20} color="#F57C00" accessibilityLabel="" />
        <Text style={[styles.streakText, boldType, !fontsLoaded && styles.fontFallbackBold]}>
          Streak: {currentStreak}
        </Text>
        <Text style={[styles.bestText, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
          Best: {generalMaxStreak}
        </Text>
      </View>
      <View style={styles.rewardsBtn}>
        <MaterialCommunityIcons name="gift" size={18} color="#FFFFFF" accessibilityLabel="" />
        <Text style={[styles.rewardsBtnText, boldType, !fontsLoaded && styles.fontFallbackBold]}>
          REWARDS
        </Text>
      </View>
    </Pressable>
  );
};

export default StreakRewardsBanner;

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FFC107',
    shadowColor: '#7A3D0A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  streakText: {
    color: '#E65100',
    fontSize: 14,
    fontWeight: '800',
  },
  bestText: {
    color: '#8B6914',
    fontSize: 12,
    fontWeight: '700',
  },
  rewardsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F57C00',
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderTopColor: '#FFB74D',
    borderLeftColor: '#FFA726',
    borderRightColor: '#E65100',
    borderBottomColor: '#BF360C',
  },
  rewardsBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  fontFallbackBold: {
    fontWeight: '800',
  },
  fontFallbackSemi: {
    fontWeight: '700',
  },
});
