import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Image, InteractionManager, Platform } from 'react-native';
import 'react-native-reanimated';

import { AppBackground, APP_BACKGROUND_IMAGE } from '@/components/app-background';
import { AuthProvider } from '@/contexts/auth-context';
import { GuessPuzzlesProvider } from '@/contexts/guess-puzzles-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { tryInitFirebase } from '@/lib/firebase';
import { requestAppTrackingIfNeeded } from '@/lib/request-app-tracking';

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
    if (Platform.OS === 'web' || !backgroundReady) {
      return;
    }

    let cancelled = false;

    const bootstrapAfterLaunch = async () => {
      await SplashScreen.hideAsync();
      if (cancelled) {
        return;
      }

      try {
        await requestAppTrackingIfNeeded();
      } catch (error) {
        console.warn('ATT: Error requesting tracking permission', error);
      }

      if (cancelled) {
        return;
      }

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      if (!cancelled) {
        const { default: adMobService } = await import('@/lib/admob');
        await adMobService.initialize();
      }
    };

    void bootstrapAfterLaunch();

    return () => {
      cancelled = true;
    };
  }, [backgroundReady]);

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
              <Stack.Screen name="difficulty" options={{ headerShown: false }} />
              <Stack.Screen name="leaderboard" options={{ headerShown: false }} />
              <Stack.Screen name="profile" options={{ headerShown: false }} />
              <Stack.Screen name="multiplayer" options={{ headerShown: false }} />
              <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
            </Stack>
            <StatusBar style="auto" />
          </GuessPuzzlesProvider>
        </AuthProvider>
      </AppBackground>
    </ThemeProvider>
  );
}
