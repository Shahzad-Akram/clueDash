import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';

type LegalExtra = {
  privacyPolicyUrl?: string;
  accountDeletionUrl?: string;
};

const legalExtra = (Constants.expoConfig?.extra?.legal ?? {}) as LegalExtra;

/** Hosted privacy policy — required for App Store / Play Store (ads + accounts). */
export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() ||
  legalExtra.privacyPolicyUrl?.trim() ||
  '';

/**
 * Web URL for account deletion (Play Console Data safety form).
 * Falls back to privacy policy when no dedicated page exists.
 */
export const ACCOUNT_DELETION_URL =
  process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL?.trim() ||
  legalExtra.accountDeletionUrl?.trim() ||
  PRIVACY_POLICY_URL;

export const hasPrivacyPolicyUrl = (): boolean => PRIVACY_POLICY_URL.length > 0;

export const openPrivacyPolicy = async (): Promise<boolean> => {
  if (!PRIVACY_POLICY_URL) {
    return false;
  }
  try {
    await WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL);
    return true;
  } catch {
    return false;
  }
};
