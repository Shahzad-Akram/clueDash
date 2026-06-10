import * as Haptics from 'expo-haptics';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { AudioPlayer } from 'expo-audio/build/AudioModule.types';
import { useCallback, useEffect, useRef, useState } from 'react';

import { loadMusicEnabledPreference, saveMusicEnabledPreference } from '@/lib/game-music-storage';

const BACKGROUND_MUSIC = require('@/assets/audio/background-music.mp3');

type UseGameMusicOptions = {
  /** When false, music is paused regardless of user preference. */
  active?: boolean;
};

const safePlay = (player: AudioPlayer) => {
  try {
    if (player.isLoaded) {
      player.play();
    }
  } catch {
    // Player may already be released during screen transitions.
  }
};

const safePause = (player: AudioPlayer) => {
  try {
    if (player.isLoaded) {
      player.pause();
    }
  } catch {
    // Player may already be released during screen transitions.
  }
};

export const useGameMusic = ({ active = true }: UseGameMusicOptions = {}) => {
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const isMountedRef = useRef(true);
  const player = useAudioPlayer(BACKGROUND_MUSIC);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
        });
        const enabled = await loadMusicEnabledPreference();
        if (!cancelled && isMountedRef.current) {
          setMusicEnabled(enabled);
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setPreferenceLoaded(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!preferenceLoaded || !status.isLoaded || !isMountedRef.current) {
      return;
    }

    try {
      player.loop = true;
      player.volume = 0.45;
    } catch {
      return;
    }

    if (active && musicEnabled) {
      safePlay(player);
      return;
    }

    safePause(player);
  }, [active, musicEnabled, player, preferenceLoaded, status.isLoaded]);

  const toggleMusic = useCallback(() => {
    void Haptics.selectionAsync();
    setMusicEnabled((prev) => {
      const next = !prev;
      void saveMusicEnabledPreference(next);
      return next;
    });
  }, []);

  const pauseMusic = useCallback(() => {
    safePause(player);
  }, [player]);

  return { musicEnabled, toggleMusic, pauseMusic };
};
