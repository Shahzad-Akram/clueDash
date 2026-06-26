export type MultiplayerRoomStatus = 'lobby' | 'countdown' | 'playing' | 'finished' | 'abandoned';

export type MultiplayerTimerMode = 'none' | 'per_word' | 'total';

export type MultiplayerRoomConfig = {
  wordCount: number;
  timerMode: MultiplayerTimerMode;
  /** Seconds per word when timerMode is per_word. */
  secondsPerWord: number;
  /** Total match seconds when timerMode is total. */
  totalSeconds: number;
  /** Max players allowed in the lobby before the room is full. */
  maxPlayers: number;
  /** Points each player stakes; 0 means no wager. Losers forfeit, winner takes the pot. */
  betAmount: number;
};

export type MultiplayerRoom = {
  id: string;
  hostUid: string;
  status: MultiplayerRoomStatus;
  config: MultiplayerRoomConfig;
  puzzleIds: string[];
  playerUids: string[];
  createdAt: number;
  startedAt?: number;
  winnerUid?: string | null;
  /** Total staked points in the pot (set when the match starts). */
  potAmount?: number;
  /** True after the winner has claimed the pot. */
  betsSettled?: boolean;
  /** Timed match ended with no solves from anyone — both players forfeit their stake. */
  mutualLoss?: boolean;
  /** Live race progress keyed by player uid (updated on the room doc during matches). */
  playerProgress?: Record<string, MultiplayerPlayerProgress>;
};

export type MultiplayerPlayerProgress = {
  currentWordIndex: number;
  wordsSolved: number;
  finishedAt?: number;
};

export type MultiplayerPlayer = {
  uid: string;
  displayName: string;
  avatarId: string;
  joinedAt: number;
  isReady: boolean;
  wordsSolved: number;
  currentWordIndex: number;
  finishedAt?: number;
};

export const MULTIPLAYER_WORD_COUNT_OPTIONS = [3, 5, 7, 10] as const;

export const MULTIPLAYER_MAX_PLAYERS_OPTIONS = [2, 3, 4, 6, 8] as const;

/** Minimum players required before the host can start a race. */
export const MIN_MULTIPLAYER_PLAYERS_TO_START = 2;

/** Hard cap for room size validation. */
export const ABSOLUTE_MAX_MULTIPLAYER_PLAYERS = 8;

export const MULTIPLAYER_TIMER_MODE_OPTIONS: {
  id: MultiplayerTimerMode;
  label: string;
  description: string;
}[] = [
  { id: 'none', label: 'No timer', description: 'Pure speed race — first to finish wins.' },
  { id: 'per_word', label: 'Per word', description: 'Beat the clock on each phrase.' },
  { id: 'total', label: 'Total match', description: 'One countdown for the whole race.' },
];

export const MULTIPLAYER_SECONDS_PER_WORD_OPTIONS = [30, 45, 60, 90] as const;

export const MULTIPLAYER_TOTAL_SECONDS_OPTIONS = [180, 300, 420, 600] as const;

export const MULTIPLAYER_BET_OPTIONS = [0, 25, 50, 100, 200] as const;

export const DEFAULT_MULTIPLAYER_CONFIG: MultiplayerRoomConfig = {
  wordCount: 5,
  timerMode: 'per_word',
  secondsPerWord: 60,
  totalSeconds: 300,
  maxPlayers: 2,
  betAmount: 0,
};

/** @deprecated Use room.config.maxPlayers instead. */
export const MAX_MULTIPLAYER_PLAYERS = ABSOLUTE_MAX_MULTIPLAYER_PLAYERS;
