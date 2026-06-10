import AsyncStorage from '@react-native-async-storage/async-storage';

export const GUEST_SESSION_STORAGE_KEY = '@GuessUp/guest_session_v1';

export const loadGuestSession = async (): Promise<boolean> => {
  try {
    const raw = await AsyncStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
};

export const saveGuestSession = async (active: boolean): Promise<void> => {
  try {
    if (active) {
      await AsyncStorage.setItem(GUEST_SESSION_STORAGE_KEY, 'true');
      return;
    }
    await AsyncStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch {
    // Best-effort; in-session guest state still applies.
  }
};
