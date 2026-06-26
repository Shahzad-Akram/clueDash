import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { multiplayerStyles as styles } from '@/components/multiplayer-styles';
import { useAuth } from '@/contexts/auth-context';

const MultiplayerHubScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, isSessionReady } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const requireAuth = useCallback(
    (next: () => void) => {
      if (!isSessionReady) {
        return;
      }
      if (!isLoggedIn) {
        Alert.alert('Sign in required', 'Create an account or sign in to play with friends.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign in', onPress: () => router.push('/login') },
        ]);
        return;
      }
      next();
    },
    [isLoggedIn, isSessionReady, router],
  );

  const handleCreatePress = useCallback(() => {
    requireAuth(() => router.push('/multiplayer/create' as Href));
  }, [requireAuth, router]);

  const handleJoinPress = useCallback(() => {
    requireAuth(() => router.push('/multiplayer/join' as Href));
  }, [requireAuth, router]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="PLAY WITH FRIENDS" onBack={handleBack} showWallet={isLoggedIn} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Image
            source={require('@/assets/images/friends.png')}
            style={{ width: 72, height: 72, alignSelf: 'center' }}
            contentFit="contain"
            accessibilityLabel="Friends"
          />
          <Text style={[styles.introTitle, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
            Race your friend!
          </Text>
          <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Create a room, share the code, and see who solves all the phrases first.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create room"
          onPress={handleCreatePress}
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.primaryBtnBlue,
            pressed && styles.primaryBtnPressed,
          ]}>
          <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
            CREATE ROOM
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join room"
          onPress={handleJoinPress}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.primaryBtnPressed]}>
          <Text style={[styles.secondaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
            JOIN ROOM
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MultiplayerHubScreen;
