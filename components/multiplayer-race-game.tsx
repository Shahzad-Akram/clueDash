import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GallowsFigure } from '@/components/guess-game-gallows';
import { type GuessPuzzle, useGuessPuzzlesOrFallback } from '@/contexts/guess-puzzles-context';
import { advanceMultiplayerWord, finalizeMultiplayerTimedMatch } from '@/lib/firebase/multiplayer-rooms';
import type { MultiplayerPlayer, MultiplayerRoom } from '@/lib/firebase/multiplayer-types';
import {
  buildAnswerRows,
  computeWordLayout,
  KEYBOARD_ROWS,
  MAX_WRONG,
  normalizeAnswer,
} from '@/lib/guess-game-core';
import { getProfileAvatarSource, type ProfileAvatarId } from '@/lib/profile-avatars';

type RaceProgressRowProps = {
  players: MultiplayerPlayer[];
  myUid: string;
  totalWords: number;
};

const RaceProgressRow = ({ players, myUid, totalWords }: RaceProgressRowProps) => (
  <View style={styles.raceProgressRow}>
    {players.map((player) => {
      const progress = totalWords > 0 ? player.wordsSolved / totalWords : 0;
      const isMe = player.uid === myUid;
      return (
        <View
          key={player.uid}
          style={[styles.raceProgressCol, isMe && styles.raceProgressColYou]}
          accessibilityLabel={`${player.displayName}, ${player.wordsSolved} of ${totalWords} words solved`}>
          <Image
            source={getProfileAvatarSource(player.avatarId as ProfileAvatarId)}
            style={styles.raceAvatar}
            contentFit="cover"
            accessibilityLabel={player.displayName}
          />
          <Text style={styles.raceColName} numberOfLines={1}>
            {isMe ? 'You' : player.displayName.split(' ')[0]}
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.raceColScore}>
            {player.wordsSolved}/{totalWords}
          </Text>
        </View>
      );
    })}
  </View>
);

type MultiplayerRaceGameProps = {
  roomId: string;
  room: MultiplayerRoom;
  players: MultiplayerPlayer[];
  myUid: string;
  onHome: () => void;
};

const resolvePuzzlesForRoom = (all: GuessPuzzle[], puzzleIds: string[]): GuessPuzzle[] => {
  const byId = new Map(all.map((puzzle) => [puzzle.id ?? puzzle.phrase, puzzle]));
  return puzzleIds
    .map((id) => byId.get(id))
    .filter((puzzle): puzzle is GuessPuzzle => Boolean(puzzle));
};

