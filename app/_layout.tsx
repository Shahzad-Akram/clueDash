import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import {
  getTrackingPermissionsAsync,
  requestTrackingPermissionsAsync,
} from 'expo-tracking-transparency';
import { useEffect, useState } from 'react';
import { Image, InteractionManager, Platform } from 'react-native';
import 'react-native-reanimated';

import { AppBackground, APP_BACKGROUND_IMAGE } from '@/components/app-background';
import { AuthProvider } from '@/contexts/auth-context';
import { GuessPuzzlesProvider } from '@/contexts/guess-puzzles-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import adMobService from '@/lib/admob';
import { tryInitFirebase } from '@/lib/firebase';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: 'index',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [backgroundReady, setBackgroundReady] = useState(false);

  useEffect(() => {
    const ok = tryInitFirebase();
    if (!ok) {
      console.warn('[Firebase] Skipped init — add .env with EXPO_PUBLIC_FIREBASE_* keys.');
    }
    if (Platform.OS === 'web' && ok) {
      void import('@/lib/firebase/analytics.web').then((m) => void m.tryInitFirebaseAnalytics());
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const initAds = async () => {
      if (Platform.OS === 'ios') {
        try {
          const { status } = await getTrackingPermissionsAsync();
          if (status === 'undetermined') {
            await requestTrackingPermissionsAsync();
          }
        } catch (error) {
          console.warn('ATT: Error requesting tracking permission', error);
        }
      }
      // Let initial navigation/render settle before initializing ads (heavy on cold start).
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      await adMobService.initialize();
    };
    void initAds();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const prepareBackground = async () => {
      try {
        const resolved = Image.resolveAssetSource(APP_BACKGROUND_IMAGE);
        if (resolved?.uri) {
          await Image.prefetch(resolved.uri);
        }
      } catch {
        // Still render; ImageBackground will load as usual.
      } finally {
        if (!cancelled) {
          setBackgroundReady(true);
        }
      }
    };

    void prepareBackground();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (backgroundReady) {
      void SplashScreen.hideAsync();
    }
  }, [backgroundReady]);

  if (!backgroundReady) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppBackground>
        <AuthProvider>
          <GuessPuzzlesProvider>
            <Stack
              initialRouteName="index"
              screenOptions={{
                contentStyle: { backgroundColor: 'transparent' },
              }}>
              <Stack.Screen name="index" options={{ headerShown: false }} />
              <Stack.Screen name="login" options={{ headerShown: false }} />
              <Stack.Screen name="sign-up" options={{ headerShown: false }} />
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="guess-the-name" options={{ headerShown: false }} />
              <Stack.Screen name="daily-challenge" options={{ headerShown: false }} />
              <Stack.Screen name="categories" options={{ headerShown: false }} />
              <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </GuessPuzzlesProvider>
        </AuthProvider>
      </AppBackground>
    </ThemeProvider>
  );
}
