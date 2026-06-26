import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  getPointsForStreakMilestone,
  STREAK_REWARD_DISPLAY_MILESTONES,
  STREAK_REWARD_STANDARD_POINTS,
} from '@/lib/streak-rewards';

type StreakRewardsModalProps = {
  visible: boolean;
  onClose: () => void;
  currentStreak: number;
  generalMaxStreak: number;
  claimedMilestones: number[];
  isLoggedIn: boolean;
  fontsLoaded: boolean;
};

const StreakRewardsModal = ({
  visible,
  onClose,
  currentStreak,
  generalMaxStreak,
  claimedMilestones,
  isLoggedIn,
  fontsLoaded,
}: StreakRewardsModalProps) => {
  const boldType = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const semiType = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;
  const claimedSet = new Set(claimedMilestones);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <MaterialCommunityIcons
            name="gift"
            size={52}
            color="#F57C00"
            accessibilityLabel="Streak rewards"
          />
          <Text style={[styles.title, boldType, !fontsLoaded && styles.fontFallbackBold]}>
            Streak Rewards
          </Text>
          <Text style={[styles.subtitle, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
            Solve consecutive puzzles in Random Mix or Categories to earn bonus points.
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={[styles.statLabel, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
                Current
              </Text>
              <Text style={[styles.statValue, boldType, !fontsLoaded && styles.fontFallbackBold]}>
                {currentStreak}
              </Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statLabel, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
                Best
              </Text>
              <Text style={[styles.statValue, boldType, !fontsLoaded && styles.fontFallbackBold]}>
                {generalMaxStreak}
              </Text>
            </View>
          </View>

          <ScrollView
            style={styles.listScroll}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}>
            {STREAK_REWARD_DISPLAY_MILESTONES.map((milestone) => {
              const points = getPointsForStreakMilestone(milestone) ?? 0;
              const earned = generalMaxStreak >= milestone;
              const claimed = claimedSet.has(milestone);
              const statusLabel = claimed ? 'Claimed' : earned ? 'Earned' : 'Locked';

              return (
                <View
                  key={milestone}
                  style={[
                    styles.rewardRow,
                    claimed && styles.rewardRowClaimed,
                    earned && !claimed && styles.rewardRowEarned,
                  ]}
                  accessibilityLabel={`${milestone} streak, ${points} points, ${statusLabel}`}>
                  <View style={styles.rewardLeft}>
                    <MaterialCommunityIcons
                      name={claimed ? 'check-circle' : earned ? 'fire' : 'lock'}
                      size={22}
                      color={claimed ? '#4E961B' : earned ? '#F57C00' : '#B8A88A'}
                    />
                    <Text style={[styles.rewardStreak, boldType, !fontsLoaded && styles.fontFallbackBold]}>
                      {milestone} streak
                    </Text>
                  </View>
                  <Text style={[styles.rewardPoints, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
                    +{points.toLocaleString()} pts
                  </Text>
                </View>
              );
            })}
            <Text style={[styles.recurringNote, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
              Then +{STREAK_REWARD_STANDARD_POINTS.toLocaleString()} pts every 10 additional streaks (30, 40,
              50…).
            </Text>
          </ScrollView>

          {!isLoggedIn ? (
            <Text style={[styles.loginNote, semiType, !fontsLoaded && styles.fontFallbackSemi]}>
              Sign in to receive streak reward points on your profile.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close streak rewards"
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}>
            <Text style={[styles.closeBtnText, boldType, !fontsLoaded && styles.fontFallbackBold]}>
              CLOSE
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

export default StreakRewardsModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    maxHeight: '88%',
    backgroundColor: '#FFF8EF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E6D5C3',
    padding: 20,
    alignItems: 'center',
    gap: 8,
    ...Platform.select({
      web: { boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2d1f0e',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5A3A0A',
    textAlign: 'center',
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  statPill: {
    flex: 1,
    backgroundColor: '#F8F4EA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D8C59A',
    paddingVertical: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#8B6914',
    fontWeight: '700',
  },
  statValue: {
    fontSize: 24,
    color: '#F57C00',
    fontWeight: '900',
    lineHeight: 28,
  },
  listScroll: {
    width: '100%',
    maxHeight: 280,
    marginTop: 4,
  },
  listContent: {
    gap: 8,
    paddingBottom: 4,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F4EA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E0D4BC',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  rewardRowClaimed: {
    borderColor: '#9AD99C',
    backgroundColor: '#EEF9EE',
  },
  rewardRowEarned: {
    borderColor: '#FFC107',
    backgroundColor: '#FFF8E1',
  },
  rewardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rewardStreak: {
    fontSize: 15,
    color: '#2d1f0e',
    fontWeight: '800',
  },
  rewardPoints: {
    fontSize: 14,
    color: '#2A93F4',
    fontWeight: '700',
  },
  recurringNote: {
    fontSize: 12,
    color: '#7A5C3A',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  loginNote: {
    fontSize: 12,
    color: '#C62828',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 4,
  },
  closeBtn: {
    width: '100%',
    marginTop: 4,
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  fontFallbackBold: {
    fontWeight: '800',
  },
  fontFallbackSemi: {
    fontWeight: '700',
  },
});
