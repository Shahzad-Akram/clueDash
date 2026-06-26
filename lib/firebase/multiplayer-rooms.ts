import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  updateDoc,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';

import { fetchGuessPuzzlesOrdered } from '@/lib/firebase/guesses';
import { getFirebaseDb } from '@/lib/firebase/app';
import {
  DEFAULT_MULTIPLAYER_CONFIG,
  MIN_MULTIPLAYER_PLAYERS_TO_START,
  MULTIPLAYER_MAX_PLAYERS_OPTIONS,
  type MultiplayerPlayer,
  type MultiplayerPlayerProgress,
  type MultiplayerRoom,
  type MultiplayerRoomConfig,
  type MultiplayerRoomStatus,
} from '@/lib/firebase/multiplayer-types';
import { awardUserPoints, readUserPoints } from '@/lib/firebase/points';
import { USERS_COLLECTION } from '@/lib/firebase/user-profile';
import type { ProfileAvatarId } from '@/lib/profile-avatars';

const ROOMS_COLLECTION = 'rooms';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const roomRef = (roomId: string) => doc(getFirebaseDb(), ROOMS_COLLECTION, roomId);

const playerRef = (roomId: string, uid: string) =>
  doc(getFirebaseDb(), ROOMS_COLLECTION, roomId, 'players', uid);

const userRef = (uid: string) => doc(getFirebaseDb(), USERS_COLLECTION, uid);

const parseBetAmount = (raw: unknown): number => {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    return 0;
  }
  return Math.max(0, Math.round(raw));
};

const readPlayerStake = (raw: unknown): number => parseBetAmount(raw);

const resolveLobbyStake = (
  room: MultiplayerRoom,
  playerData: Record<string, unknown> | undefined,
): number => {
  const stakeFromDoc = playerData ? readPlayerStake(playerData.stakeAmount) : 0;
  if (stakeFromDoc > 0) {
    return stakeFromDoc;
  }
  if (room.status === 'lobby' || room.status === 'abandoned') {
    return room.config.betAmount > 0 ? room.config.betAmount : 0;
  }
  return 0;
};

