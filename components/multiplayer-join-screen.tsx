import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { multiplayerStyles as styles } from '@/components/multiplayer-styles';
import { useAuth } from '@/contexts/auth-context';
import { tryInitFirebase } from '@/lib/firebase';
import { joinMultiplayerRoom } from '@/lib/firebase/multiplayer-rooms';

const MultiplayerJoinScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, refreshProfile } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [roomCode, setRoomCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleJoin = useCallback(async () => {
    setError('');
    if (!user || !isLoggedIn) {
      setError('Sign in to join a room.');
      return;
    }
    if (!tryInitFirebase()) {
      setError('Firebase is not configured.');
      return;
    }
    if (roomCode.trim().length < 4) {
      setError('Enter the room code from your friend.');
      return;
    }

    setSubmitting(true);
    try {
      await joinMultiplayerRoom({
        roomId: roomCode.trim().toUpperCase(),
        uid: user.uid,
        displayName: user.name || 'Player',
        avatarId: user.avatarId,
      });
      await refreshProfile();
      router.replace(`/multiplayer/lobby/${roomCode.trim().toUpperCase()}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join room.');
    } finally {
      setSubmitting(false);
    }
  }, [isLoggedIn, refreshProfile, roomCode, router, user]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="JOIN ROOM" onBack={handleBack} showWallet={isLoggedIn} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={[styles.introTitle, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
            Enter room code
          </Text>
          <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Ask your friend for the 6-character code shown in their lobby. If the room has a bet, you need enough
            points in your wallet to join.
          </Text>
        </View>

        <TextInput
          accessibilityLabel="Room code"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          placeholder="ABC123"
          placeholderTextColor="#A08B78"
          value={roomCode}
          onChangeText={(text) => setRoomCode(text.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          style={[styles.codeInput, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
        />

        {error ? (
          <Text style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join room"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={() => void handleJoin()}
          style={({ pressed }) => [
            styles.primaryBtn,
            styles.primaryBtnBlue,
            pressed && !submitting && styles.primaryBtnPressed,
            submitting && styles.primaryBtnDisabled,
          ]}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
              JOIN ROOM
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MultiplayerJoinScreen;
