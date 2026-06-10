import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/contexts/auth-context';
import { FALLBACK_PUZZLES, type GuessPuzzle } from '@/contexts/guess-puzzles-context';
import { useInterstitialAd } from '@/hooks/use-interstitial-ad';
import { usePaidHintActions } from '@/hooks/use-paid-hint-actions';
import {
  getLocalCalendarDateKey,
  loadDailyChallengeState,
  saveDailyChallengeState,
  type DailyChallengePersistedState,
} from '@/lib/daily-challenge-storage';
import { fetchDailyChallengePuzzlesOrdered, tryInitFirebase, type GuessPuzzleDoc } from '@/lib/firebase';
import { awardUserPoints, DAILY_CHALLENGE_WIN_POINTS } from '@/lib/firebase/points';

const normalizeAnswer = (phrase: string) =>
  phrase
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();

const MAX_LETTER_BOXES_PER_ROW = 8;

type AnswerCell =
  | { kind: 'letter'; ch: string; key: string }
  | { kind: 'space'; key: string };

const chunkWordToMaxLetters = (word: string): string[] => {
  if (word.length <= MAX_LETTER_BOXES_PER_ROW) {
    return [word];
  }
  const parts: string[] = [];
  for (let i = 0; i < word.length; i += MAX_LETTER_BOXES_PER_ROW) {
    parts.push(word.slice(i, i + MAX_LETTER_BOXES_PER_ROW));
  }
  return parts;
};

const buildAnswerRows = (answer: string): AnswerCell[][] => {
  const words = answer.split(' ').filter((w) => w.length > 0);
  const rows: AnswerCell[][] = [];
  let row: AnswerCell[] = [];
  let lettersInRow = 0;
  let spaceKey = 0;

  const flush = () => {
    while (row.length > 0 && row[row.length - 1].kind === 'space') {
      row.pop();
    }
    if (row.length > 0) {
      rows.push(row);
      row = [];
      lettersInRow = 0;
    }
  };

  const wordStartIndex = (wordIndex: number) => {
    let offset = 0;
    for (let j = 0; j < wordIndex; j++) {
      offset += words[j].length + 1;
    }
    return offset;
  };

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi];
    const base = wordStartIndex(wi);
    const chunks = chunkWordToMaxLetters(word);

    for (let ci = 0; ci < chunks.length; ci++) {
      const chunk = chunks[ci];
      const chunkCharBase = base + ci * MAX_LETTER_BOXES_PER_ROW;

      if (wi > 0 && ci === 0) {
        if (lettersInRow > 0) {
          if (lettersInRow + chunk.length > MAX_LETTER_BOXES_PER_ROW) {
            flush();
          }
          if (lettersInRow > 0) {
            row.push({ kind: 'space', key: `space-bw-${spaceKey++}` });
          }
        }
      }

      if (lettersInRow + chunk.length > MAX_LETTER_BOXES_PER_ROW) {
        flush();
      }

      for (let k = 0; k < chunk.length; k++) {
        const ch = chunk[k];
        row.push({
          kind: 'letter',
          ch,
          key: `letter-${chunkCharBase + k}-${ch}`,
        });
        lettersInRow += 1;
      }
    }
  }

  flush();
  return rows;
};

const MAX_WRONG = 5;
const DAILY_TIMER_SECONDS = 60;

const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

function shuffleDailyPuzzles<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = next[i];
    next[i] = next[j]!;
    next[j] = t!;
  }
  return next;
}

const mapDailyDocToPuzzle = (d: GuessPuzzleDoc): GuessPuzzle => ({
  id: d.id,
  phrase: d.phrase,
  clue: d.clue,
  category: d.category,
  clueEmoji: d.clueEmoji,
});

