/**
 * Metro web fallback if anything resolves react-native-google-mobile-ads on web.
 * Prefer lib/admob.web.ts for app code; this guards transitive imports.
 */

const noop = () => {};

const emptyAd = {
  loaded: false,
  load: noop,
  show: async () => {},
  addAdEventListener: () => noop,
};

export const AdEventType = {
  LOADED: 'loaded',
  CLOSED: 'closed',
  ERROR: 'error',
} as const;

export const InterstitialAd = {
  createForAdRequest: () => emptyAd,
};

const MobileAds = () => ({
  initialize: async () => {},
});

export default MobileAds;
