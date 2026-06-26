import { Fredoka_600SemiBold, Fredoka_700Bold, useFonts } from '@expo-google-fonts/fredoka';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppScreenHeader } from '@/components/app-screen-header';
import MultiplayerRaceGame from '@/components/multiplayer-race-game';
import { multiplayerStyles as styles } from '@/components/multiplayer-styles';
import { useAuth } from '@/contexts/auth-context';
import {
  claimMultiplayerWinnings,
  leaveMultiplayerRoom,
  subscribeMultiplayerPlayers,
  subscribeMultiplayerRoom,
} from '@/lib/firebase/multiplayer-rooms';
import type { MultiplayerPlayer, MultiplayerRoom } from '@/lib/firebase/multiplayer-types';

const MultiplayerPlayScreen = () => {
  const router = useRouter();
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

  const bodyFont = fontsLoaded ? ({ fontFamily: 'Fredoka_600SemiBold' } as const) : undefined;

  const displayPlayers = useMemo((): MultiplayerPlayer[] => {
    if (!room || !user) {
      return players;
    }

    const byUid = new Map(players.map((player) => [player.uid, player]));
    return room.playerUids.map((uid) => {
      const existing = byUid.get(uid);
      const progress = room.playerProgress?.[uid];

      const base: MultiplayerPlayer =
        existing ??
        (uid === user.uid
          ? {
              uid,
              displayName: user.name || 'You',
              avatarId: user.avatarId,
              joinedAt: 0,
              isReady: true,
              wordsSolved: 0,
              currentWordIndex: 0,
            }
          : {
              uid,
              displayName: 'Player',
              avatarId: 'user1',
              joinedAt: 0,
              isReady: true,
              wordsSolved: 0,
              currentWordIndex: 0,
            });

      if (!progress) {
        return base;
      }

      return {
        ...base,
        currentWordIndex: progress.currentWordIndex,
        wordsSolved: progress.wordsSolved,
        finishedAt: progress.finishedAt ?? base.finishedAt,
      };
    });
  }, [players, room, user]);

  useEffect(() => {
    if (!normalizedRoomId) {
      setLoading(false);
      return;
    }

    const unsubRoom = subscribeMultiplayerRoom(normalizedRoomId, (nextRoom) => {
      setRoom(nextRoom);
      setLoading(false);
      if (nextRoom?.status === 'lobby') {
        router.replace(`/multiplayer/lobby/${normalizedRoomId}` as Href);
      }
    });

    const unsubPlayers = subscribeMultiplayerPlayers(normalizedRoomId, setPlayers);

    return () => {
      unsubRoom();
      unsubPlayers();
    };
  }, [normalizedRoomId, router]);

  useEffect(() => {
    if (!room || !user || room.status !== 'finished' || room.betsSettled) {
      return;
    }
    if (room.winnerUid !== user.uid || !room.potAmount || room.potAmount <= 0 || room.mutualLoss) {
      return;
    }

    void (async () => {
      const claimed = await claimMultiplayerWinnings(normalizedRoomId, user.uid);
      if (claimed) {
        await refreshProfile({ untilPointsAtLeast: (user.points ?? 0) + room.potAmount! });
      }
    })();
  }, [normalizedRoomId, refreshProfile, room, user]);

  const handleBack = useCallback(() => {
    const leaveMatch = () => {
      if (!user) {
        router.replace('/multiplayer' as Href);
        return;
      }
      void (async () => {
        try {
          await leaveMultiplayerRoom(normalizedRoomId, user.uid);
        } catch {
          // Still navigate away.
        }
        router.replace('/multiplayer' as Href);
      })();
    };

    if (room?.status === 'playing' && user) {
      const betNote =
        room.config.betAmount > 0
          ? ` You will lose your ${room.config.betAmount.toLocaleString()}-point stake.`
          : '';
      Alert.alert(
        'Leave match?',
        `If you leave, your opponent wins the race.${betNote} Are you sure you want to quit?`,
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave match', style: 'destructive', onPress: leaveMatch },
        ],
      );
      return;
    }

    router.replace('/multiplayer' as Href);
  }, [normalizedRoomId, room?.config.betAmount, room?.status, router, user]);

  const handleHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  if (!isLoggedIn || !user) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <AppScreenHeader title="RACE" onBack={handleBack} showWallet={false} />
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <Text style={[styles.introBody, bodyFont, !fontsLoaded && styles.fontFallbackSemi, { textAlign: 'center' }]}>
            Sign in to play this match.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <AppScreenHeader title="RACE" onBack={handleBack} showWallet={isLoggedIn} />
      {loading ? (
        <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 24 }} />
      ) : room && room.status !== 'lobby' ? (
        <MultiplayerRaceGame
          roomId={normalizedRoomId}
          room={room}
          players={displayPlayers}
          myUid={user.uid}
          onHome={handleHome}
        />
      ) : (
        <View style={[styles.scrollContent, { flex: 1, justifyContent: 'center' }]}>
          <Text style={[styles.errorText, bodyFont, !fontsLoaded && styles.fontFallbackSemi]}>
            Room not found or match has not started.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
};

export default MultiplayerPlayScreen;
