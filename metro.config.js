// Learn more: https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase modular SDK (`firebase/app`, `firebase/firestore`, …) is exposed only via
// package.json "exports". Metro must use exports resolution instead of a missing folder path.
config.resolver.unstable_enablePackageExports = true;

const googleMobileAdsStub = path.resolve(__dirname, 'lib/stubs/google-mobile-ads.ts');
const expoTrackingTransparencyStub = path.resolve(
  __dirname,
  'lib/stubs/expo-tracking-transparency.ts',
);

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === 'react-native-google-mobile-ads') {
    return {
      filePath: googleMobileAdsStub,
      type: 'sourceFile',
    };
  }

  if (platform === 'web' && moduleName === 'expo-tracking-transparency') {
    return {
      filePath: expoTrackingTransparencyStub,
      type: 'sourceFile',
    };
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