const toMillis = (value: unknown): number | undefined => {
  if (value && typeof value === 'object' && 'toMillis' in value) {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return undefined;
};

const parseRoomConfig = (raw: unknown): MultiplayerRoomConfig => {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const timerMode =
    data.timerMode === 'none' || data.timerMode === 'per_word' || data.timerMode === 'total'
      ? data.timerMode
      : DEFAULT_MULTIPLAYER_CONFIG.timerMode;
  const wordCount =
    typeof data.wordCount === 'number' && data.wordCount > 0
      ? Math.min(10, Math.round(data.wordCount))
      : DEFAULT_MULTIPLAYER_CONFIG.wordCount;
  const secondsPerWord =
    typeof data.secondsPerWord === 'number' && data.secondsPerWord > 0
      ? data.secondsPerWord
      : DEFAULT_MULTIPLAYER_CONFIG.secondsPerWord;
  const totalSeconds =
    typeof data.totalSeconds === 'number' && data.totalSeconds > 0
      ? data.totalSeconds
      : DEFAULT_MULTIPLAYER_CONFIG.totalSeconds;
  const maxPlayersRaw =
    typeof data.maxPlayers === 'number' && data.maxPlayers > 0
      ? Math.round(data.maxPlayers)
      : DEFAULT_MULTIPLAYER_CONFIG.maxPlayers;
  const maxPlayers = (MULTIPLAYER_MAX_PLAYERS_OPTIONS as readonly number[]).includes(maxPlayersRaw)
    ? maxPlayersRaw
    : DEFAULT_MULTIPLAYER_CONFIG.maxPlayers;
  const betAmount = parseBetAmount(data.betAmount);
  return { wordCount, timerMode, secondsPerWord, totalSeconds, maxPlayers, betAmount };
};

const parsePlayerProgress = (raw: unknown): Record<string, MultiplayerPlayerProgress> => {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const result: Record<string, MultiplayerPlayerProgress> = {};
  for (const [uid, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') {
      continue;
    }
    const data = value as Record<string, unknown>;
    result[uid] = {
      currentWordIndex:
        typeof data.currentWordIndex === 'number' ? Math.max(0, Math.round(data.currentWordIndex)) : 0,
      wordsSolved: typeof data.wordsSolved === 'number' ? Math.max(0, Math.round(data.wordsSolved)) : 0,
      finishedAt: toMillis(data.finishedAt),
    };
  }
  return result;
};

const parseRoom = (roomId: string, raw: Record<string, unknown>): MultiplayerRoom => ({
  id: roomId,
  hostUid: String(raw.hostUid ?? ''),
  status: (raw.status as MultiplayerRoomStatus) ?? 'lobby',
  config: parseRoomConfig(raw.config),
  puzzleIds: Array.isArray(raw.puzzleIds) ? raw.puzzleIds.map(String) : [],
  playerUids: Array.isArray(raw.playerUids) ? raw.playerUids.map(String) : [],
  createdAt: toMillis(raw.createdAt) ?? Date.now(),
  startedAt: toMillis(raw.startedAt),
  winnerUid: raw.winnerUid == null ? null : String(raw.winnerUid),
  potAmount: typeof raw.potAmount === 'number' && raw.potAmount > 0 ? Math.round(raw.potAmount) : undefined,
  betsSettled: raw.betsSettled === true,
  mutualLoss: raw.mutualLoss === true,
  playerProgress: parsePlayerProgress(raw.playerProgress),
});

const parsePlayer = (uid: string, raw: Record<string, unknown>): MultiplayerPlayer => ({
  uid,
  displayName: String(raw.displayName ?? 'Player'),
  avatarId: String(raw.avatarId ?? 'user1'),
  joinedAt: toMillis(raw.joinedAt) ?? Date.now(),
  isReady: raw.isReady !== false,
  wordsSolved: typeof raw.wordsSolved === 'number' ? raw.wordsSolved : 0,
  currentWordIndex: typeof raw.currentWordIndex === 'number' ? raw.currentWordIndex : 0,
  finishedAt: toMillis(raw.finishedAt),
});

export const generateRoomCode = (): string => {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
};

const shuffleIds = <T>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
};

export type CreateRoomInput = {
  hostUid: string;
  displayName: string;
  avatarId: ProfileAvatarId;
  config?: Partial<MultiplayerRoomConfig>;
};

