import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';

const WelcomeScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isSessionReady, hasAppAccess, continueAsGuest } = useAuth();
  const [continuingGuest, setContinuingGuest] = useState(false);
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  useEffect(() => {
    if (!isSessionReady || !hasAppAccess) {
      return;
    }
    router.replace('/(tabs)');
  }, [hasAppAccess, isSessionReady, router]);

  const handleSignInPress = useCallback(() => {
    router.push('/login');
  }, [router]);

  const handleSignUpPress = useCallback(() => {
    router.push('/sign-up');
  }, [router]);

  const handleGuestPress = useCallback(async () => {
    setContinuingGuest(true);
    try {
      await continueAsGuest();
      router.replace('/(tabs)');
    } finally {
      setContinuingGuest(false);
    }
  }, [continueAsGuest, router]);

  if (!isSessionReady || hasAppAccess) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#FFFFFF" accessibilityLabel="Loading" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.screen, { paddingBottom: Math.max(20, insets.bottom) }]}>
        <View style={styles.hero}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.logo}
            contentFit="contain"
            accessibilityLabel="ClueDash"
          />
          <Text style={[styles.tagline, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Solve clues. Guess the name. Climb the leaderboard.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={handleSignInPress}
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.primaryBtnPressed]}>
            <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>SIGN IN</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign up"
            onPress={handleSignUpPress}
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.secondaryBtnPressed]}>
            <Text style={[styles.secondaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>SIGN UP</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue as guest"
            accessibilityState={{ disabled: continuingGuest }}
            disabled={continuingGuest}
            onPress={() => void handleGuestPress()}
            style={({ pressed }) => [
              styles.guestBtn,
              pressed && !continuingGuest && styles.guestBtnPressed,
              continuingGuest && styles.guestBtnDisabled,
            ]}>
            {continuingGuest ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.guestBtnText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                Continue as guest
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default WelcomeScreen;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  screen: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 24,
  },
  logo: {
    width: 260,
    maxWidth: '100%',
    height: 72,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    textAlign: 'center',
    maxWidth: 320,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  actions: {
    gap: 12,
    paddingBottom: 8,
  },
  primaryBtn: {
    backgroundColor: '#2A93F4',
    borderWidth: 2,
    borderColor: '#1B6ED4',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#0A3D66',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.28,
    shadowRadius: 0,
    elevation: 4,
  },
  primaryBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  secondaryBtn: {
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#2D5012',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 0,
    elevation: 4,
  },
  secondaryBtnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  guestBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  guestBtnPressed: {
    opacity: 0.75,
  },
  guestBtnDisabled: {
    opacity: 0.6,
  },
  guestBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  fontFallbackBold: {
    fontWeight: '800',
  },
  fontFallbackSemi: {
    fontWeight: '600',
  },
});
