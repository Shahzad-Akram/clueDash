import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';

/** Single source of truth for the app-wide background asset (prefetch + ImageBackground). */
export const APP_BACKGROUND_IMAGE = require('@/assets/images/background.webp');

/** Image layer: slightly softened so UI stays readable. */
const BACKGROUND_IMAGE_OPACITY = 0.88;

/** Frosted layer strength (1–100). Kept low for a subtle effect. */
const BLUR_INTENSITY = 22;

type AppBackgroundProps = {
  children: ReactNode;
};

/**
 * Full-screen background used at the root so every route shares one image instance.
 * For nested layouts or standalone tools, wrap screens with this if they are mounted outside the root stack.
 */
export const AppBackground = ({ children }: AppBackgroundProps) => (
  <View style={styles.fill} accessibilityIgnoresInvertColors>
    <ImageBackground
      source={APP_BACKGROUND_IMAGE}
      style={StyleSheet.absoluteFill}
      imageStyle={styles.imageLayer}
      resizeMode="cover"
    />
    <BlurView
      intensity={BLUR_INTENSITY}
      tint="light"
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
    <View style={styles.content} pointerEvents="box-none">
      {children}
    </View>
  </View>
);

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  imageLayer: {
    opacity: BACKGROUND_IMAGE_OPACITY,
  },
  content: {
    flex: 1,
  },
});
