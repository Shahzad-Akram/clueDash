import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import AppConfirmModal from '@/components/app-confirm-modal';
import { multiplayerStyles as styles } from '@/components/multiplayer-styles';
import { useAuth } from '@/contexts/auth-context';
import {
  buildMultiplayerShareMessage,
  claimMultiplayerStakeRefund,
  kickMultiplayerPlayer,
  leaveMultiplayerRoom,
  startMultiplayerRoom,
  subscribeMultiplayerPlayers,
  subscribeMultiplayerRoom,
} from '@/lib/firebase/multiplayer-rooms';
import {
  MIN_MULTIPLAYER_PLAYERS_TO_START,
  MULTIPLAYER_TIMER_MODE_OPTIONS,
  type MultiplayerPlayer,
  type MultiplayerRoom,
} from '@/lib/firebase/multiplayer-types';
import { getProfileAvatarSource, type ProfileAvatarId } from '@/lib/profile-avatars';

const formatTimerSummary = (room: MultiplayerRoom): string => {
  const { config } = room;
  const modeLabel =
    MULTIPLAYER_TIMER_MODE_OPTIONS.find((option) => option.id === config.timerMode)?.label ??
    'Timer';
  if (config.timerMode === 'per_word') {
    return `${modeLabel} · ${config.secondsPerWord}s/word`;
  }
  if (config.timerMode === 'total') {
    const minutes = Math.round(config.totalSeconds / 60);
    return `${modeLabel} · ${minutes} min`;
  }
  return modeLabel;
};

const MultiplayerLobbyScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const { user, isLoggedIn, refreshProfile } = useAuth();
  const [fontsLoaded] = useFonts({
    Fredoka_700Bold,
    Fredoka_600SemiBold,
  });

  const normalizedRoomId = (roomId ?? '').trim().toUpperCase();
  const [room, setRoom] = useState<MultiplayerRoom | null>(null);
  const [players, setPlayers] = useState<MultiplayerPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [kickingUid, setKickingUid] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [kickTarget, setKickTarget] = useState<MultiplayerPlayer | null>(null);
  const kickedAlertShownRef = useRef(false);
  const lobbyClosedAlertShownRef = useRef(false);
  const wasInRoomRef = useRef(false);

  const titleFont = fontsLoaded ? ({ fontFamily: 'Fredoka_700Bold' } as const) : undefined;
  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const maxPlayers = room?.config.maxPlayers ?? 2;
  const isHost = Boolean(user && room && room.hostUid === user.uid);

  const displayPlayers = useMemo((): MultiplayerPlayer[] => {
    if (!room) {
      return players;
    }
    const byUid = new Map(players.map((player) => [player.uid, player]));
    return room.playerUids.map((uid) => {
      const existing = byUid.get(uid);
      if (existing) {
        return existing;
      }
      if (uid === user?.uid) {
        return {
          uid,
          displayName: user.name || 'Host',
          avatarId: user.avatarId,
          joinedAt: 0,
          isReady: true,
          wordsSolved: 0,
          currentWordIndex: 0,
        };
      }
      return {
        uid,
        displayName: 'Player',
        avatarId: 'user1',
        joinedAt: 0,
        isReady: true,
        wordsSolved: 0,
        currentWordIndex: 0,
      };
    });
  }, [players, room, user]);

  const canStart = Boolean(
    isHost && room?.status === 'lobby' && displayPlayers.length >= MIN_MULTIPLAYER_PLAYERS_TO_START,
  );

  useEffect(() => {
    if (!normalizedRoomId) {
      setLoading(false);
      setError('Invalid room.');
      return;
    }

    setLoading(true);
    const unsubRoom = subscribeMultiplayerRoom(
      normalizedRoomId,
      (nextRoom) => {
        setRoom(nextRoom);
        setLoading(false);
        if (!nextRoom) {
          setError('Room not found.');
        }
      },
      () => {
        setError('Could not load room.');
        setLoading(false);
      },
    );

    const unsubPlayers = subscribeMultiplayerPlayers(normalizedRoomId, setPlayers);

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [normalizedRoomId]);

  useEffect(() => {
    kickedAlertShownRef.current = false;
    lobbyClosedAlertShownRef.current = false;
    wasInRoomRef.current = false;
  }, [normalizedRoomId]);

  const handleKickedFromLobby = useCallback(() => {
    if (kickedAlertShownRef.current) {
      return;
    }
    kickedAlertShownRef.current = true;
    wasInRoomRef.current = false;
    void (async () => {
      if (user?.uid && normalizedRoomId) {
        const refunded = await claimMultiplayerStakeRefund(normalizedRoomId, user.uid);
        if (refunded) {
          await refreshProfile();
        }
      }
      router.replace('/multiplayer' as Href);
      Alert.alert(
        'Kicked from lobby',
        room?.config.betAmount
          ? 'The host removed you from this room. Your stake has been refunded.'
          : 'The host removed you from this room. You can join another match or create your own.',
        [{ text: 'OK' }],
      );
    })();
  }, [normalizedRoomId, refreshProfile, room?.config.betAmount, router, user?.uid]);

  const handleLobbyClosed = useCallback(() => {
    if (lobbyClosedAlertShownRef.current) {
      return;
    }
    lobbyClosedAlertShownRef.current = true;
    wasInRoomRef.current = false;
    void (async () => {
      if (user?.uid && normalizedRoomId) {
        const refunded = await claimMultiplayerStakeRefund(normalizedRoomId, user.uid);
        if (refunded) {
          await refreshProfile();
        }
      }
      router.replace('/multiplayer' as Href);
      Alert.alert(
        'Lobby closed',
        room?.config.betAmount
          ? 'The host left and closed this room. Your stake has been refunded.'
          : 'The host left and closed this room.',
        [{ text: 'OK' }],
      );
    })();
  }, [normalizedRoomId, refreshProfile, room?.config.betAmount, router, user?.uid]);

  useEffect(() => {
    if (room?.status === 'playing' || room?.status === 'countdown') {
      router.replace(`/multiplayer/play/${normalizedRoomId}` as Href);
    }
  }, [normalizedRoomId, room?.status, router]);

  useEffect(() => {
    if (!room || !user || loading) {
      return;
    }

    const isInRoom = room.playerUids.includes(user.uid);

    if (isInRoom) {
      wasInRoomRef.current = true;
      return;
    }

    if (wasInRoomRef.current && room.status === 'lobby') {
      handleKickedFromLobby();
    }
  }, [handleKickedFromLobby, loading, room, user]);

  useEffect(() => {
    if (!room || !user || loading || lobbyClosedAlertShownRef.current) {
      return;
    }

    if (room.status === 'abandoned' && wasInRoomRef.current) {
      handleLobbyClosed();
    }
  }, [handleLobbyClosed, loading, room, user]);

  const emptySlots = useMemo(() => {
    const occupied = Math.max(players.length, room?.playerUids.length ?? 0);
    const missing = Math.max(0, maxPlayers - occupied);
    return Array.from({ length: missing }, (_, index) => index);
  }, [maxPlayers, players.length, room?.playerUids.length]);

  const isHostLeaving = Boolean(room && user && room.hostUid === user.uid);

  const leaveModalMessage = useMemo(() => {
    const parts: string[] = [];
    if (isHostLeaving) {
      parts.push('You will close this room for all players.');
    } else {
      parts.push('You will exit this room.');
    }
    if (room?.config.betAmount && room.config.betAmount > 0) {
      parts.push(`Your ${room.config.betAmount.toLocaleString()}-point stake will be refunded.`);
    }
    return parts.join(' ');
  }, [isHostLeaving, room?.config.betAmount]);

  const handleCancelLeave = useCallback(() => {
    if (leaving) {
      return;
    }
    setShowLeaveModal(false);
  }, [leaving]);

  const handleConfirmLeave = useCallback(() => {
    void (async () => {
      if (!user || !normalizedRoomId) {
        router.replace('/multiplayer' as Href);
        return;
      }

      setLeaving(true);
      setError('');
      try {
        const refunded = await leaveMultiplayerRoom(normalizedRoomId, user.uid);
        if (refunded > 0) {
          await refreshProfile({
            untilPointsAtLeast: (user.points ?? 0) + refunded,
          });
        } else {
          await refreshProfile();
        }
        setShowLeaveModal(false);
        router.replace('/multiplayer' as Href);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not leave lobby.';
        const isPermissionError =
          err &&
          typeof err === 'object' &&
          'code' in err &&
          String((err as { code: string }).code).includes('permission');
        setError(
          isPermissionError
            ? 'Permission denied while closing the lobby. Deploy the latest Firestore rules, then try again.'
            : message,
        );
      } finally {
        setLeaving(false);
      }
    })();
  }, [normalizedRoomId, refreshProfile, router, user]);

  const handleBack = useCallback(() => {
    setShowLeaveModal(true);
  }, []);

  const handleConfirmKick = useCallback(() => {
    if (!user || !isHost || !kickTarget) {
      return;
    }

    void (async () => {
      setError('');
      setKickingUid(kickTarget.uid);
      try {
        await kickMultiplayerPlayer(normalizedRoomId, user.uid, kickTarget.uid);
        setKickTarget(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not remove player.');
      } finally {
        setKickingUid(null);
      }
    })();
  }, [isHost, kickTarget, normalizedRoomId, user]);

  const handleShare = useCallback(async () => {
    if (!normalizedRoomId) {
      return;
    }
    const message = buildMultiplayerShareMessage(normalizedRoomId);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'GuessUp', text: message });
        return;
      }
      await Share.share({ message, title: 'GuessUp' });
    } catch {
      // User dismissed share sheet.
    }
  }, [normalizedRoomId]);

  const handleStart = useCallback(async () => {
    if (!user || !normalizedRoomId || !canStart) {
      return;
    }
    setError('');
    setStarting(true);
    try {
      await startMultiplayerRoom(normalizedRoomId, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start match.');
    } finally {
      setStarting(false);
    }
  }, [canStart, normalizedRoomId, user]);

  const handleKickPlayer = useCallback(
    (player: MultiplayerPlayer) => {
      if (!user || !isHost || player.uid === user.uid) {
        return;
      }
      setKickTarget(player);
    },
    [isHost, user],
  );

  const startButtonLabel = useMemo(() => {
    if (!canStart) {
      return `NEED ${MIN_MULTIPLAYER_PLAYERS_TO_START}+ PLAYERS (${displayPlayers.length}/${maxPlayers})`;
    }
    if (players.length < maxPlayers) {
      return `START MATCH (${displayPlayers.length}/${maxPlayers})`;
    }
    return 'START MATCH';
  }, [canStart, displayPlayers.length, maxPlayers, players.length]);

  if (!isLoggedIn) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AppScreenHeader title="LOBBY" onBack={() => router.back()} showWallet={false} />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi, { textAlign: 'center' }]}>
            Sign in to join this lobby.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="LOBBY" onBack={handleBack} showWallet={isLoggedIn} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + insets.bottom }]}
        showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 24 }} />
        ) : room ? (
          <>
            <View style={styles.roomCodeHero}>
              <Text style={[styles.roomCodeLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                ROOM CODE
              </Text>
              <Text
                style={[styles.roomCodeValue, titleFont, !fontsLoaded && styles.fontFallbackBold]}
                accessibilityLabel={`Room code ${room.id}`}>
                {room.id}
              </Text>
              <View style={styles.configPillRow}>
                <View style={styles.configPill}>
                  <Text style={[styles.configPillText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                    {room.config.maxPlayers} players
                  </Text>
                </View>
                <View style={styles.configPill}>
                  <Text style={[styles.configPillText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                    {room.config.wordCount} words
                  </Text>
                </View>
                <View style={styles.configPill}>
                  <Text style={[styles.configPillText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                    {formatTimerSummary(room)}
                  </Text>
                </View>
                {room.config.betAmount > 0 ? (
                  <View style={styles.configPill}>
                    <Text style={[styles.configPillText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                      {room.config.betAmount.toLocaleString()} pt bet
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share room code"
              onPress={() => void handleShare()}
              style={({ pressed }) => [
                styles.secondaryBtn,
                pressed && styles.primaryBtnPressed,
              ]}>
              <Text style={[styles.secondaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
                SHARE CODE
              </Text>
            </Pressable>

            <Text style={[styles.sectionLabel, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
              Players ({displayPlayers.length}/{maxPlayers})
            </Text>

            {displayPlayers.map((player) => (
              <View key={player.uid} style={styles.playerSlot}>
                <Image
                  source={getProfileAvatarSource(player.avatarId as ProfileAvatarId)}
                  style={styles.playerAvatar}
                  contentFit="cover"
                  accessibilityLabel={player.displayName}
                />
                <Text
                  style={[styles.playerName, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
                  numberOfLines={1}>
                  {player.displayName}
                  {player.uid === user?.uid ? ' (You)' : ''}
                </Text>
                {player.uid === room.hostUid ? (
                  <View style={styles.hostBadge}>
                    <Text style={[styles.hostBadgeText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                      HOST
                    </Text>
                  </View>
                ) : isHost ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${player.displayName} from room`}
                    accessibilityState={{ disabled: kickingUid === player.uid }}
                    disabled={kickingUid === player.uid}
                    onPress={() => handleKickPlayer(player)}
                    style={({ pressed }) => [
                      styles.kickBtn,
                      pressed && styles.kickBtnPressed,
                      kickingUid === player.uid && styles.kickBtnDisabled,
                    ]}>
                    {kickingUid === player.uid ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialCommunityIcons name="account-remove" size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                ) : null}
              </View>
            ))}

            {emptySlots.map((slot) => (
              <View key={`empty-${slot}`} style={[styles.playerSlot, styles.playerSlotEmpty]}>
                <View
                  style={[
                    styles.playerAvatar,
                    { backgroundColor: '#EDE4D8', borderWidth: 1, borderColor: '#D8C59A' },
                  ]}
                />
                <Text style={[styles.waitingText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                  Waiting for player…
                </Text>
              </View>
            ))}

            {isHost ? (
              <>
                {error ? (
                  <Text
                    style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}
                    accessibilityLiveRegion="polite">
                    {error}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Start match"
                  accessibilityState={{ disabled: !canStart || starting }}
                  disabled={!canStart || starting}
                  onPress={() => void handleStart()}
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    pressed && canStart && !starting && styles.primaryBtnPressed,
                    (!canStart || starting) && styles.primaryBtnDisabled,
                  ]}>
                  {starting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={[styles.primaryBtnText, titleFont, !fontsLoaded && styles.fontFallbackBold]}>
                      {startButtonLabel}
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <View style={styles.introCard}>
                <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
                  You&apos;re in! The host will start the race when everyone is ready.
                </Text>
              </View>
            )}
          </>
        ) : (
          <Text style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            {error || 'Room not found.'}
          </Text>
        )}
      </ScrollView>

      <AppConfirmModal
        visible={showLeaveModal}
        title={isHostLeaving ? 'Close lobby?' : 'Leave lobby?'}
        message={leaveModalMessage}
        icon={isHostLeaving ? 'door-closed' : 'exit-run'}
        iconColor={isHostLeaving ? '#E74C3C' : '#2A93F4'}
        cancelLabel="Stay"
        confirmLabel={isHostLeaving ? 'Close lobby' : 'Leave'}
        confirmVariant="destructive"
        loading={leaving}
        onCancel={handleCancelLeave}
        onConfirm={handleConfirmLeave}
      />

      <AppConfirmModal
        visible={kickTarget !== null}
        title="Remove player?"
        message={
          kickTarget
            ? `Remove ${kickTarget.displayName} from the lobby? They can rejoin with the room code if there is space.`
            : ''
        }
        icon="account-remove"
        iconColor="#E74C3C"
        cancelLabel="Cancel"
        confirmLabel="Remove"
        confirmVariant="destructive"
        loading={kickingUid === kickTarget?.uid}
        onCancel={() => setKickTarget(null)}
        onConfirm={handleConfirmKick}
      />
    </SafeAreaView>
  );
};

export default MultiplayerLobbyScreen;
