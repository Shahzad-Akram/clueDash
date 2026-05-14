import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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

import { AppScreenHeader } from '@/components/app-screen-header';
import { useAuth } from '@/contexts/auth-context';
import { useGuessPuzzlesOrFallback, type GuessPuzzle } from '@/contexts/guess-puzzles-context';
import { tryInitFirebase } from '@/lib/firebase';
import { fetchSolvedGuessIds, getPuzzleFirestoreId, recordPuzzleSolved } from '@/lib/firebase/guess-progress';

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
const COIN_BALANCE = 1250;

const KEYBOARD_ROWS: string[][] = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const GuessTheNameGame = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { user, isLoggedIn, refreshProfile } = useAuth();

  const basePuzzles = useGuessPuzzlesOrFallback();
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set());
  const [winBonusLine, setWinBonusLine] = useState<string | null>(null);
  const [puzzleIndex, setPuzzleIndex] = useState(0);

  useEffect(() => {
    if (!user?.uid || !tryInitFirebase()) {
      setSolvedIds(new Set());
      return;
    }
    let cancelled = false;
    void fetchSolvedGuessIds(user.uid).then((ids) => {
      if (!cancelled) {
        setSolvedIds(ids);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const puzzles = useMemo(() => {
    if (!isLoggedIn || !user) {
      return basePuzzles;
    }
    return basePuzzles.filter((p) => !solvedIds.has(getPuzzleFirestoreId(p)));
  }, [basePuzzles, isLoggedIn, solvedIds, user]);

  const showPlayableBoard = puzzles.length > 0;

  const placeholderPuzzle = useMemo(
    (): GuessPuzzle => ({ phrase: ' ', clue: '', category: '', id: '__placeholder__' }),
    [],
  );
  const puzzle = showPlayableBoard ? puzzles[puzzleIndex % puzzles.length] : placeholderPuzzle;

  useEffect(() => {
    if (puzzles.length > 0 && puzzleIndex >= puzzles.length) {
      setPuzzleIndex(0);
    }
  }, [puzzleIndex, puzzles.length]);

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

  useEffect(() => {
    setClueRevealed(false);
    setClueEmojiRevealed(false);
  }, [puzzle.id, puzzle.phrase]);

  const heartsLeft = Math.max(0, MAX_WRONG - wrongCount);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const hasWon = useMemo(
    () =>
      showPlayableBoard &&
      lettersInAnswer.size > 0 &&
      [...lettersInAnswer].every((ch) => guessedLetters.has(ch)),
    [lettersInAnswer, guessedLetters, showPlayableBoard],
  );
  const hasLost = wrongCount >= MAX_WRONG;
  const isGameLocked = hasWon || hasLost;

  const handleLetterPress = useCallback(
    (letter: string) => {
      if (!showPlayableBoard) {
        return;
      }
      if (guessedLetters.has(letter)) {
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
    [guessedLetters, lettersInAnswer, showPlayableBoard, wrongCount],
  );

  const resetRound = useCallback(() => {
    setGuessedLetters(new Set());
    setWrongCount(0);
    setClueRevealed(false);
    setClueEmojiRevealed(false);
  }, []);

  const handleNextWord = useCallback(() => {
    if (!showPlayableBoard || puzzles.length === 0) {
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPuzzleIndex((i) => (i + 1) % puzzles.length);
    resetRound();
  }, [puzzles.length, resetRound, showPlayableBoard]);

  const handleTryAgain = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetRound();
  }, [resetRound]);

  const handleModalHome = useCallback(() => {
    router.back();
  }, [router]);

  const handleHintPress = useCallback(() => {
    if (!showPlayableBoard || isGameLocked || clueRevealed) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setClueRevealed(true);
  }, [clueRevealed, isGameLocked, showPlayableBoard]);

  const handleRevealCluePress = useCallback(() => {
    if (!showPlayableBoard || isGameLocked || clueEmojiRevealed) {
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setClueEmojiRevealed(true);
  }, [clueEmojiRevealed, isGameLocked, showPlayableBoard]);

  const handleSettingsPress = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const handlePausePress = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const handleSoundPress = useCallback(() => {
    void Haptics.selectionAsync();
  }, []);

  const handleStarPress = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  useEffect(() => {
    if (!hasWon) {
      setWinBonusLine(null);
      return;
    }
    if (!showPlayableBoard || !user?.uid) {
      setWinBonusLine(null);
      return;
    }
    if (!tryInitFirebase()) {
      return;
    }
    const puzzleId = getPuzzleFirestoreId(puzzle);
    let cancelled = false;
    void (async () => {
      try {
        const { pointsAwarded } = await recordPuzzleSolved(user.uid, puzzleId);
        if (cancelled) {
          return;
        }
        setSolvedIds((prev) => new Set(prev).add(puzzleId));
        if (pointsAwarded > 0) {
          setWinBonusLine('+50 points added to your profile!');
          await refreshProfile({
            untilPointsAtLeast: (user.points ?? 0) + pointsAwarded,
          });
        } else {
          setWinBonusLine(null);
        }
      } catch {
        if (!cancelled) {
          setWinBonusLine(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasWon, puzzle, refreshProfile, showPlayableBoard, user?.points, user?.uid]);

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.mainColumn}>
          <AppScreenHeader
            title="GUESS THE NAME"
            onBack={handleBack}
            onSettingsPress={handleSettingsPress}
            coinBalance={isLoggedIn && user ? user.points : COIN_BALANCE}
          />

        {showPlayableBoard ? (
          <>
        <ScrollView
          style={styles.flexScroll}
          contentContainerStyle={styles.scrollInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.categoryPill}>
            
            <Text style={styles.categoryText}>{puzzle.category}</Text>
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

        <View style={styles.keyboardDock}>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={clueRevealed ? 'Clue already revealed' : 'Use hint for 50 coins'}
              accessibilityState={{ disabled: isGameLocked || clueRevealed }}
              disabled={isGameLocked || clueRevealed}
              onPress={handleHintPress}
              style={({ pressed }) => [
                styles.hintBtn,
                (isGameLocked || clueRevealed) && styles.hintBtnDisabled,
                pressed && !isGameLocked && !clueRevealed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="lightbulb-on" size={21} color="#FFD54F" />
              <Text style={styles.actionBtnText}>USE HINT</Text>
              <Text style={styles.coinCost}>50</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                clueEmojiRevealed ? 'Clue picture already revealed' : 'Reveal clue picture for 75 coins'
              }
              accessibilityState={{ disabled: isGameLocked || clueEmojiRevealed }}
              disabled={isGameLocked || clueEmojiRevealed}
              onPress={handleRevealCluePress}
              style={({ pressed }) => [
                styles.revealBtn,
                (isGameLocked || clueEmojiRevealed) && styles.revealBtnDisabled,
                pressed && !isGameLocked && !clueEmojiRevealed && styles.pressed,
              ]}>
              <MaterialCommunityIcons name="eye-outline" size={21} color="#fff" />
              <Text style={styles.actionBtnText}>REVEAL CLUE</Text>
              <Text style={styles.coinCostLight}>75</Text>
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
            <View style={styles.keyRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete"
                style={({ pressed }) => [styles.keySpecial, styles.keyDelete, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="close" size={22} color="#fff" />
              </Pressable>
              <View style={styles.keySpacer} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enter"
                style={({ pressed }) => [styles.keySpecial, styles.keyEnter, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="keyboard-return" size={22} color="#fff" />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(10, insets.bottom) }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pause game"
            onPress={handlePausePress}
            style={({ pressed }) => [styles.footerPill, styles.footerPause, pressed && styles.pressed]}>
            <Text style={styles.footerPillText}>PAUSE</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Bonus action"
            onPress={handleStarPress}
            style={({ pressed }) => [styles.starFab, pressed && styles.pressed]}>
            <Image
              source={require('@/assets/images/starIcon.png')}
              style={styles.starFabImage}
              contentFit="contain"
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sound on"
            onPress={handleSoundPress}
            style={({ pressed }) => [styles.footerPill, styles.footerSound, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="volume-high" size={16} color="#fff" />
            <Text style={styles.footerPillText}>SOUND ON</Text>
          </Pressable>
        </View>
          </>
        ) : (
          <View style={styles.allSolvedPanel} accessibilityLabel="All phrases completed">
            <MaterialCommunityIcons
              name="check-decagram"
              size={72}
              color="#FFF59D"
              accessibilityLabel="Completed"
            />
            <Text style={styles.allSolvedTitle}>You are all caught up!</Text>
            <Text style={styles.allSolvedBody}>
              You have guessed every phrase available to you. Check back later for more puzzles.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={handleBack}
              style={({ pressed }) => [styles.allSolvedBtn, pressed && styles.pressed]}>
              <Text style={styles.allSolvedBtnText}>BACK</Text>
            </Pressable>
          </View>
        )}
        </View>
      </SafeAreaView>

      <Modal
        visible={hasWon && showPlayableBoard}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay} accessibilityLabel="You won dialog">
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="trophy" size={72} color="#FFD54F" accessibilityLabel="Trophy" />
            <Text style={styles.modalTitle}>You won!</Text>
            <Text style={styles.modalSubtitle}>Great job solving the phrase.</Text>
            {winBonusLine ? <Text style={styles.modalBonusLine}>{winBonusLine}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next word"
              onPress={handleNextWord}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
              <Text style={styles.modalPrimaryBtnText}>NEXT WORD</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={hasLost && !hasWon && showPlayableBoard}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay} accessibilityLabel="You lost dialog">
          <View style={styles.modalCard}>
            <MaterialCommunityIcons
              name="heart-broken"
              size={64}
              color="#E74C3C"
              accessibilityLabel="No lives left"
            />
            <Text style={styles.modalTitle}>You lost</Text>
            <Text style={styles.modalSubtitle}>No more lives. You lost.</Text>
            <View style={styles.modalButtonRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go home"
                onPress={handleModalHome}
                style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressed]}>
                <MaterialCommunityIcons name="home" size={20} color="#2A93F4" />
                <Text style={styles.modalSecondaryBtnText}>HOME</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Try again"
                onPress={handleTryAgain}
                style={({ pressed }) => [styles.modalPrimaryBtnFlex, pressed && styles.pressed]}>
                <Text style={styles.modalPrimaryBtnText}>TRY AGAIN</Text>
              </Pressable>
            </View>
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

export default GuessTheNameGame;

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
  allSolvedPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 16,
  },
  allSolvedTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2d1f0e',
    textAlign: 'center',
  },
  allSolvedBody: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5A3A0A',
    textAlign: 'center',
    lineHeight: 22,
  },
  allSolvedBtn: {
    marginTop: 8,
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 36,
  },
  allSolvedBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  modalBonusLine: {
    fontSize: 14,
    fontWeight: '800',
    color: '#3A7D1E',
    textAlign: 'center',
  },
  flexScroll: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  scrollInner: {
    paddingHorizontal: 12,
    paddingBottom: 20,
    paddingTop: 8,
  },
  categoryPill: {
    alignSelf: 'center',
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
    marginBottom: 10,
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
    paddingBottom: 4,
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
  keySpecial: {
    height: 42,
    minWidth: 54,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  keyDelete: {
    backgroundColor: '#E74C3C',
    borderColor: '#C0392B',
  },
  keyEnter: {
    backgroundColor: '#F2992E',
    borderColor: '#D97510',
  },
  keySpacer: {
    flex: 1,
  },
  footer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'transparent',
    borderTopWidth: 2,
    borderTopColor: 'rgba(255, 255, 255, 0.35)',
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerPause: {
    backgroundColor: '#2A93F4',
    borderColor: '#1B6ED4',
  },
  footerSound: {
    backgroundColor: '#72BE2C',
    borderColor: '#4E961B',
  },
  footerPillText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 11,
  },
  starFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFD54F',
    borderWidth: 3,
    borderColor: '#E6B800',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 6,
  },
  starFabImage: {
    width: 34,
    height: 34,
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
