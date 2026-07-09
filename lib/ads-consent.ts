import { AdsConsent } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

/**
 * Google UMP consent — required for AdMob in EEA/UK and expected by Play ad policies.
 * Call before MobileAds.initialize().
 */
export const gatherAdsConsentIfRequired = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const info = await AdsConsent.gatherConsent();
    return info.canRequestAds;
  } catch (error) {
    console.warn('[AdsConsent] gatherConsent failed', error);
    return false;
  }
};

/** True when the user did not consent to personalized ads. */
export const shouldRequestNonPersonalizedAds = async (): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return true;
  }

  try {
    const choices = await AdsConsent.getUserChoices();
    return !choices.selectPersonalisedAds;
  } catch {
    return true;
  }
};
