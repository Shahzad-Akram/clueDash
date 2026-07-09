import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { shouldRequestNonPersonalizedAds } from '@/lib/ads-consent';

// AdMob service - Android & iOS, interstitial ads only.
// - Web: no ads
// - Expo Go: no ads (native module unavailable; use a development build to test ads)

const isExpoGo = Constants.appOwnership === 'expo';

type AdmobExtraConfig = {
  android?: { appId?: string; interstitialUnitId?: string };
  ios?: { appId?: string; interstitialUnitId?: string };
};

type GoogleMobileAdsModule = typeof import('react-native-google-mobile-ads');

class AdMobService {
  private readonly isAndroid = Platform.OS === 'android';
  private readonly isWebPlatform = Platform.OS === 'web';
  private isAdLoaded = false;
  private isAdLoading = false;
  private interstitial: import('react-native-google-mobile-ads').InterstitialAd | null = null;
  private unsubscribeLoaded: (() => void) | null = null;
  private unsubscribeClosed: (() => void) | null = null;
  private unsubscribeError: (() => void) | null = null;
  private closeWaiters: (() => void)[] = [];
  /** True only after MobileAds.initialize() succeeds (native module loaded lazily). */
  private sdkInitialized = false;
  // Defer requiring the native SDK until initialize() keeps JS startup light.
  private googleMobileAds: GoogleMobileAdsModule | null = null;
  private readonly interstitialUnitId: string | undefined;
  private requestNonPersonalizedAdsOnly = true;

  constructor() {
    const admob = (Constants.expoConfig?.extra?.admob ?? {}) as AdmobExtraConfig;
    this.interstitialUnitId = this.isAndroid
      ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID || admob.android?.interstitialUnitId
      : process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID || admob.ios?.interstitialUnitId;

    if (isExpoGo) {
      console.log('AdMob: Expo Go detected - ads disabled (use a development build to test ads)');
    } else if (this.isWebPlatform) {
      console.log('AdMob: Web platform - ads disabled');
    }
  }

  /** Load the native binding on demand. Returns false if unavailable (Expo Go / web). */
  private tryLoadGoogleMobileAdsModule(): boolean {
    if (this.googleMobileAds) {
      return true;
    }
    if (this.isWebPlatform || isExpoGo) {
      return false;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      this.googleMobileAds = require('react-native-google-mobile-ads') as GoogleMobileAdsModule;
      return true;
    } catch (e) {
      console.log('AdMob: Failed to load Google Mobile Ads SDK:', e instanceof Error ? e.message : e);
      this.googleMobileAds = null;
      return false;
    }
  }

  async initialize(): Promise<void> {
    try {
      if (this.isWebPlatform || isExpoGo) {
        return;
      }
      if (!this.tryLoadGoogleMobileAdsModule()) {
        console.log('AdMob: Native module unavailable - ads disabled');
        return;
      }
      this.requestNonPersonalizedAdsOnly = await shouldRequestNonPersonalizedAds();
      await this.googleMobileAds!.default().initialize();
      this.sdkInitialized = true;
      console.log('AdMob: Google Mobile Ads SDK initialized');
      await this.preloadInterstitialAd();
    } catch (error) {
      this.sdkInitialized = false;
      this.googleMobileAds = null;
      console.log(
        'AdMob: Initialization failed - ads disabled:',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private cleanupListeners(): void {
    try {
      this.unsubscribeLoaded?.();
    } catch {}
    try {
      this.unsubscribeClosed?.();
    } catch {}
    try {
      this.unsubscribeError?.();
    } catch {}
    this.unsubscribeLoaded = null;
    this.unsubscribeClosed = null;
    this.unsubscribeError = null;
  }

  async preloadInterstitialAd(): Promise<void> {
    if (this.isAdLoading || this.isAdLoaded) {
      return;
    }
    if (!this.sdkInitialized || !this.googleMobileAds || !this.interstitialUnitId) {
      return;
    }

    try {
      const { InterstitialAd, AdEventType } = this.googleMobileAds;
      this.isAdLoading = true;
      this.isAdLoaded = false;

      this.cleanupListeners();
      this.interstitial = InterstitialAd.createForAdRequest(this.interstitialUnitId, {
        requestNonPersonalizedAdsOnly: this.requestNonPersonalizedAdsOnly,
      });

      this.unsubscribeLoaded = this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
        this.isAdLoaded = true;
        this.isAdLoading = false;
        console.log('AdMob: Interstitial ad loaded');
      });

      this.unsubscribeClosed = this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        this.isAdLoaded = false;
        const waiters = this.closeWaiters.splice(0, this.closeWaiters.length);
        waiters.forEach((fn) => {
          try {
            fn();
          } catch {}
        });
        // Preload the next ad after a short delay.
        setTimeout(() => void this.preloadInterstitialAd(), 1000);
      });

      // Without this, a failed load (no fill, network) leaves isAdLoading stuck
      // at true and no ad ever loads again for the rest of the session.
      this.unsubscribeError = this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
        console.log(
          'AdMob: Interstitial failed to load:',
          error instanceof Error ? error.message : String(error),
        );
        this.isAdLoaded = false;
        this.isAdLoading = false;
      });

      this.interstitial.load();
    } catch (error) {
      console.log(
        'AdMob: Failed to preload interstitial ad:',
        error instanceof Error ? error.message : String(error),
      );
      this.isAdLoaded = false;
      this.isAdLoading = false;
    }
  }

  isInterstitialAdReady(): boolean {
    return this.isAdLoaded;
  }

  async showInterstitialAd(): Promise<boolean> {
    try {
      if (!this.isAdLoaded) {
        await this.preloadInterstitialAd();
      }
      // `interstitial.loaded` is the native SDK's source of truth — our flag can
      // drift (e.g. a loaded ad expires after ~1h). Never call show() on a stale ad.
      if (!this.isAdLoaded || !this.interstitial?.loaded) {
        console.log('AdMob: No ad available to show');
        this.recoverAndPreloadFreshAd();
        return false;
      }
      await this.interstitial.show();
      return true;
    } catch (error) {
      console.log(
        'AdMob: Failed to show interstitial ad:',
        error instanceof Error ? error.message : String(error),
      );
      this.recoverAndPreloadFreshAd();
      return false;
    }
  }

  /** Resets stale state and queues a fresh ad load so the next trigger can succeed. */
  private recoverAndPreloadFreshAd(): void {
    this.isAdLoaded = false;
    if (this.interstitial && !this.isAdLoading) {
      this.interstitial = null;
      setTimeout(() => void this.preloadInterstitialAd(), 500);
    }
  }

  /** Shows the interstitial and resolves once the user closes it (or after timeoutMs). */
  async showInterstitialAdAndWaitForClose({ timeoutMs = 8000 }: { timeoutMs?: number } = {}): Promise<boolean> {
    const shown = await this.showInterstitialAd();
    if (!shown) {
      return false;
    }

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        resolve();
      };
      const timeout = setTimeout(finish, timeoutMs);
      this.closeWaiters.push(() => {
        clearTimeout(timeout);
        finish();
      });
    });

    return true;
  }
}

const adMobService = new AdMobService();
// NOTE: initialize() runs from the root layout after the iOS ATT prompt +
// InteractionManager deferral — keeps startup responsive.

export default adMobService;
