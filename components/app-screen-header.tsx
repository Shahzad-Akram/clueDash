import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/contexts/auth-context';

export type AppScreenHeaderProps = {
  title: string;
  onBack: () => void;
  onSettingsPress?: () => void;
  /** When false, hides the right header actions (e.g. auth screens). */
  showWallet?: boolean;
  /** When false, hides the settings button (e.g. when a music toggle is shown instead). */
  showSettings?: boolean;
  /** When provided, shows a music on/off toggle in the header. */
  musicEnabled?: boolean;
  onMusicToggle?: () => void;
};

export const AppScreenHeader = ({
  title,
  onBack,
  onSettingsPress,
  showWallet = true,
  showSettings = true,
  musicEnabled = true,
  onMusicToggle,
}: AppScreenHeaderProps) => {
  const { user, isLoggedIn } = useAuth();
  const showPoints = showWallet && isLoggedIn && user;
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const headerTitleType = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const headerSecondaryType = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleSettingsPress = useCallback(() => {
    if (onSettingsPress) {
      onSettingsPress();
      return;
    }
    void Haptics.selectionAsync();
  }, [onSettingsPress]);

  const handleMusicToggle = useCallback(() => {
    onMusicToggle?.();
  }, [onMusicToggle]);

  return (
    <View style={styles.headerShadowWrap}>
      <View style={styles.headerBar}>
        <View style={styles.headerBarBottomEdge} pointerEvents="none" />
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={onBack}
            style={({ pressed }) => [styles.headerSquircleBtn, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </Pressable>
          <Text
            style={[styles.headerTitle, headerTitleType, !fontsLoaded && styles.headerTitleFallback]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}>
            {title}
          </Text>
          {showWallet ? (
            <View style={styles.headerRight}>
              {showPoints ? (
                <View
                  style={styles.coinPill}
                  accessibilityRole="text"
                  accessibilityLabel={`Points: ${user.points.toLocaleString()}. Add coins`}>
                  <View style={styles.headerCoinDisc}>
                    <MaterialCommunityIcons name="star" size={12} color="#FFF8E1" />
                  </View>
                  <Text
                    style={[styles.coinText, headerSecondaryType, !fontsLoaded && styles.headerSecondaryFallback]}
                    numberOfLines={1}>
                    {user.points.toLocaleString()}
                  </Text>
                  <View style={styles.plusBadge}>
                    <Text
                      style={[styles.plusText, headerSecondaryType, !fontsLoaded && styles.headerSecondaryFallback]}>
                      +
                    </Text>
                  </View>
                </View>
              ) : null}
              {onMusicToggle ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={musicEnabled ? 'Turn music off' : 'Turn music on'}
                  accessibilityState={{ selected: musicEnabled }}
                  onPress={handleMusicToggle}
                  style={({ pressed }) => [styles.headerSquircleBtn, pressed && styles.pressed]}>
                  <MaterialCommunityIcons
                    name={musicEnabled ? 'volume-high' : 'volume-off'}
                    size={22}
                    color="#FFFFFF"
                  />
                </Pressable>
              ) : null}
              {showSettings ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                  onPress={handleSettingsPress}
                  style={({ pressed }) => [styles.headerSquircleBtn, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="cog" size={22} color="#FFFFFF" />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.headerRightSpacer} accessibilityElementsHidden />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  headerShadowWrap: {
    shadowColor: '#7A3D0A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.32,
    shadowRadius: 0,
    elevation: 6,
    zIndex: 2,
  },
  headerBar: {
    backgroundColor: '#F28C1A',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  headerBarBottomEdge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(122, 61, 10, 0.45)',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  headerSquircleBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFD54F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderTopColor: '#FFECB3',
    borderLeftColor: '#FFE082',
    borderRightColor: '#E6AC00',
    borderBottomColor: '#C99400',
    shadowColor: '#5C3D00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 1,
    elevation: 4,
  },
  headerTitle: {
    flex: 1,
    marginHorizontal: 4,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 16,
    letterSpacing: 0.4,
    textShadowColor: 'rgba(255, 255, 255, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  headerTitleFallback: {
    fontWeight: '800',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerRightSpacer: {
    width: 42,
    height: 42,
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
    lineHeight: 18,
    marginTop: -1,
  },
  headerSecondaryFallback: {
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