const MultiplayerRaceGame = ({ roomId, room, players, myUid, onHome }: MultiplayerRaceGameProps) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const allPuzzles = useGuessPuzzlesOrFallback();

  const me = useMemo(() => players.find((player) => player.uid === myUid), [myUid, players]);
  const opponent = useMemo(() => players.find((player) => player.uid !== myUid), [myUid, players]);

  const puzzles = useMemo(
    () => resolvePuzzlesForRoom(allPuzzles, room.puzzleIds),
    [allPuzzles, room.puzzleIds],
  );

  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(() => new Set());
  const [wrongCount, setWrongCount] = useState(0);
  const [roundModal, setRoundModal] = useState<'won' | 'lost' | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [advanceError, setAdvanceError] = useState('');
  const [localProgress, setLocalProgress] = useState<{ wordIndex: number; wordsSolved: number } | null>(
    null,
  );
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const wordIndex = localProgress?.wordIndex ?? me?.currentWordIndex ?? 0;
  const myWordsSolved = localProgress?.wordsSolved ?? me?.wordsSolved ?? 0;
  const totalWords = room.puzzleIds.length;
  const activePuzzle = puzzles[wordIndex] ?? null;

  useEffect(() => {
    if (!me || localProgress == null) {
      return;
    }
    if (me.currentWordIndex >= localProgress.wordIndex && me.wordsSolved >= localProgress.wordsSolved) {
      setLocalProgress(null);
    }
  }, [localProgress, me]);

  const answer = useMemo(() => normalizeAnswer(activePuzzle?.phrase ?? ''), [activePuzzle?.phrase]);
  const lettersInAnswer = useMemo(() => {
    const set = new Set<string>();
    for (const ch of answer) {
      if (ch !== ' ') {
        set.add(ch);
      }
    }
    return set;
  }, [answer]);
  const wordRows = useMemo(() => buildAnswerRows(answer), [answer]);
  const wordLayout = useMemo(() => computeWordLayout(windowWidth), [windowWidth]);

  const roundKeyRef = useRef(`${wordIndex}-${activePuzzle?.id ?? ''}`);
  const timedMatchFinalizedRef = useRef(false);

  useEffect(() => {
    const key = `${wordIndex}-${activePuzzle?.id ?? ''}`;
    if (roundKeyRef.current === key) {
      return;
    }
    roundKeyRef.current = key;
    setGuessedLetters(new Set());
    setWrongCount(0);
    setRoundModal(null);
  }, [activePuzzle?.id, wordIndex]);

  const heartsLeft = Math.max(0, MAX_WRONG - wrongCount);
  const hasWon =
    Boolean(activePuzzle) &&
    lettersInAnswer.size > 0 &&
    [...lettersInAnswer].every((ch) => guessedLetters.has(ch));
  const hasLost = wrongCount >= MAX_WRONG;
  const isRoundLocked = hasWon || hasLost || roundModal !== null;
  const iFinished = wordIndex >= totalWords && totalWords > 0;
  const matchFinished = room.status === 'finished';
  const isMutualLoss = matchFinished && room.mutualLoss === true;
  const wonByForfeit = matchFinished && room.winnerUid === myUid && !opponent && !isMutualLoss;
  const betAmount = room.config.betAmount;
  const potAmount = room.potAmount ?? 0;
  const iWon = matchFinished && room.winnerUid === myUid && !isMutualLoss;

  const racePlayers = useMemo(
    () =>
      players.map((player) =>
        player.uid === myUid
          ? { ...player, wordsSolved: myWordsSolved, currentWordIndex: wordIndex }
          : player,
      ),
    [myUid, myWordsSolved, players, wordIndex],
  );

  useEffect(() => {
    if (!hasWon && !hasLost) {
      return;
    }
    setRoundModal(hasWon ? 'won' : 'lost');
  }, [hasLost, hasWon]);

  useEffect(() => {
    if (room.config.timerMode === 'none' || !activePuzzle || isRoundLocked || iFinished || matchFinished) {
      setSecondsLeft(null);
      return;
    }

    const limit =
      room.config.timerMode === 'per_word'
        ? room.config.secondsPerWord
        : room.config.totalSeconds;

    const startedAt = room.startedAt ?? Date.now();
    const elapsedTotal = Math.floor((Date.now() - startedAt) / 1000);
    const initial =
      room.config.timerMode === 'per_word'
        ? limit
        : Math.max(0, limit - elapsedTotal);

    setSecondsLeft(initial);

    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev == null) {
          return prev;
        }
        if (prev <= 1) {
          clearInterval(interval);
          if (room.config.timerMode === 'total' && !timedMatchFinalizedRef.current) {
            timedMatchFinalizedRef.current = true;
            void finalizeMultiplayerTimedMatch(roomId, myUid).catch(() => {
              timedMatchFinalizedRef.current = false;
            });
          } else {
            setRoundModal('lost');
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [
    activePuzzle,
    iFinished,
    isRoundLocked,
    matchFinished,
    myUid,
    room.config.secondsPerWord,
    room.config.timerMode,
    room.config.totalSeconds,
    room.startedAt,
    roomId,
    wordIndex,
  ]);

  const handleLetterPress = useCallback(
    (letter: string) => {
      if (!activePuzzle || isRoundLocked || iFinished || matchFinished) {
        return;
      }
      if (guessedLetters.has(letter)) {
        return;
      }
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setGuessedLetters((prev) => {
        const next = new Set(prev);
        next.add(letter);
        return next;
      });
      if (!lettersInAnswer.has(letter)) {
        setWrongCount((count) => Math.min(MAX_WRONG, count + 1));
      }
    },
    [activePuzzle, guessedLetters, iFinished, isRoundLocked, lettersInAnswer, matchFinished],
  );

  const handleNextWord = useCallback(async () => {
    if (advancing || totalWords <= 0) {
      return;
    }

    const nextIndex = wordIndex + 1;
    const nextWordsSolved = roundModal === 'won' ? myWordsSolved + 1 : myWordsSolved;

    setAdvancing(true);
    setAdvanceError('');
    try {
      await advanceMultiplayerWord(roomId, myUid, roundModal === 'won', totalWords);
      setLocalProgress({ wordIndex: nextIndex, wordsSolved: nextWordsSolved });
      setRoundModal(null);
      setGuessedLetters(new Set());
      setWrongCount(0);
    } catch (err) {
      setAdvanceError(err instanceof Error ? err.message : 'Could not advance to the next word.');
    } finally {
      setAdvancing(false);
    }
  }, [advancing, myUid, myWordsSolved, roomId, roundModal, totalWords, wordIndex]);

  const matchResultModal = (
    <Modal
      visible={matchFinished}
      transparent
      animationType="fade"
      statusBarTranslucent
      accessibilityViewIsModal
      onRequestClose={() => undefined}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <MaterialCommunityIcons
            name={isMutualLoss ? 'timer-off' : 'trophy'}
            size={72}
            color={isMutualLoss ? '#E74C3C' : '#FFD54F'}
            accessibilityLabel={isMutualLoss ? 'Time up' : 'Trophy'}
          />
          <Text style={styles.modalTitle}>
            {isMutualLoss
              ? 'Nobody wins!'
              : room.winnerUid === myUid
                ? 'You won the race!'
                : 'Race over'}
          </Text>
          <Text style={styles.modalSubtitle}>
            {isMutualLoss
              ? `Time ran out and neither player solved a phrase.${
                  betAmount > 0 ? ` You both lose your ${betAmount.toLocaleString()}-point stake.` : ''
                }`
              : wonByForfeit
                ? `Your opponent left the match. Victory is yours!${
                    potAmount > 0 && iWon ? ` You won ${potAmount.toLocaleString()} points!` : ''
                  }`
                : iWon
                  ? `You solved ${myWordsSolved} of ${totalWords} phrases first.${
                      potAmount > 0 ? ` You won ${potAmount.toLocaleString()} points!` : ''
                    }`
                  : `${opponent?.displayName ?? 'Your opponent'} won with ${opponent?.wordsSolved ?? 0}/${totalWords} solved.${
                      betAmount > 0 ? ` You lost ${betAmount.toLocaleString()} points.` : ''
                    }`}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go home"
            onPress={onHome}
            style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
            <Text style={styles.modalPrimaryBtnText}>HOME</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );

  if (puzzles.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>Loading puzzles…</Text>
      </View>
    );
  }

  if (iFinished && !matchFinished) {
    return (
      <>
        <View style={styles.centered}>
          <MaterialCommunityIcons name="flag-checkered" size={64} color="#FFD54F" />
          <Text style={styles.waitTitle}>You finished!</Text>
          <Text style={styles.waitBody}>Waiting for your opponent to complete the race…</Text>
          <View style={styles.waitProgressWrap}>
            <RaceProgressRow players={racePlayers} myUid={myUid} totalWords={totalWords} />
          </View>
        </View>
        {matchResultModal}
      </>
    );
  }

  return (
    <View style={styles.root}>
      <RaceProgressRow players={racePlayers} myUid={myUid} totalWords={totalWords} />

      <View style={styles.metaRow}>
        <Text style={styles.wordCounter}>
          Word {Math.min(wordIndex + 1, totalWords)} of {totalWords}
        </Text>
        {secondsLeft != null ? (
          <Text style={[styles.timerText, secondsLeft <= 10 && styles.timerUrgent]}>
            {secondsLeft}s
          </Text>
        ) : null}
      </View>

      {activePuzzle ? (
        <>
          <ScrollView
            style={styles.flexScroll}
            contentContainerStyle={styles.scrollInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            <View style={styles.categoryPill}>
              <Text style={styles.categoryText}>{activePuzzle.category}</Text>
            </View>

            <View style={styles.gameCard}>
              <View style={styles.cardRow}>
                <View style={styles.clueBox}>
                  <Text style={styles.clueLabel}>CLUE</Text>
                  <View style={styles.clueImageWrap}>
                    <Text style={styles.clueEmoji}>{activePuzzle.clueEmoji ?? '🦁'}</Text>
                  </View>
                </View>
                <View style={styles.clueCenter}>
                  <Text style={styles.clueLine}>{activePuzzle.clue}</Text>
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
                  {Array.from({ length: MAX_WRONG }, (_, index) => (
                    <MaterialCommunityIcons
                      key={index}
                      name={index < heartsLeft ? 'heart' : 'heart-outline'}
                      size={22}
                      color={index < heartsLeft ? '#2A93F4' : '#B8C4D4'}
                    />
                  ))}
                </View>
              </View>
            </View>

            <View style={[styles.wordBlock, { minHeight: wordLayout.slotH + 16 }]}>
              {wordRows.map((cells, rowIndex) => (
                <View
                  key={`answer-row-${rowIndex}`}
                  style={[
                    styles.wordRowLine,
                    { marginBottom: rowIndex === wordRows.length - 1 ? 0 : 10 },
                  ]}>
                  {cells.map((cell, cellIndex) => {
                    const isLast = cellIndex === cells.length - 1;
                    const marginEnd = isLast ? 0 : wordLayout.gap;

                    if (cell.kind === 'space') {
                      return (
                        <View
                          key={cell.key}
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
            <View style={styles.keyboard}>
              {KEYBOARD_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.keyRow}>
                  {row.map((letter) => {
                    const used = guessedLetters.has(letter);
                    const correct = used && lettersInAnswer.has(letter);
                    return (
                      <Pressable
                        key={letter}
                        accessibilityRole="button"
                        accessibilityLabel={`Letter ${letter}`}
                        accessibilityState={{ disabled: used || isRoundLocked }}
                        disabled={used || isRoundLocked}
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
        </>
      ) : null}

      <Modal
        visible={roundModal !== null && !matchFinished}
        transparent
        animationType="fade"
        statusBarTranslucent
        accessibilityViewIsModal
        onRequestClose={() => undefined}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons
              name={roundModal === 'won' ? 'trophy' : 'heart-broken'}
              size={64}
              color={roundModal === 'won' ? '#FFD54F' : '#E74C3C'}
            />
            <Text style={styles.modalTitle}>{roundModal === 'won' ? 'Solved!' : 'Out of lives'}</Text>
            {roundModal === 'lost' ? (
              <Text style={styles.modalAnswerText}>{answer}</Text>
            ) : (
              <Text style={styles.modalSubtitle}>Great job — keep racing!</Text>
            )}
            {advanceError ? (
              <Text style={styles.modalErrorText} accessibilityLiveRegion="polite">
                {advanceError}
              </Text>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next word"
              accessibilityState={{ disabled: advancing }}
              disabled={advancing}
              onPress={() => void handleNextWord()}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressed]}>
              {advancing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.modalPrimaryBtnText}>NEXT WORD</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {matchResultModal}
    </View>
  );
};

export default MultiplayerRaceGame;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  loadingText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  waitTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2d1f0e',
    textAlign: 'center',
  },
  waitBody: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5A3A0A',
    textAlign: 'center',
    lineHeight: 22,
  },
  waitProgressWrap: {
    width: '100%',
    marginTop: 8,
  },
  raceBar: {
    width: '100%',
    marginTop: 12,
  },
  raceProgressRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  raceProgressCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: '#E6D5C3',
  },
  raceProgressColYou: {
    borderColor: '#2A93F4',
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  raceHeader: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  racePlayerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 10,
    borderWidth: 2,
    borderColor: '#E6D5C3',
  },
  raceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 14,
    padding: 10,
  },
  raceAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#FFD54F',
  },
  raceColName: {
    fontSize: 12,
    fontWeight: '900',
    color: '#5A3A0A',
    textAlign: 'center',
    maxWidth: '100%',
  },
  raceColScore: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2A93F4',
  },
  racePlayerMeta: {
    flex: 1,
    gap: 4,
  },
  raceName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
    color: '#5A3A0A',
  },
  progressTrack: {
    height: 8,
    width: '100%',
    borderRadius: 4,
    backgroundColor: '#E8DCC8',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#72BE2C',
    borderRadius: 4,
  },
  raceScore: {
    fontWeight: '900',
    color: '#2A93F4',
    fontSize: 14,
  },
  raceScoreSmall: {
    fontWeight: '800',
    color: '#6B5344',
    fontSize: 11,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  wordCounter: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timerText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  timerUrgent: {
    color: '#FFD54F',
  },
  flexScroll: {
    flex: 1,
  },
  scrollInner: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  categoryPill: {
    alignSelf: 'center',
    backgroundColor: '#FFD54F',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 6,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#E6AC00',
  },
  categoryText: {
    color: '#5A3A0A',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
  },
  gameCard: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E6D5C3',
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
  },
  clueEmoji: {
    fontSize: 36,
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
  },
  letterSlotText: {
    color: '#FFFFFF',
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
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
    backgroundColor: '#B8B8B8',
    borderColor: '#999',
  },
  keyCapText: {
    color: '#4A3728',
    fontWeight: '900',
    fontSize: 16,
  },
  keyCapTextOn: {
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
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
    backgroundColor: '#FFF8EF',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E6D5C3',
    padding: 24,
    alignItems: 'center',
    gap: 10,
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
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#2d1f0e',
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5A3A0A',
    textAlign: 'center',
    lineHeight: 22,
  },
  modalErrorText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C0392B',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalAnswerText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#2A93F4',
    textAlign: 'center',
    letterSpacing: 1,
  },
  modalPrimaryBtn: {
    marginTop: 8,
    width: '100%',
    backgroundColor: '#72BE2C',
    borderWidth: 2,
    borderColor: '#4E961B',
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalPrimaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.4,
  },
});
