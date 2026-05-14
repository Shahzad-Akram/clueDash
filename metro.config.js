// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Firebase modular SDK (`firebase/app`, `firebase/firestore`, …) is exposed only via
// package.json "exports". Metro must use exports resolution instead of a missing folder path.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
