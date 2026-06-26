import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import { multiplayerStyles as styles } from '@/components/multiplayer-styles';
import { useAuth } from '@/contexts/auth-context';
import { tryInitFirebase } from '@/lib/firebase';
import { createMultiplayerRoom } from '@/lib/firebase/multiplayer-rooms';
import {
  DEFAULT_MULTIPLAYER_CONFIG,
  MULTIPLAYER_BET_OPTIONS,
  MULTIPLAYER_MAX_PLAYERS_OPTIONS,
  MULTIPLAYER_SECONDS_PER_WORD_OPTIONS,
  MULTIPLAYER_TIMER_MODE_OPTIONS,
  MULTIPLAYER_TOTAL_SECONDS_OPTIONS,
  MULTIPLAYER_WORD_COUNT_OPTIONS,
  type MultiplayerTimerMode,
} from '@/lib/firebase/multiplayer-types';

const MultiplayerCreateScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoggedIn, refreshProfile } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const [wordCount, setWordCount] = useState<number>(DEFAULT_MULTIPLAYER_CONFIG.wordCount);
  const [timerMode, setTimerMode] = useState<MultiplayerTimerMode>(DEFAULT_MULTIPLAYER_CONFIG.timerMode);
  const [secondsPerWord, setSecondsPerWord] = useState<number>(DEFAULT_MULTIPLAYER_CONFIG.secondsPerWord);
  const [totalSeconds, setTotalSeconds] = useState<number>(DEFAULT_MULTIPLAYER_CONFIG.totalSeconds);
  const [maxPlayers, setMaxPlayers] = useState<number>(DEFAULT_MULTIPLAYER_CONFIG.maxPlayers);
  const [betAmount, setBetAmount] = useState<number>(DEFAULT_MULTIPLAYER_CONFIG.betAmount);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const userPoints = user?.points ?? 0;
  const affordableBetOptions = useMemo(
    () => MULTIPLAYER_BET_OPTIONS.filter((amount) => amount <= userPoints),
    [userPoints],
  );

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleCreate = useCallback(async () => {
    setError('');
    if (!user || !isLoggedIn) {
      setError('Sign in to create a room.');
      return;
    }
    if (!tryInitFirebase()) {
      setError('Firebase is not configured.');
      return;
    }

    if (betAmount > userPoints) {
      setError(`Bet cannot exceed your balance (${userPoints.toLocaleString()} points).`);
      return;
    }

    setSubmitting(true);
    try {
      const roomId = await createMultiplayerRoom({
        hostUid: user.uid,
        displayName: user.name || 'Host',
        avatarId: user.avatarId,
        config: {
          wordCount,
          timerMode,
          secondsPerWord,
          totalSeconds,
          maxPlayers,
          betAmount,
        },
      });
      await refreshProfile();
      router.replace(`/multiplayer/lobby/${roomId}` as Href);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room.');
    } finally {
      setSubmitting(false);
    }
  }, [betAmount, isLoggedIn, maxPlayers, refreshProfile, router, secondsPerWord, timerMode, totalSeconds, user, userPoints, wordCount]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="CREATE ROOM" onBack={handleBack} showWallet={isLoggedIn} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <Text style={[styles.introTitle, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
            Match settings
          </Text>
          <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Choose how many phrases to race, how many can join, and how timing works.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
          Number of words
        </Text>
        <View style={styles.optionRow}>
          {MULTIPLAYER_WORD_COUNT_OPTIONS.map((count) => {
            const active = wordCount === count;
            return (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityLabel={`${count} words`}
                accessibilityState={{ selected: active }}
                onPress={() => setWordCount(count)}
                style={[styles.optionChip, active && styles.optionChipActive]}>
                <Text
                  style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                    bodyFont,
                    !fontsLoaded && styles.fontFallbackSemi,
                  ]}>
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
          Max players
        </Text>
        <View style={styles.optionRow}>
          {MULTIPLAYER_MAX_PLAYERS_OPTIONS.map((count) => {
            const active = maxPlayers === count;
            return (
              <Pressable
                key={count}
                accessibilityRole="button"
                accessibilityLabel={`${count} players maximum`}
                accessibilityState={{ selected: active }}
                onPress={() => setMaxPlayers(count)}
                style={[styles.optionChip, active && styles.optionChipActive]}>
                <Text
                  style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                    bodyFont,
                    !fontsLoaded && styles.fontFallbackSemi,
                  ]}>
                  {count}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
          Timer mode
        </Text>
        <View style={{ gap: 8 }}>
          {MULTIPLAYER_TIMER_MODE_OPTIONS.map((option) => {
            const active = timerMode === option.id;
            return (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                accessibilityState={{ selected: active }}
                onPress={() => setTimerMode(option.id)}
                style={[styles.timerModeCard, active && styles.timerModeCardActive]}>
                <Text
                  style={[
                    styles.timerModeTitle,
                    active && styles.timerModeTitleActive,
                    titleFont,
                    !fontsLoaded && styles.fontFallbackBold,
                  ]}>
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.timerModeBody,
                    active && styles.timerModeBodyActive,
                    bodyFont,
                    !fontsLoaded && styles.fontFallbackSemi,
                  ]}>
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {timerMode === 'per_word' ? (
          <>
            <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Seconds per word
            </Text>
            <View style={styles.optionRow}>
              {MULTIPLAYER_SECONDS_PER_WORD_OPTIONS.map((seconds) => {
                const active = secondsPerWord === seconds;
                return (
                  <Pressable
                    key={seconds}
                    accessibilityRole="button"
                    accessibilityLabel={`${seconds} seconds per word`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setSecondsPerWord(seconds)}
                    style={[styles.optionChip, active && styles.optionChipActive]}>
                    <Text
                      style={[
                        styles.optionChipText,
                        active && styles.optionChipTextActive,
                        bodyFont,
                        !fontsLoaded && styles.fontFallbackSemi,
                      ]}>
                      {seconds}s
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {timerMode === 'total' ? (
          <>
            <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Total match time
            </Text>
            <View style={styles.optionRow}>
              {MULTIPLAYER_TOTAL_SECONDS_OPTIONS.map((seconds) => {
                const active = totalSeconds === seconds;
                const label = seconds >= 60 ? `${Math.round(seconds / 60)}m` : `${seconds}s`;
                return (
                  <Pressable
                    key={seconds}
                    accessibilityRole="button"
                    accessibilityLabel={`${label} total`}
                    accessibilityState={{ selected: active }}
                    onPress={() => setTotalSeconds(seconds)}
                    style={[styles.optionChip, active && styles.optionChipActive]}>
                    <Text
                      style={[
                        styles.optionChipText,
                        active && styles.optionChipTextActive,
                        bodyFont,
                        !fontsLoaded && styles.fontFallbackSemi,
                      ]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
          Bet amount
        </Text>
        <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi, { marginBottom: 10 }]}>
          Each player stakes this amount. The winner takes the pot; losers forfeit their stake. Set to 0 for a
          friendly match. Your balance: {userPoints.toLocaleString()} points.
        </Text>
        <View style={styles.optionRow}>
          {MULTIPLAYER_BET_OPTIONS.map((amount) => {
            const affordable = amount <= userPoints;
            const active = betAmount === amount;
            const label = amount === 0 ? 'None' : amount.toLocaleString();
            return (
              <Pressable
                key={amount}
                accessibilityRole="button"
                accessibilityLabel={amount === 0 ? 'No bet' : `${amount} point bet`}
                accessibilityState={{ selected: active, disabled: !affordable }}
                disabled={!affordable}
                onPress={() => setBetAmount(amount)}
                style={[
                  styles.optionChip,
                  active && styles.optionChipActive,
                  !affordable && styles.optionChipDisabled,
                ]}>
                <Text
                  style={[
                    styles.optionChipText,
                    active && styles.optionChipTextActive,
                    !affordable && styles.optionChipTextDisabled,
                    bodyFont,
                    !fontsLoaded && styles.fontFallbackSemi,
                  ]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {betAmount > 0 && affordableBetOptions.length === 1 && affordableBetOptions[0] === 0 ? (
          <Text style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            You need points to set a bet. Choose None or earn more points first.
          </Text>
        ) : null}

        {error ? (
          <Text style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create room"
          accessibilityState={{ disabled: submitting }}
          disabled={submitting}
          onPress={() => void handleCreate()}
          style={({ pressed }) => [
            styles.primaryBtn,
            pressed && !submitting && styles.primaryBtnPressed,
            submitting && styles.primaryBtnDisabled,
          ]}>
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
              CREATE ROOM
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
};

export default MultiplayerCreateScreen;
