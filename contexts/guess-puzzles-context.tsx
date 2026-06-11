import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { fetchGuessPuzzlesOrdered, type GuessPuzzleDoc } from '@/lib/firebase';

export type GuessDifficulty = 'easy' | 'medium' | 'hard';

/** In-app shape for “guess the name” rounds (shared across the app). */
export type GuessPuzzle = {
  id?: string;
  phrase: string;
  clue: string;
  category: string;
  clueEmoji?: string;
  difficulty?: GuessDifficulty;
};

const FALLBACK_PUZZLES: GuessPuzzle[] = [
  { phrase: 'LION KING OF THE JUNGLE', clue: 'King of the jungle', category: 'ANIMAL', clueEmoji: '🦁' },
  { phrase: 'MICKEY MOUSE', clue: 'Beloved cartoon with round ears', category: 'CHARACTER', clueEmoji: '🐭' },
  { phrase: 'EMERALD CITY', clue: 'Where the Wizard lives in Oz', category: 'PLACE', clueEmoji: '🌆' },
];

/** Fisher–Yates shuffle (copy); play order is random, not Firestore `sortOrder`. */
export function shuffleGuessPuzzles<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = next[i];
    next[i] = next[j]!;
    next[j] = t!;
  }
  return next;
}

const mapDocToPuzzle = (d: GuessPuzzleDoc): GuessPuzzle => ({
  id: d.id,
  phrase: d.phrase,
  clue: d.clue,
  category: d.category,
  clueEmoji: d.clueEmoji,
  difficulty: d.difficulty,
});

type GuessPuzzlesContextValue = {
  /** Remote list when fetch succeeded and non-empty; empty while loading or on failure. */
  puzzles: GuessPuzzle[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
};

const GuessPuzzlesContext = createContext<GuessPuzzlesContextValue | null>(null);

type GuessPuzzlesProviderProps = {
  children: ReactNode;
};

export const GuessPuzzlesProvider = ({ children }: GuessPuzzlesProviderProps) => {
  const [puzzles, setPuzzles] = useState<GuessPuzzle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const docs = await fetchGuessPuzzlesOrdered();
      setPuzzles(docs.length > 0 ? shuffleGuessPuzzles(docs.map(mapDocToPuzzle)) : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load guesses';
      setError(message);
      if (!opts?.silent) {
        setPuzzles([]);
      }
      console.warn('[GuessPuzzles]', message, e);
    } finally {
      if (!opts?.silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresh puzzle list when the app returns to foreground (picks up Firestore seed updates).
  useEffect(() => {
    const handleAppState = (next: AppStateStatus) => {
      if (next === 'active') {
        void load({ silent: true });
      }
    };
    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [load]);

  const refetch = useCallback(() => load({ silent: true }), [load]);

  const value = useMemo<GuessPuzzlesContextValue>(
    () => ({
      puzzles,
      loading,
      error,
      refetch,
    }),
    [puzzles, loading, error, refetch],
  );

  return <GuessPuzzlesContext.Provider value={value}>{children}</GuessPuzzlesContext.Provider>;
};

export const useGuessPuzzles = (): GuessPuzzlesContextValue => {
  const ctx = useContext(GuessPuzzlesContext);
  if (!ctx) {
    throw new Error('useGuessPuzzles must be used within a GuessPuzzlesProvider');
  }
  return ctx;
};

/** Puzzles from Firestore when available; otherwise built-in defaults (shuffled, not fixed order). */
export const useGuessPuzzlesOrFallback = (): GuessPuzzle[] => {
  const { puzzles } = useGuessPuzzles();
  return useMemo(() => {
    if (puzzles.length > 0) {
      return puzzles;
    }
    return shuffleGuessPuzzles([...FALLBACK_PUZZLES]);
  }, [puzzles]);
};

export { FALLBACK_PUZZLES };
