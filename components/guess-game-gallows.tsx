import { StyleSheet, View } from 'react-native';

import { MAX_WRONG } from '@/lib/guess-game-core';

type GallowsFigureProps = {
  stage: number;
};

export const GallowsFigure = ({ stage }: GallowsFigureProps) => {
  const show = {
    beam: stage >= 0,
    rope: stage >= 1,
    head: stage >= 2,
    body: stage >= 3,
    arms: stage >= 4,
    legs: stage >= 5,
  };

  return (
    <View style={styles.gallows} accessibilityLabel={`Hangman progress ${stage} of ${MAX_WRONG}`}>
      <View style={styles.woodBase} />
      <View style={styles.woodPole} />
      {show.beam ? <View style={styles.woodTop} /> : null}
      {show.rope ? <View style={styles.rope} /> : null}
      {show.head ? <View style={styles.manHead} /> : null}
      {show.body ? <View style={styles.manBody} /> : null}
      {show.arms ? (
        <View style={styles.manArmsRow}>
          <View style={styles.manArm} />
          <View style={styles.manArm} />
        </View>
      ) : null}
      {show.legs ? (
        <View style={styles.manLegsRow}>
          <View style={styles.manLeg} />
          <View style={styles.manLeg} />
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  gallows: {
    width: 76,
    height: 92,
    alignItems: 'center',
    marginTop: 4,
  },
  woodBase: {
    position: 'absolute',
    bottom: 0,
    width: 56,
    height: 6,
    backgroundColor: '#8B5A2B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#6B4226',
  },
  woodPole: {
    position: 'absolute',
    bottom: 6,
    left: 10,
    width: 6,
    height: 72,
    backgroundColor: '#8B5A2B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#6B4226',
  },
  woodTop: {
    position: 'absolute',
    top: 6,
    left: 10,
    width: 44,
    height: 6,
    backgroundColor: '#8B5A2B',
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#6B4226',
  },
  rope: {
    position: 'absolute',
    top: 12,
    right: 18,
    width: 3,
    height: 14,
    backgroundColor: '#4A3728',
    borderRadius: 1,
  },
  manHead: {
    position: 'absolute',
    top: 24,
    right: 12,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#222',
    backgroundColor: 'transparent',
  },
  manBody: {
    position: 'absolute',
    top: 42,
    right: 19,
    width: 4,
    height: 22,
    backgroundColor: '#222',
    borderRadius: 2,
  },
  manArmsRow: {
    position: 'absolute',
    top: 46,
    right: 8,
    flexDirection: 'row',
    gap: 20,
  },
  manArm: {
    width: 16,
    height: 3,
    backgroundColor: '#222',
    borderRadius: 1,
  },
  manLegsRow: {
    position: 'absolute',
    top: 62,
    right: 14,
    flexDirection: 'row',
    gap: 6,
  },
  manLeg: {
    width: 3,
    height: 16,
    backgroundColor: '#222',
    borderRadius: 1,
  },
});