export const createMultiplayerRoom = async ({
  hostUid,
  displayName,
  avatarId,
  config,
}: CreateRoomInput): Promise<string> => {
  const mergedConfig: MultiplayerRoomConfig = {
    ...DEFAULT_MULTIPLAYER_CONFIG,
    ...config,
    betAmount: parseBetAmount(config?.betAmount ?? DEFAULT_MULTIPLAYER_CONFIG.betAmount),
  };
  const betAmount = mergedConfig.betAmount;

  for (let attempt = 0; attempt < 8; attempt++) {
    const roomId = generateRoomCode();
    const ref = roomRef(roomId);

    try {
      await runTransaction(getFirebaseDb(), async (tx) => {
        const hostUserSnap = await tx.get(userRef(hostUid));
        if (!hostUserSnap.exists()) {
          throw new Error('Create a profile before hosting a room.');
        }
        const hostPoints = readUserPoints(hostUserSnap.data()?.points);
        if (betAmount > hostPoints) {
          throw new Error(`Bet cannot exceed your balance (${hostPoints.toLocaleString()} points).`);
        }

        const existing = await tx.get(ref);
        if (existing.exists()) {
          throw new Error('ROOM_CODE_COLLISION');
        }

        if (betAmount > 0) {
          tx.update(userRef(hostUid), { points: increment(-betAmount) });
        }

        tx.set(ref, {
          hostUid,
          status: 'lobby',
          config: mergedConfig,
          puzzleIds: [],
          playerUids: [hostUid],
          createdAt: serverTimestamp(),
          winnerUid: null,
          betsSettled: false,
        });

        tx.set(playerRef(roomId, hostUid), {
          displayName,
          avatarId,
          joinedAt: serverTimestamp(),
          isReady: true,
          wordsSolved: 0,
          currentWordIndex: 0,
          stakeAmount: betAmount,
        });
      });

      return roomId;
    } catch (err) {
      if (err instanceof Error && err.message === 'ROOM_CODE_COLLISION') {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Could not create a room. Please try again.');
};

export type JoinRoomInput = {
  roomId: string;
  uid: string;
  displayName: string;
  avatarId: ProfileAvatarId;
};

export const joinMultiplayerRoom = async ({
  roomId,
  uid,
  displayName,
  avatarId,
}: JoinRoomInput): Promise<void> => {
  const normalizedId = roomId.trim().toUpperCase();
  if (normalizedId.length < 4) {
    throw new Error('Enter a valid room code.');
  }

  await runTransaction(getFirebaseDb(), async (tx) => {
    const ref = roomRef(normalizedId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('Room not found. Check the code and try again.');
    }

    const room = parseRoom(normalizedId, snap.data() as Record<string, unknown>);
    if (room.status === 'abandoned') {
      throw new Error('This room has been closed.');
    }
    if (room.status !== 'lobby') {
      throw new Error('This match has already started.');
    }
    if (room.playerUids.includes(uid)) {
      return;
    }
    if (room.playerUids.length >= room.config.maxPlayers) {
      throw new Error('This room is full.');
    }

    const betAmount = room.config.betAmount;
    const joinerSnap = await tx.get(userRef(uid));
    if (!joinerSnap.exists()) {
      throw new Error('Create a profile before joining a room.');
    }
    const joinerPoints = readUserPoints(joinerSnap.data()?.points);
    if (betAmount > joinerPoints) {
      throw new Error(
        `You need at least ${betAmount.toLocaleString()} points to join this room (you have ${joinerPoints.toLocaleString()}).`,
      );
    }

    if (betAmount > 0) {
      tx.update(userRef(uid), { points: increment(-betAmount) });
    }

    tx.update(ref, {
      playerUids: [...room.playerUids, uid],
    });

    tx.set(playerRef(normalizedId, uid), {
      displayName,
      avatarId,
      joinedAt: serverTimestamp(),
      isReady: true,
      wordsSolved: 0,
      currentWordIndex: 0,
      stakeAmount: betAmount,
    });
  });
};

export const fetchMultiplayerRoom = async (roomId: string): Promise<MultiplayerRoom | null> => {
  const snap = await getDoc(roomRef(roomId.trim().toUpperCase()));
  if (!snap.exists()) {
    return null;
  }
  return parseRoom(snap.id, snap.data() as Record<string, unknown>);
};

export const subscribeMultiplayerRoom = (
  roomId: string,
  onChange: (room: MultiplayerRoom | null) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const normalizedId = roomId.trim().toUpperCase();
  return onSnapshot(
    roomRef(normalizedId),
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(parseRoom(snap.id, snap.data() as Record<string, unknown>));
    },
    (error) => {
      onError?.(error);
      onChange(null);
    },
  );
};

export const subscribeMultiplayerPlayers = (
  roomId: string,
  onChange: (players: MultiplayerPlayer[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe => {
  const normalizedId = roomId.trim().toUpperCase();
  const playersByUid = new Map<string, MultiplayerPlayer>();
  const playerUnsubs = new Map<string, Unsubscribe>();
  let orderedUids: string[] = [];

  const emitPlayers = () => {
    const players = orderedUids
      .map((uid) => playersByUid.get(uid))
      .filter((player): player is MultiplayerPlayer => Boolean(player))
      .sort((a, b) => a.joinedAt - b.joinedAt);
    onChange(players);
  };

  const clearPlayerListeners = () => {
    for (const unsub of playerUnsubs.values()) {
      unsub();
    }
    playerUnsubs.clear();
    playersByUid.clear();
    orderedUids = [];
  };

  const syncUidListeners = (uids: string[]) => {
    const nextUidSet = new Set(uids);

    for (const uid of playerUnsubs.keys()) {
      if (!nextUidSet.has(uid)) {
        playerUnsubs.get(uid)?.();
        playerUnsubs.delete(uid);
        playersByUid.delete(uid);
      }
    }

    for (const uid of uids) {
      if (playerUnsubs.has(uid)) {
        continue;
      }

      const unsub = onSnapshot(
        playerRef(normalizedId, uid),
        (snap) => {
          if (snap.exists()) {
            playersByUid.set(uid, parsePlayer(snap.id, snap.data() as Record<string, unknown>));
          } else {
            playersByUid.delete(uid);
          }
          emitPlayers();
        },
        (error) => {
          onError?.(error);
          playersByUid.delete(uid);
          emitPlayers();
        },
      );
      playerUnsubs.set(uid, unsub);
    }

    orderedUids = [...uids];
    emitPlayers();
  };

  const unsubRoom = onSnapshot(
    roomRef(normalizedId),
    (snap) => {
      if (!snap.exists()) {
        clearPlayerListeners();
        onChange([]);
        return;
      }

      const room = parseRoom(snap.id, snap.data() as Record<string, unknown>);
      syncUidListeners(room.playerUids);
    },
    (error) => {
      onError?.(error);
      clearPlayerListeners();
      onChange([]);
    },
  );

  return () => {
    unsubRoom();
    clearPlayerListeners();
  };
};

export const startMultiplayerRoom = async (roomId: string, hostUid: string): Promise<void> => {
  const normalizedId = roomId.trim().toUpperCase();
  const puzzles = await fetchGuessPuzzlesOrdered();
  if (puzzles.length === 0) {
    throw new Error('No puzzles available. Try again later.');
  }

  await runTransaction(getFirebaseDb(), async (tx) => {
    const ref = roomRef(normalizedId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('Room not found.');
    }

    const room = parseRoom(normalizedId, snap.data() as Record<string, unknown>);
    if (room.hostUid !== hostUid) {
      throw new Error('Only the host can start the match.');
    }
    if (room.status !== 'lobby') {
      throw new Error('This match has already started.');
    }
    if (room.playerUids.length < MIN_MULTIPLAYER_PLAYERS_TO_START) {
      throw new Error(`Need at least ${MIN_MULTIPLAYER_PLAYERS_TO_START} players to start.`);
    }

    const betAmount = room.config.betAmount;

    const puzzleIds = shuffleIds(puzzles.map((p) => p.id)).slice(0, room.config.wordCount);
    if (puzzleIds.length < room.config.wordCount) {
      throw new Error('Not enough puzzles for this match.');
    }

    const playerProgress = Object.fromEntries(
      room.playerUids.map((playerUid) => [
        playerUid,
        { currentWordIndex: 0, wordsSolved: 0 },
      ]),
    );

    const roomUpdate: Record<string, unknown> = {
      status: 'playing',
      puzzleIds,
      startedAt: serverTimestamp(),
      playerProgress,
    };
    if (betAmount > 0) {
      roomUpdate.potAmount = betAmount * room.playerUids.length;
    }

    tx.update(ref, roomUpdate);
  });
};

export const leaveMultiplayerRoom = async (roomId: string, uid: string): Promise<number> => {
  const normalizedId = roomId.trim().toUpperCase();
  const ref = roomRef(normalizedId);
  const pRef = playerRef(normalizedId, uid);

  const [roomSnap, playerSnap] = await Promise.all([getDoc(ref), getDoc(pRef)]);
  if (!roomSnap.exists()) {
    return 0;
  }

  const room = parseRoom(normalizedId, roomSnap.data() as Record<string, unknown>);
  const isLobby = room.status === 'lobby';
  const playerDocExisted = playerSnap.exists();
  const lobbyStake = isLobby
    ? resolveLobbyStake(
        room,
        playerSnap.exists() ? (playerSnap.data() as Record<string, unknown>) : undefined,
      )
    : 0;
  const shouldRefund = isLobby && lobbyStake > 0;
  const isHostLeavingLobby = isLobby && room.hostUid === uid;
  const nextPlayerUids = room.playerUids.filter((id) => id !== uid);
  const updates: Record<string, unknown> = {};

  if (isLobby) {
    if (isHostLeavingLobby) {
      updates.status = 'abandoned';
      updates.playerUids = [];
    } else {
      updates.playerUids = nextPlayerUids;
      if (nextPlayerUids.length === 0) {
        updates.status = 'abandoned';
      }
    }
  } else if (room.status === 'playing' || room.status === 'countdown') {
    updates.playerUids = nextPlayerUids;
    if (nextPlayerUids.length === 1) {
      updates.winnerUid = nextPlayerUids[0];
      updates.status = 'finished';
    } else if (nextPlayerUids.length === 0) {
      updates.winnerUid = uid;
      updates.status = 'finished';
    }
  } else {
    updates.playerUids = nextPlayerUids;
  }

  await updateDoc(ref, updates);

  if (shouldRefund && playerDocExisted) {
    const awarded = await awardUserPoints(uid, lobbyStake);
    if (!awarded.ok) {
      const claimed = await claimMultiplayerStakeRefund(normalizedId, uid);
      if (!claimed) {
        throw new Error('Could not refund your stake. Please try again.');
      }
    }

    try {
      await deleteDoc(pRef);
    } catch {
      // claimMultiplayerStakeRefund may have already removed the player doc.
    }

    return lobbyStake;
  }

  if (playerDocExisted) {
    try {
      await deleteDoc(pRef);
    } catch {
      // No-op.
    }
  }

  return 0;
};

export const kickMultiplayerPlayer = async (
  roomId: string,
  hostUid: string,
  targetUid: string,
): Promise<void> => {
  const normalizedId = roomId.trim().toUpperCase();
  if (hostUid === targetUid) {
    throw new Error('You cannot remove yourself. Leave the room instead.');
  }

  const ref = roomRef(normalizedId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Room not found.');
  }

  const room = parseRoom(normalizedId, snap.data() as Record<string, unknown>);
  if (room.hostUid !== hostUid) {
    throw new Error('Only the host can remove players.');
  }
  if (room.status !== 'lobby') {
    throw new Error('Players can only be removed before the match starts.');
  }
  if (!room.playerUids.includes(targetUid)) {
    throw new Error('That player is not in this room.');
  }

  const nextPlayerUids = room.playerUids.filter((id) => id !== targetUid);

  // Update room first — host always has lobby update rights. Kicked player claims stake refund themselves.
  await updateDoc(ref, { playerUids: nextPlayerUids });
};

export const buildMultiplayerShareMessage = (roomId: string): string => {
  const code = roomId.trim().toUpperCase();
  return `Join my GuessUp race! Room code: ${code}\n\nOpen GuessUp and tap Play with Friends → Join Room.`;
};

const isTimedMultiplayerMatch = (config: MultiplayerRoomConfig): boolean =>
  config.timerMode === 'per_word' || config.timerMode === 'total';

const buildProgressMap = (
  room: MultiplayerRoom,
  uid: string,
  progress: MultiplayerPlayerProgress,
): Record<string, MultiplayerPlayerProgress> => ({
  ...(room.playerProgress ?? {}),
  [uid]: progress,
});

const allPlayersFinished = (
  room: MultiplayerRoom,
  progressMap: Record<string, MultiplayerPlayerProgress>,
  totalWords: number,
): boolean =>
  room.playerUids.every((playerUid) => (progressMap[playerUid]?.currentWordIndex ?? 0) >= totalWords);

const allPlayersSolvedZero = (
  room: MultiplayerRoom,
  progressMap: Record<string, MultiplayerPlayerProgress>,
): boolean =>
  room.playerUids.every((playerUid) => (progressMap[playerUid]?.wordsSolved ?? 0) === 0);

const pickWinnerByWordsSolved = (
  room: MultiplayerRoom,
  progressMap: Record<string, MultiplayerPlayerProgress>,
): string => {
  let winnerUid = room.playerUids[0] ?? '';
  let bestScore = -1;
  for (const playerUid of room.playerUids) {
    const score = progressMap[playerUid]?.wordsSolved ?? 0;
    if (score > bestScore) {
      bestScore = score;
      winnerUid = playerUid;
    }
  }
  return winnerUid;
};

type MatchFinishUpdate = Record<string, unknown> | null;

const resolveTimedMatchFinish = (
  room: MultiplayerRoom,
  progressMap: Record<string, MultiplayerPlayerProgress>,
  totalWords: number,
  finishingUid: string,
  finishingProgress: MultiplayerPlayerProgress,
): MatchFinishUpdate => {
  if (room.winnerUid || room.mutualLoss || room.status !== 'playing') {
    return null;
  }

  const merged = buildProgressMap(room, finishingUid, finishingProgress);
  const playerFinished = finishingProgress.currentWordIndex >= totalWords;

  if (playerFinished && finishingProgress.wordsSolved > 0) {
    return {
      winnerUid: finishingUid,
      status: 'finished',
    };
  }

  if (!allPlayersFinished(room, merged, totalWords)) {
    return null;
  }

  if (isTimedMultiplayerMatch(room.config) && allPlayersSolvedZero(room, merged)) {
    return {
      winnerUid: null,
      mutualLoss: true,
      status: 'finished',
      betsSettled: true,
    };
  }

  return {
    winnerUid: pickWinnerByWordsSolved(room, merged),
    status: 'finished',
  };
};

/** End a total-timer match when the clock runs out. */
export const finalizeMultiplayerTimedMatch = async (roomId: string, uid: string): Promise<void> => {
  const normalizedId = roomId.trim().toUpperCase();

  await runTransaction(getFirebaseDb(), async (tx) => {
    const rRef = roomRef(normalizedId);
    const rSnap = await tx.get(rRef);
    if (!rSnap.exists()) {
      throw new Error('Room not found.');
    }

    const room = parseRoom(normalizedId, rSnap.data() as Record<string, unknown>);
    if (!room.playerUids.includes(uid)) {
      throw new Error('You are not in this match.');
    }
    if (
      room.status !== 'playing' ||
      room.config.timerMode !== 'total' ||
      room.winnerUid ||
      room.mutualLoss
    ) {
      return;
    }

    const progressMap = room.playerProgress ?? {};
    const roomUpdate: Record<string, unknown> = {
      status: 'finished',
    };

    if (allPlayersSolvedZero(room, progressMap)) {
      roomUpdate.winnerUid = null;
      roomUpdate.mutualLoss = true;
      roomUpdate.betsSettled = true;
    } else {
      roomUpdate.winnerUid = pickWinnerByWordsSolved(room, progressMap);
    }

    tx.update(rRef, roomUpdate);
  });
};

/** Advance to the next word after a win or loss; claim match win when all words are done. */
export const advanceMultiplayerWord = async (
  roomId: string,
  uid: string,
  solved: boolean,
  totalWords: number,
): Promise<void> => {
  const normalizedId = roomId.trim().toUpperCase();
  if (totalWords <= 0) {
    throw new Error('Invalid match configuration.');
  }

  await runTransaction(getFirebaseDb(), async (tx) => {
    const rRef = roomRef(normalizedId);
    const rSnap = await tx.get(rRef);
    if (!rSnap.exists()) {
      throw new Error('Room not found.');
    }

    const room = parseRoom(normalizedId, rSnap.data() as Record<string, unknown>);
    if (room.status !== 'playing') {
      throw new Error('This match is not active.');
    }
    if (!room.playerUids.includes(uid)) {
      throw new Error('You are not in this match.');
    }

    const existing =
      room.playerProgress?.[uid] ??
      ({
        currentWordIndex: 0,
        wordsSolved: 0,
      } satisfies MultiplayerPlayerProgress);

    const nextIndex = existing.currentWordIndex + 1;
    const nextWordsSolved = solved ? existing.wordsSolved + 1 : existing.wordsSolved;
    const playerFinished = nextIndex >= totalWords;
    const nextProgress: MultiplayerPlayerProgress = {
      currentWordIndex: nextIndex,
      wordsSolved: nextWordsSolved,
    };

    const roomUpdate: Record<string, unknown> = {
      [`playerProgress.${uid}.currentWordIndex`]: nextIndex,
      [`playerProgress.${uid}.wordsSolved`]: nextWordsSolved,
    };

    if (playerFinished) {
      roomUpdate[`playerProgress.${uid}.finishedAt`] = serverTimestamp();
      const finishUpdate = resolveTimedMatchFinish(room, room.playerProgress ?? {}, totalWords, uid, {
        ...nextProgress,
        finishedAt: Date.now(),
      });
      if (finishUpdate) {
        Object.assign(roomUpdate, finishUpdate);
      }
    }

    tx.update(rRef, roomUpdate);
  });

  const pRef = playerRef(normalizedId, uid);
  try {
    const pSnap = await getDoc(pRef);
    if (!pSnap.exists()) {
      return;
    }
    const player = parsePlayer(uid, pSnap.data() as Record<string, unknown>);
    const nextIndex = player.currentWordIndex + 1;
    const nextWordsSolved = solved ? player.wordsSolved + 1 : player.wordsSolved;
    const playerFinished = nextIndex >= totalWords;
    const playerUpdate: Record<string, unknown> = {
      currentWordIndex: nextIndex,
      wordsSolved: nextWordsSolved,
    };
    if (playerFinished) {
      playerUpdate.finishedAt = serverTimestamp();
    }
    await updateDoc(pRef, playerUpdate);
  } catch {
    // Room progress is the source of truth during races.
  }
};

/** Refund staked points after leaving, being kicked, or the host closing the lobby. */
export const claimMultiplayerStakeRefund = async (roomId: string, uid: string): Promise<boolean> => {
  const normalizedId = roomId.trim().toUpperCase();

  try {
    return await runTransaction(getFirebaseDb(), async (tx) => {
      const rRef = roomRef(normalizedId);
      const pRef = playerRef(normalizedId, uid);
      const rSnap = await tx.get(rRef);
      const pSnap = await tx.get(pRef);

      if (!rSnap.exists() || !pSnap.exists()) {
        return false;
      }

      const room = parseRoom(normalizedId, rSnap.data() as Record<string, unknown>);
      const stake = resolveLobbyStake(room, pSnap.data() as Record<string, unknown>);

      if (stake <= 0) {
        tx.delete(pRef);
        return false;
      }

      const kickedFromLobby =
        room.status === 'lobby' && !room.playerUids.includes(uid);
      const lobbyClosed = room.status === 'abandoned';

      if (!kickedFromLobby && !lobbyClosed) {
        return false;
      }

      tx.update(userRef(uid), { points: increment(stake) });
      tx.delete(pRef);
      return true;
    });
  } catch {
    return false;
  }
};

/** Winner claims the match pot after the race finishes. */
export const claimMultiplayerWinnings = async (roomId: string, uid: string): Promise<boolean> => {
  const normalizedId = roomId.trim().toUpperCase();

  try {
    return await runTransaction(getFirebaseDb(), async (tx) => {
      const rRef = roomRef(normalizedId);
      const rSnap = await tx.get(rRef);
      if (!rSnap.exists()) {
        return false;
      }

      const room = parseRoom(normalizedId, rSnap.data() as Record<string, unknown>);
      if (
        room.status !== 'finished' ||
        room.mutualLoss ||
        room.winnerUid !== uid ||
        room.betsSettled ||
        !room.potAmount ||
        room.potAmount <= 0
      ) {
        return false;
      }

      tx.update(userRef(uid), { points: increment(room.potAmount) });
      tx.update(rRef, { betsSettled: true });
      return true;
    });
  } catch {
    return false;
  }
};
