import AsyncStorage from '@react-native-async-storage/async-storage';

export const GAME_MUSIC_STORAGE_KEY = '@numtease/music_enabled_v1';

export const loadMusicEnabledPreference = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(GAME_MUSIC_STORAGE_KEY);
    if (raw === null) {
      return true;
    }
    return raw === 'true';
  } catch {
    return true;
  }
};

export const saveMusicEnabledPreference = async (enabled: boolean): Promise<void> => {
  try {
    await AsyncStorage.setItem(GAME_MUSIC_STORAGE_KEY, String(enabled));
  } catch {
    // Preference is best-effort; playback still follows in-session toggle.
  }
};
