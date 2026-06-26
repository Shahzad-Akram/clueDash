/** Web stub — Google Mobile Ads is native-only. */

class AdMobWebService {
  async initialize(): Promise<void> {
    // No-op on web.
  }

  isInterstitialAdReady(): boolean {
    return false;
  }

  async showInterstitialAd(): Promise<boolean> {
    return false;
  }

  async showInterstitialAdAndWaitForClose(): Promise<boolean> {
    return false;
  }
}

const adMobService = new AdMobWebService();

export default adMobService;