const DailyChallenge = () => {
  const [headerFontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, isLoggedIn, refreshProfile } = useAuth();

  const [persisted, setPersisted] = useState<DailyChallengePersistedState | null>(null);
  const [entryBlocked, setEntryBlocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DAILY_TIMER_SECONDS);
  const [timedOut, setTimedOut] = useState(false);
  const dailyOutcomeSavedRef = useRef(false);
  const winSavedRef = useRef(false);
  const [winBonusLine, setWinBonusLine] = useState<string | null>(null);

  const [remoteDailyPuzzles, setRemoteDailyPuzzles] = useState<GuessPuzzle[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const docs = await fetchDailyChallengePuzzlesOrdered();
        if (cancelled) {
          return;
        }
        if (docs.length > 0) {
          setRemoteDailyPuzzles(shuffleDailyPuzzles(docs.map(mapDailyDocToPuzzle)));
        } else {
          setRemoteDailyPuzzles([]);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn('[DailyChallenge] Failed to load dailyChallenge collection', e);
          setRemoteDailyPuzzles([]);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const puzzles = useMemo(
    () => (remoteDailyPuzzles.length > 0 ? remoteDailyPuzzles : [...FALLBACK_PUZZLES]),
    [remoteDailyPuzzles],
  );

  const puzzle = puzzles[0] ?? FALLBACK_PUZZLES[0];

  const answer = useMemo(() => normalizeAnswer(puzzle.phrase), [puzzle.phrase]);

  const lettersInAnswer = useMemo(() => {
    const s = new Set<string>();
    for (const ch of answer) {
      if (ch !== ' ') {
        s.add(ch);
      }
    }
    return s;
  }, [answer]);

  const wordRows = useMemo(() => buildAnswerRows(answer), [answer]);

  const wordLayout = useMemo(() => {
    const gap = 8;
    const horizontalPadding = 16;
    const available = Math.max(220, windowWidth - horizontalPadding);
    const spaceWidth = Math.min(28, Math.max(14, Math.round(windowWidth * 0.036)));
    const maxLetterGaps = MAX_LETTER_BOXES_PER_ROW - 1;
    const maxSpacesPerRow = MAX_LETTER_BOXES_PER_ROW - 1;
    const reserved =
      maxLetterGaps * gap + maxSpacesPerRow * spaceWidth;
    const rawSlotW = (available - reserved) / MAX_LETTER_BOXES_PER_ROW;
    const slotW = Math.min(72, Math.max(42, rawSlotW));
    const slotH = slotW;
    const fontSize = Math.min(44, Math.max(26, Math.round(slotW * 0.56)));
    return { gap, slotW, slotH, fontSize, spaceWidth };
  }, [windowWidth]);

  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(() => new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [clueRevealed, setClueRevealed] = useState(false);
  const [clueEmojiRevealed, setClueEmojiRevealed] = useState(false);
  const [roundStarted, setRoundStarted] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        const p = await loadDailyChallengeState();
        if (!active) {
          return;
        }
        const day = getLocalCalendarDateKey();
        const blocked = Boolean(p.attempted && p.dateOfAttempt === day);
        setEntryBlocked(blocked);
        setPersisted(p);
        if (!blocked) {
          setRoundStarted(false);
          setTimeLeft(DAILY_TIMER_SECONDS);
          setTimedOut(false);
          dailyOutcomeSavedRef.current = false;
          winSavedRef.current = false;
          setGuessedLetters(new Set());
          setWrongCount(0);
          setClueRevealed(false);
          setClueEmojiRevealed(false);
        }
      })();
      return () => {
        active = false;
      };
    }, []),
  );

  useEffect(() => {
    setClueRevealed(false);
    setClueEmojiRevealed(false);
  }, [puzzle.id, puzzle.phrase]);

  const heartsLeft = Math.max(0, MAX_WRONG - wrongCount);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const hasWon = useMemo(
    () => lettersInAnswer.size > 0 && [...lettersInAnswer].every((ch) => guessedLetters.has(ch)),
    [lettersInAnswer, guessedLetters],
  );
  const hasLost = wrongCount >= MAX_WRONG;
  const todayKey = getLocalCalendarDateKey();
  const alreadyPlayedToday = Boolean(
    persisted !== null && persisted.attempted && persisted.dateOfAttempt === todayKey,
  );
  const storageReady = persisted !== null;
  const canPlay = storageReady && !alreadyPlayedToday;
  const awaitingStart = canPlay && !roundStarted;
  const isGameLocked = hasWon || hasLost || timedOut || alreadyPlayedToday || awaitingStart;

  const handleDailyRoundStart = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setRoundStarted(true);
    setTimeLeft(DAILY_TIMER_SECONDS);
    setTimedOut(false);
  }, []);

  useEffect(() => {
    if (!canPlay || !roundStarted || hasWon || hasLost || timedOut) {
      return;
    }
    const id = setInterval(() => {
      setTimeLeft((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [canPlay, roundStarted, hasWon, hasLost, timedOut]);

  useEffect(() => {
    if (!canPlay || !roundStarted || hasWon || timedOut) {
      return;
    }
    if (timeLeft === 0) {
      setTimedOut(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [timeLeft, canPlay, roundStarted, hasWon, timedOut]);

  useEffect(() => {
    if (hasWon || !canPlay) {
      return;
    }
    const failed = timedOut || hasLost;
    if (!failed || dailyOutcomeSavedRef.current) {
      return;
    }
    dailyOutcomeSavedRef.current = true;
    void (async () => {
      const prev = await loadDailyChallengeState();
      const day = getLocalCalendarDateKey();
      await saveDailyChallengeState({
        attempted: true,
        dateOfAttempt: day,
        streak: 0,
        lastWinDate: prev.lastWinDate,
      });
      setPersisted(await loadDailyChallengeState());
    })();
  }, [hasWon, timedOut, hasLost, canPlay]);

  const wonInTime = hasWon && !timedOut;

  const { showInterstitialAfterGameComplete } = useInterstitialAd();
  const adShownForAttemptRef = useRef(false);

  useEffect(() => {
    if (!roundStarted) {
      return;
    }
    const attemptComplete = hasWon || hasLost || timedOut;
    if (!attemptComplete || adShownForAttemptRef.current) {
      return;
    }
    adShownForAttemptRef.current = true;
    void showInterstitialAfterGameComplete();
  }, [hasLost, hasWon, roundStarted, showInterstitialAfterGameComplete, timedOut]);

  useEffect(() => {
    if (!wonInTime || winSavedRef.current) {
      if (!wonInTime) {
        setWinBonusLine(null);
      }
      return;
    }
    winSavedRef.current = true;
    let cancelled = false;
    void (async () => {
      const prev = await loadDailyChallengeState();
      const day = getLocalCalendarDateKey();
      const streak = prev.streak + 1;
      await saveDailyChallengeState({
        attempted: true,
        dateOfAttempt: day,
        streak,
        lastWinDate: day,
      });
      if (cancelled) {
        return;
      }
      setPersisted(await loadDailyChallengeState());

      if (isLoggedIn && user?.uid && tryInitFirebase()) {
        const result = await awardUserPoints(user.uid, DAILY_CHALLENGE_WIN_POINTS);
        if (cancelled) {
          return;
        }
        if (result.ok) {
          setWinBonusLine(`+${DAILY_CHALLENGE_WIN_POINTS} points added to your profile!`);
          await refreshProfile({
            untilPointsAtLeast: (user.points ?? 0) + DAILY_CHALLENGE_WIN_POINTS,
          });
        } else {
          setWinBonusLine(null);
        }
      } else {
        setWinBonusLine(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, refreshProfile, user?.points, user?.uid, wonInTime]);

  const handleLetterPress = useCallback(
    (letter: string) => {
      if (isGameLocked || guessedLetters.has(letter)) {
        return;
      }
      const alreadyWon =
        lettersInAnswer.size > 0 &&
        [...lettersInAnswer].every((ch) => guessedLetters.has(ch));
      if (alreadyWon || wrongCount >= MAX_WRONG) {
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setGuessedLetters((prev) => {
        const next = new Set(prev);
        next.add(letter);
        return next;
      });
      if (!lettersInAnswer.has(letter)) {
        setWrongCount((c) => Math.min(MAX_WRONG, c + 1));
      }
    },
    [isGameLocked, guessedLetters, lettersInAnswer, wrongCount],
  );

  const handleModalHome = useCallback(() => {
    router.back();
  }, [router]);

  const {
    hintDisabled,
    revealClueDisabled,
    handleHintPress,
    handleRevealCluePress,
    hintCost,
    revealClueCost,
  } = usePaidHintActions({
    isLoggedIn,
    user,
    refreshProfile,
    isGameLocked,
    clueRevealed,
    clueEmojiRevealed,
    onHintRevealed: () => setClueRevealed(true),
    onEmojiRevealed: () => setClueEmojiRevealed(true),
  });

  const handleStarPress = useCallback(() => {
    void Haptics.selectionAsync();
    router.push('/leaderboard');
  }, [router]);

  const handlePlusPress = useCallback(() => {
    void Haptics.selectionAsync();
    router.push('/guess-the-name');
  }, [router]);

  const headerTitleType = headerFontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const headerSecondaryType = headerFontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  if (!storageReady) {
    return (
      <View style={styles.root}>
        <SafeAreaView style={[styles.safe, styles.loadingSafe]} edges={['top']}>
          <ActivityIndicator size="large" color="#2A93F4" accessibilityLabel="Loading daily challenge" />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.mainColumn}>
          <View style={styles.headerShadowWrap}>
            <View style={styles.headerBar}>
              <View style={styles.headerBarBottomEdge} pointerEvents="none" />
              <View style={styles.headerRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={handleBack}
                  style={({ pressed }) => [styles.headerSquircleBtn, pressed && styles.pressed]}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
                </Pressable>
                <Text
                  style={[
                    styles.headerTitle,
                    headerTitleType,
                    !headerFontsLoaded && styles.headerTitleFallback,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}>
                  DAILY CHALLENGE
                </Text>
                <View style={styles.headerRight}>
                  {isLoggedIn && user ? (
                    <View
                      style={styles.coinPill}
                      accessibilityLabel={`Points: ${user.points.toLocaleString()}`}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Open leaderboard"
                        onPress={handleStarPress}
                        style={({ pressed }) => [styles.headerCoinDisc, pressed && styles.pressed]}>
                        <MaterialCommunityIcons name="star" size={12} color="#FFF8E1" />
                      </Pressable>
                      <Text
                        style={[
                          styles.coinText,
                          headerSecondaryType,
                          !headerFontsLoaded && styles.headerSecondaryFallback,
                        ]}
                        numberOfLines={1}>
                        {user.points.toLocaleString()}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Play guess the name"
                        onPress={handlePlusPress}
                        style={({ pressed }) => [styles.plusBadge, pressed && styles.pressed]}>
                        <Text
                          style={[
                            styles.plusText,
                            headerSecondaryType,
                            !headerFontsLoaded && styles.headerSecondaryFallback,
                          ]}>
                          +
                        </Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          </View>

        <ScrollView
          style={styles.flexScroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.categoryTimerRow}>
            <View style={[styles.categoryPill, styles.categoryPillInRow]}>
              <Text style={styles.paw}>🐾</Text>
              <Text style={styles.categoryText} numberOfLines={1}>
                {puzzle.category}
              </Text>
            </View>
            {canPlay && roundStarted ? (
              <View
                style={[styles.timerPill, timeLeft <= 3 && styles.timerPillUrgent]}
                accessibilityRole="text"
                accessibilityLabel={`Time left, ${timeLeft} seconds`}>
                <MaterialCommunityIcons name="timer-sand" size={18} color="#FFFFFF" />
                <Text
                  style={[
                    styles.timerText,
                    headerSecondaryType,
                    !headerFontsLoaded && styles.headerSecondaryFallback,
                  ]}>
                  {timeLeft}s
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.gameCard}>
            <View style={styles.cardRow}>
              <View style={styles.clueBox}>
                <Text style={styles.clueLabel}>CLUE</Text>
                <View
                  style={styles.clueImageWrap}
                  accessibilityElementsHidden={!clueEmojiRevealed}
                  accessibilityLabel={
                    clueEmojiRevealed
                      ? undefined
                      : 'Clue picture is hidden. Use Reveal Clue to show it.'
                  }>
                  <Text
                    style={[styles.clueEmoji, !clueEmojiRevealed && styles.clueEmojiHidden]}
                    accessibilityLabel={
                      clueEmojiRevealed
                        ? `${puzzle.category} clue illustration`
                        : 'Clue picture is hidden. Use Reveal Clue to show it.'
                    }>
                    {puzzle.clueEmoji ?? '🦁'}
                  </Text>
                  {!clueEmojiRevealed && (
                    <View
                      pointerEvents="none"
                      accessible={false}
                      style={[StyleSheet.absoluteFillObject, styles.clueEmojiObscureLayer]}
                    />
                  )}
                </View>
              </View>
              <View style={styles.clueCenter}>
                {clueRevealed ? (
                  <Text style={styles.clueLine} accessibilityRole="text">
                    {puzzle.clue}
                  </Text>
                ) : (
                  <Text
                    style={[styles.clueLine, styles.clueLineHidden]}
                    accessibilityRole="text"
                    accessibilityLabel="Clue is hidden. Use the Use Hint button to reveal it.">
                    Tap USE HINT below to reveal this clue.
                  </Text>
                )}
              </View>
              <View style={styles.gallowsWrap}>
                <Image
                  source={require('@/assets/images/sun.png')}
                  style={styles.sunImage}
                  contentFit="contain"
                  accessibilityLabel="Sun decoration"
                />
                <GallowsFigure stage={wrongCount} />
              </View>
            </View>
            <View style={styles.livesRow}>
              <Text style={styles.livesLabel}>LIVES</Text>
              <View style={styles.heartsRow}>
                {Array.from({ length: MAX_WRONG }, (_, i) => (
                  <MaterialCommunityIcons
                    key={i}
                    name={i < heartsLeft ? 'heart' : 'heart-outline'}
                    size={22}
                    color={i < heartsLeft ? '#2A93F4' : '#B8C4D4'}
                  />
                ))}
              </View>
            </View>
          </View>
          <View style={[styles.wordBlock, { minHeight: wordLayout.slotH + 16 }]}>
            {wordRows.map((cells, rowIndex) => (
              <View
                key={`answer-row-${rowIndex}`}
                style={[styles.wordRowLine, { marginBottom: rowIndex === wordRows.length - 1 ? 0 : 10 }]}>
                {cells.map((cell, cellIndex) => {
                  const isLast = cellIndex === cells.length - 1;
                  const marginEnd = isLast ? 0 : wordLayout.gap;

                  if (cell.kind === 'space') {
                    return (
                      <View
                        key={cell.key}
                        accessibilityLabel="Space between words"
                        style={[
                          styles.wordSpaceSlot,
                          {
                            width: wordLayout.spaceWidth,
                            minHeight: wordLayout.slotH,
                            marginRight: marginEnd,
                          },
                        ]}
                      />
                    );
                  }

                  const show = guessedLetters.has(cell.ch);
                  return (
                    <View
                      key={cell.key}
                      style={[
                        styles.letterSlotWrap,
                        {
                          width: wordLayout.slotW,
                          minWidth: wordLayout.slotW,
                          height: wordLayout.slotH,
                          marginRight: marginEnd,
                        },
                      ]}>
                      <View style={styles.letterSlotFrame}>
                        <View style={styles.letterSlotInner}>
                          <Text style={[styles.letterSlotText, { fontSize: wordLayout.fontSize }]}>
                            {show ? cell.ch : ''}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.keyboardDock, { paddingBottom: Math.max(10, insets.bottom) }]}>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                clueRevealed
                  ? 'Clue already revealed'
                  : hintDisabled
                    ? 'Use hint. Log in and have enough points to use'
                    : `Use hint for ${hintCost} points`
              }
              accessibilityState={{ disabled: hintDisabled }}
              disabled={hintDisabled}
              onPress={() => void handleHintPress()}
              style={({ pressed }) => [
                styles.hintBtn,
                hintDisabled && styles.hintBtnDisabled,
                pressed && !hintDisabled && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="lightbulb-on" size={21} color="#FFD54F" />
              <Text style={styles.actionBtnText}>USE HINT</Text>
              <Text style={styles.coinCost}>{hintCost}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                clueEmojiRevealed
                  ? 'Clue picture already revealed'
                  : revealClueDisabled
                    ? 'Reveal clue picture. Log in and have enough points to use'
                    : `Reveal clue picture for ${revealClueCost} points`
              }
              accessibilityState={{ disabled: revealClueDisabled }}
              disabled={revealClueDisabled}
              onPress={() => void handleRevealCluePress()}
              style={({ pressed }) => [
                styles.revealBtn,
                revealClueDisabled && styles.revealBtnDisabled,
                pressed && !revealClueDisabled && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="eye-outline" size={21} color="#fff" />
              <Text style={styles.actionBtnText}>REVEAL CLUE</Text>
              <Text style={styles.coinCostLight}>{revealClueCost}</Text>
            </Pressable>
          </View>
          <View style={styles.keyboard}>
            {KEYBOARD_ROWS.map((row, ri) => (
              <View key={ri} style={styles.keyRow}>
                {row.map((letter) => {
                  const used = guessedLetters.has(letter);
                  const correct = used && lettersInAnswer.has(letter);
                  return (
                    <Pressable
                      key={letter}
                      accessibilityRole="button"
                      accessibilityLabel={`Letter ${letter}`}
                      accessibilityState={{ disabled: used || isGameLocked }}
                      disabled={used || isGameLocked}
                      onPress={() => handleLetterPress(letter)}
                      style={({ pressed }) => [
                        styles.keyCap,
                        correct && styles.keyCapCorrect,
                        used && !correct && styles.keyCapWrong,
                        pressed && !used && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.keyCapText,
                          (correct || (used && !correct)) && styles.keyCapTextOn,
                        ]}>
                        {letter}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
        </View>
      </SafeAreaView>

      <Modal
        visible={wonInTime}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay} accessibilityLabel="You won dialog">
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="trophy" size={72} color="#FFD54F" accessibilityLabel="Trophy" />
            <Text style={styles.modalTitle}>You won!</Text>
            <Text style={styles.modalSubtitle}>{`Great job solving today's phrase in time.`}</Text>
            {winBonusLine ? <Text style={styles.modalBonusLine}>{winBonusLine}</Text> : null}
            <Text style={styles.modalStreakText}>
              Streak: <Text style={styles.modalStreakEm}>{persisted?.streak ?? 0}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go home"
              onPress={handleModalHome}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
              <Text style={styles.modalPrimaryBtnText}>HOME</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={(timedOut || hasLost) && !hasWon}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay} accessibilityLabel="Daily challenge failed dialog">
          <View style={styles.modalCard}>
            <MaterialCommunityIcons
              name={timedOut ? 'clock-alert' : 'heart-broken'}
              size={64}
              color="#E74C3C"
              accessibilityLabel={timedOut ? 'Time ran out' : 'No lives left'}
            />
            <Text style={styles.modalTitle}>{timedOut ? "Time's up" : 'Out of lives'}</Text>
            <Text style={styles.modalSubtitle}>
              {timedOut
                ? `Your ${DAILY_TIMER_SECONDS} seconds ran out before you solved the phrase.`
                : 'You ran out of lives before solving the phrase.'}
            </Text>
            <Text style={styles.modalAnswerLabel}>The answer was:</Text>
            <Text style={styles.modalAnswerText} accessibilityLabel={`Answer: ${answer}`}>
              {answer}
            </Text>
            <Text style={styles.modalSubtitle}>Try again tomorrow.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go home"
              onPress={handleModalHome}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
              <Text style={styles.modalPrimaryBtnText}>HOME</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={entryBlocked}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay} accessibilityLabel="Already played today dialog">
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="calendar-today" size={64} color="#2A93F4" accessibilityLabel="Calendar" />
            <Text style={styles.modalTitle}>Already played</Text>
            <Text style={styles.modalSubtitle}>
              {`You've already attempted today's daily challenge. Come back tomorrow for a new round.`}
            </Text>
            <Text style={styles.modalStreakText}>
              Current streak: <Text style={styles.modalStreakEm}>{persisted?.streak ?? 0}</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go home"
              onPress={handleModalHome}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
              <Text style={styles.modalPrimaryBtnText}>HOME</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={canPlay && !roundStarted}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay} accessibilityLabel="Daily challenge instructions">
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="timer-sand" size={56} color="#2A93F4" accessibilityLabel="Timer" />
            <Text style={styles.modalTitle}>Ready?</Text>
            <Text style={styles.modalSubtitle}>
              {`You have ${DAILY_TIMER_SECONDS} seconds to guess the word by choosing letters on the keyboard. When you tap Start, the timer begins.`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start daily challenge timer"
              onPress={handleDailyRoundStart}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
              <Text style={styles.modalPrimaryBtnText}>START</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
};

type GallowsFigureProps = {
  stage: number;
};

const GallowsFigure = ({ stage }: GallowsFigureProps) => {
  const show = {
    beam: stage >= 0,
    rope: stage >= 1,
    head: stage >= 2,
    body: stage >= 3,
    arms: stage >= 4,
    legs: stage >= 5,
  };

  return (
    <View style={styles.gallows} accessibilityLabel={`Hangman progress ${stage} of ${MAX_WRONG}`}>
      <View style={styles.woodBase} />
      <View style={styles.woodPole} />
      {show.beam ? <View style={styles.woodTop} /> : null}
      {show.rope ? <View style={styles.rope} /> : null}
      {show.head ? <View style={styles.manHead} /> : null}
      {show.body ? <View style={styles.manBody} /> : null}
      {show.arms ? (
        <View style={styles.manArmsRow}>
          <View style={styles.manArm} />
          <View style={styles.manArm} />
        </View>
      ) : null}
      {show.legs ? (
        <View style={styles.manLegsRow}>
          <View style={styles.manLeg} />
          <View style={styles.manLeg} />
        </View>
      ) : null}
    </View>
  );
};

export default DailyChallenge;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  mainColumn: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flexScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
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
  scrollInner: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    paddingTop: 8,
  },
  loadingSafe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTimerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    marginBottom: 10,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2A93F4',
    borderWidth: 2,
    borderColor: '#1B6ED4',
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 14,
    minHeight: 48,
  },
  categoryPillInRow: {
    flex: 1,
    minWidth: 0,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F2992E',
    borderWidth: 2,
    borderColor: '#D97510',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  timerPillUrgent: {
    backgroundColor: '#E74C3C',
    borderColor: '#C0392B',
  },
  timerText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
    minWidth: 28,
    textAlign: 'center',
  },
  paw: {
    fontSize: 20,
  },
  categoryText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  gameCard: {
    backgroundColor: '#F7F0E4',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#A67B5B',
    padding: 10,
    marginBottom: 12,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  clueBox: {
    width: 72,
    backgroundColor: '#72BE2C',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4E961B',
    padding: 6,
    alignItems: 'center',
  },
  clueLabel: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 10,
    marginBottom: 4,
  },
  clueImageWrap: {
    width: '100%',
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  clueEmoji: {
    fontSize: 36,
  },
  /** Hide glyph under the cover layer (opacity + solid overlay = not visible). */
  clueEmojiHidden: {
    opacity: 0,
  },
  /** Solid + web blur so the emoji cannot be seen until revealed. */
  clueEmojiObscureLayer: {
    borderRadius: 8,
    opacity: 1,
    backgroundColor: '#EDE8DF',
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(237, 232, 223, 0.92)',
        backdropFilter: 'blur(24px)',
      },
      default: {},
    }),
  },
  clueCenter: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  clueLine: {
    color: '#5A3A0A',
    fontWeight: '800',
    fontSize: 15,
    textAlign: 'center',
  },
  clueLineHidden: {
    color: '#8B7355',
    fontWeight: '700',
    fontSize: 13,
    fontStyle: 'italic',
  },
  gallowsWrap: {
    width: 88,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  sunImage: {
    width: 28,
    height: 28,
    marginBottom: -4,
    marginRight: -4,
  },
  gallows: {
    width: 76,
    height: 92,
    alignItems: 'center',
    marginTop: 4,
  },
  woodBase: {
    position: 'absolute',
    bottom: 0,
    width: 56,
    height: 6,
    backgroundColor: '#8B5A2B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#6B4226',
  },
  woodPole: {
    position: 'absolute',
    bottom: 6,
    left: 10,
    width: 6,
    height: 72,
    backgroundColor: '#8B5A2B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#6B4226',
  },
  woodTop: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 44,
    height: 6,
    backgroundColor: '#8B5A2B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#6B4226',
  },
  rope: {
    position: 'absolute',
    top: 12,
    right: 18,
    width: 3,
    height: 14,
    backgroundColor: '#4A3728',
    borderRadius: 1,
  },
  manHead: {
    position: 'absolute',
    top: 24,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#222',
    backgroundColor: 'transparent',
  },
  manBody: {
    position: 'absolute',
    top: 42,
    right: 19,
    width: 4,
    height: 22,
    backgroundColor: '#222',
    borderRadius: 2,
  },
  manArmsRow: {
    position: 'absolute',
    top: 46,
    right: 8,
    flexDirection: 'row',
    gap: 20,
  },
  manArm: {
    width: 16,
    height: 3,
    backgroundColor: '#222',
    borderRadius: 1,
  },
  manLegsRow: {
    position: 'absolute',
    top: 62,
    right: 14,
    flexDirection: 'row',
    gap: 6,
  },
  manLeg: {
    width: 3,
    height: 16,
    backgroundColor: '#222',
    borderRadius: 1,
  },
  livesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  livesLabel: {
    color: '#5A3A0A',
    fontWeight: '900',
    fontSize: 12,
  },
  heartsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  wordBlock: {
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'stretch',
    paddingVertical: 10,
    marginBottom: 14,
  },
  wordRowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    flexWrap: 'nowrap',
  },
  wordSpaceSlot: {
    alignSelf: 'center',
  },
  letterSlotWrap: {
    borderRadius: 15,
  },
  letterSlotFrame: {
    flex: 1,
    width: '100%',
    height: '100%',
    borderRadius: 13,
    padding: 3,
    backgroundColor: '#C4E87A',
    borderWidth: 1,
    borderTopColor: '#EEFBD4',
    borderLeftColor: '#E4F7B8',
    borderRightColor: '#8FB43C',
    borderBottomColor: '#759A30',
    shadowColor: '#0F2406',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 6,
  },
  letterSlotInner: {
    flex: 1,
    borderRadius: 9,
    backgroundColor: '#72BE2C',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.3)',
    borderLeftColor: 'rgba(0, 0, 0, 0.28)',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.14)',
    borderBottomColor: 'rgba(255, 255, 255, 0.09)',
  },
  letterSlotText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  hintBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2A93F4',
    borderWidth: 2,
    borderColor: '#1B6ED4',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  hintBtnDisabled: {
    opacity: 0.52,
  },
  revealBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F2992E',
    borderWidth: 2,
    borderColor: '#D97510',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 10,
    minHeight: 48,
  },
  revealBtnDisabled: {
    opacity: 0.52,
  },
  actionBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 13,
  },
  coinCost: {
    color: '#FFD54F',
    fontWeight: '900',
    fontSize: 12,
    marginLeft: 2,
  },
  coinCostLight: {
    color: '#FFF3D6',
    fontWeight: '900',
    fontSize: 12,
    marginLeft: 2,
  },
  keyboardDock: {
    width: '100%',
    paddingHorizontal: 6,
    paddingTop: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  keyboard: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: 16,
    padding: 8,
    gap: 6,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  keyCap: {
    minWidth: 32,
    height: 42,
    paddingHorizontal: 7,
    borderRadius: 9,
    backgroundColor: '#E8DCC8',
    borderWidth: 2,
    borderColor: '#C4B59A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyCapCorrect: {
    backgroundColor: '#72BE2C',
    borderColor: '#4E961B',
  },
  keyCapWrong: {
    backgroundColor: '#E8B4B4',
    borderColor: '#C97A7A',
  },
  keyCapText: {
    color: '#5A3A0A',
    fontWeight: '900',
    fontSize: 17,
  },
  keyCapTextOn: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#F7F0E4',
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#A67B5B',
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 12,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#5A3A0A',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B5344',
    textAlign: 'center',
    marginBottom: 4,
  },
  modalAnswerLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B5344',
    textAlign: 'center',
    marginTop: 4,
  },
  modalAnswerText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#5A3A0A',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  modalBonusLine: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3A7D1E',
    textAlign: 'center',
  },
  modalStreakText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#5A3A0A',
    textAlign: 'center',
  },
  modalStreakEm: {
    color: '#2A93F4',
    fontWeight: '900',
  },
  modalPrimaryBtn: {
    marginTop: 8,
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 200,
    alignItems: 'center',
  },
  modalPrimaryBtnFlex: {
    flex: 1,
    backgroundColor: '#F2992E',
    borderWidth: 2,
    borderColor: '#D97510',
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
    width: '100%',
  },
  modalSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#E8F4FF',
    borderWidth: 2,
    borderColor: '#2A93F4',
    borderRadius: 16,
    paddingVertical: 12,
  },
  modalSecondaryBtnText: {
    color: '#2A93F4',
    fontWeight: '900',
    fontSize: 14,
  },
});
