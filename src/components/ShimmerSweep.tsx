import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';

// One-shot "gloss" sweep, extracted so ProBadge doesn't become a third copy of the
// recipe already inlined in ProfileScreen's ProHairlineShimmer and ProLockedOverlay's
// UpgradePill. Those two are identical in timing (900ms, no easing, native driver),
// gradient geometry (locations [0,0.4,0.6,1], horizontal start→end) and the
// one-shot-on-focus trigger; they differ only in peak white alpha (0.95 vs 0.7) and
// band width (90 vs 64). This component reproduces the UpgradePill values — the
// small-pill gloss — because a badge is a small filled pill, not a 3px hairline.
//
// A single, non-looping Animated.timing on focus drives a translucent-white band
// left→right across the parent, then stops. No loop, no repeat, no pulse, no scale.
const SHIMMER_DURATION_MS = 900;

// Canonical band width from UpgradePill. Consumers with a much smaller surface pass
// their own narrower value so the band still reads as a moving highlight rather than
// blanketing the whole element.
const DEFAULT_BAND_WIDTH = 64;

type ShimmerSweepProps = {
  // Width of the moving band itself. Defaults to the canonical 64.
  bandWidth?: number;
  // The distance the band travels across — the consumer's measured surface width
  // (via onLayout). Nothing renders until this is a positive number.
  width: number;
};

export function ShimmerSweep({
  bandWidth = DEFAULT_BAND_WIDTH,
  width,
}: ShimmerSweepProps) {
  const shimmerProgress = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (width <= 0) {
        return;
      }

      shimmerProgress.setValue(0);

      const shimmerAnimation = Animated.timing(shimmerProgress, {
        duration: SHIMMER_DURATION_MS,
        toValue: 1,
        useNativeDriver: true,
      });

      shimmerAnimation.start();

      return () => {
        shimmerAnimation.stop();
      };
    }, [shimmerProgress, width]),
  );

  if (width <= 0) {
    return null;
  }

  const shimmerTranslateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-bandWidth, width],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.band,
        { transform: [{ translateX: shimmerTranslateX }], width: bandWidth },
      ]}
    >
      <LinearGradient
        colors={[
          'rgba(255, 255, 255, 0)',
          'rgba(255, 255, 255, 0.7)',
          'rgba(255, 255, 255, 0.7)',
          'rgba(255, 255, 255, 0)',
        ]}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.4, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.gradient}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Full-height band pinned to the left, moved across by translateX; the consumer
  // clips it to the surface shape with its own overflow:'hidden'.
  band: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
  },
  gradient: {
    flex: 1,
  },
});
