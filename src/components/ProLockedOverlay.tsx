import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { theme } from '../constants/theme';
import { AppText } from './AppText';

// Locked-preview value treatment — the single shared pattern every Pro teaser uses to
// stand in for a real value it must not reveal. WHY a bar and not obscured text: no
// real blur is available on this target (expo-blur's native BlurView renders inert
// here at every intensity, and React Native's `filter: blur()` is unavailable on iOS
// and New-Architecture-only — this app runs newArchEnabled: false), and textShadow
// paints NOTHING on this target either (an on-device A/B test found a glyph WITH a
// shadow indistinguishable from the same glyph without one). Obscured text also has a
// product problem: a faint-but-legible "$420" reads as the user's OWN data, asserting
// a false figure. A bar says "a value lives here and it's locked" without claiming any
// number — the label beside it carries the meaning. Do NOT reintroduce BlurView or
// textShadow here; both are dead on this target.
//
// Two styles compose: `lockedPreviewBarSlot` reserves the vertical space a value text
// would occupy, so the tile never shrinks or shifts, and `lockedPreviewBar` is the bar
// itself. Width is passed per tile so the bars read as different hidden values rather
// than one uniform loading skeleton.
export const lockedPreviewBarSlot: ViewStyle = {
  height: 20,
  justifyContent: 'center',
};
export const lockedPreviewBar: ViewStyle = {
  backgroundColor: 'rgba(63, 81, 58, 0.14)',
  borderRadius: 6,
  height: 12,
};

// Upgrade pill gradient stops: a lighter gold highlight at the top over the
// deeper amber token (`theme.colors.amber` === '#C7923E') at the bottom, for a
// subtle convex sheen instead of a flat fill.
const UPGRADE_PILL_GRADIENT_TOP = '#DEAC59';

// One-shot "gloss" sweep across the Upgrade pill. Reuses ProfileScreen's
// ProHairlineShimmer recipe exactly: a single (non-looping) Animated.timing on
// focus drives a translucent-white LinearGradient band across the element. This
// is the band's fixed width; it travels from just off the left edge to the pill's
// measured right edge.
const PILL_SHIMMER_BAND_WIDTH = 64;

function LockGlyph() {
  return (
    <Svg
      accessibilityElementsHidden
      focusable={false}
      height={13}
      viewBox="0 0 16 16"
      width={13}
    >
      <Path
        d="M5.2 7 V5.5 A2.8 2.8 0 0 1 10.8 5.5 V7"
        fill="none"
        stroke={theme.colors.amber}
        strokeLinecap="round"
        strokeWidth={1.7}
      />
      <Path
        d="M5.3 7 H10.7 A1.3 1.3 0 0 1 12 8.3 V11.7 A1.3 1.3 0 0 1 10.7 13 H5.3 A1.3 1.3 0 0 1 4 11.7 V8.3 A1.3 1.3 0 0 1 5.3 7 Z"
        fill={theme.colors.amber}
      />
    </Svg>
  );
}

// The primary CTA anchor: a gold-gradient "Upgrade" pill with a single premium
// shimmer sweep on mount/focus. The shimmer reuses the exact ProHairlineShimmer
// pattern (one-shot Animated.timing, no loop). The pill is decorative here — it
// lives inside the pointerEvents="none" overlay, so the tap is handled by the
// whole-panel Pressable that calls onUpgrade.
function UpgradePill() {
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const [pillWidth, setPillWidth] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (pillWidth <= 0) {
        return;
      }

      shimmerProgress.setValue(0);

      const shimmerAnimation = Animated.timing(shimmerProgress, {
        duration: 900,
        toValue: 1,
        useNativeDriver: true,
      });

      shimmerAnimation.start();

      return () => {
        shimmerAnimation.stop();
      };
    }, [pillWidth, shimmerProgress]),
  );

  const shimmerTranslateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-PILL_SHIMMER_BAND_WIDTH, pillWidth],
  });

  return (
    <View
      onLayout={(event) => setPillWidth(event.nativeEvent.layout.width)}
      style={styles.upgradePill}
    >
      {/* Gold gradient fill: lighter highlight at the top, deeper amber token at
          the bottom. */}
      <LinearGradient
        colors={[UPGRADE_PILL_GRADIENT_TOP, theme.colors.amber]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.upgradePillGradient}
      />
      {/* One-shot shimmer band swept left→right, under the crisp label. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.upgradePillShimmer,
          { transform: [{ translateX: shimmerTranslateX }] },
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
          style={styles.upgradePillShimmerGradient}
        />
      </Animated.View>
      <AppText style={styles.upgradePillText} variant="caption">
        Upgrade
      </AppText>
    </View>
  );
}

// Reusable "Pro teaser" treatment: renders whatever locked-preview content it
// wraps at full fidelity, lays a cream frosted wash (the `scrim` layer) over it so
// the preview reads as desirable data behind glass — the value numbers are replaced
// with shared `lockedPreviewBar` skeleton bars, since no real blur (or even
// textShadow) paints on this target — then rests a centered lock → caption →
// Upgrade CTA directly on that frosted panel. The whole surface is a single tap
// target that calls `onUpgrade` — the one hook the future paywall attaches to.
// This is the generic pattern; the pilot wraps the Spending insights shell, and
// later Pro features (CSV export, sort picker, custom reminders) reuse it by
// passing their own preview shell + caption.
export function ProLockedOverlay({
  accessibilityLabel,
  caption,
  children,
  onUpgrade,
}: {
  accessibilityLabel?: string;
  caption: string;
  children: ReactNode;
  onUpgrade: () => void;
}) {
  return (
    <Pressable
      accessibilityHint="Unlocks with RetTrack Pro"
      accessibilityLabel={accessibilityLabel ?? caption}
      accessibilityRole="button"
      onPress={onUpgrade}
      style={({ pressed }) => [styles.wrapper, pressed && styles.wrapperPressed]}
    >
      {/* Full-fidelity, non-interactive preview — taps fall through to the Pressable. */}
      <View pointerEvents="none">{children}</View>
      {/* Single frosted layer: a uniform, edge-to-edge cream wash that absolutely
          fills the whole wrapped card, tinting every tile so the preview reads as
          frosted glass and the crisp CTA sits directly on the panel. This wash
          replaces the removed BlurView (real blur is inert on this target); the locked
          values themselves are stood in for by `lockedPreviewBar` skeleton bars. */}
      <View pointerEvents="none" style={styles.scrim} />
      {/* FOREGROUND: the CTA (lock → subtitle → Upgrade pill) on its own cohesive
          inner panel, centered over the entire card body. The panel is near-opaque
          and elevated ABOVE the tile card (whose Android elevation otherwise draws
          it over the blur/scrim), so the tile labels behind it are fully covered —
          the crisp CTA text can never collide with a tile number. It's styled in
          the card's Pro language (warm cream + gold hairline) so it reads as part
          of this card, not a foreign overlay. */}
      <View pointerEvents="none" style={styles.badgeWrap}>
        <View style={styles.ctaPanel}>
          <View style={styles.lockCircle}>
            <LockGlyph />
          </View>
          <AppText style={styles.caption} variant="caption">
            {caption}
          </AppText>
          <UpgradePill />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badgeWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  // Supporting subtitle under the lock. Deliberately a touch smaller than the
  // Upgrade pill's label so the gold pill reads as the primary visual anchor.
  caption: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
    textAlign: 'center',
  },
  // FOREGROUND inner panel that holds the CTA (lock → subtitle → Upgrade pill) as
  // one centered unit. This is the structural fix for the text collision: a near-
  // opaque warm-cream fill covers the blurred tile labels within its footprint, so
  // the CTA text always sits on the panel — never on a tile number — and the
  // elevation lifts it above the tile card (which on Android draws over the
  // blur/scrim), so the coverage holds on every platform. A single soft 1px gold
  // hairline (#E9DEC4) runs evenly all the way around, so it reads as one light
  // frosted panel rather than a card with a top accent bar (no amber signature
  // accent — this is an upsell teaser, not a Pro card).
  ctaPanel: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 252, 243, 0.94)',
    borderColor: '#E9DEC4',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 4,
    gap: 10,
    maxWidth: 300,
    paddingHorizontal: 24,
    paddingVertical: 18,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  lockCircle: {
    alignItems: 'center',
    backgroundColor: '#FFF6E5',
    borderColor: '#E4D2A6',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    elevation: 1,
    height: 30,
    justifyContent: 'center',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    width: 30,
  },
  // Cream wash that gives the card its frosted TONE. It is not an obscuring floor —
  // the locked values are already replaced by `lockedPreviewBar` skeleton bars, so
  // the scrim's only job is to tint the whole surface as bright frosted glass (the
  // BlurView is gone; real blur is inert on this target). Cream (not gray) to match
  // the card rather than read as a muddy disabled state, at 0.35 alpha so it tints
  // the tiles without washing out the bars. Edge-to-edge (rounded to the card's
  // radius) so it reads as the panel surface, not a detached patch.
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 247, 240, 0.35)',
    borderRadius: 20,
  },
  // Primary CTA anchor. The gold gradient + shimmer fill it, so its own
  // background is transparent; overflow clips the gradient/shimmer to the pill.
  upgradePill: {
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 8,
    position: 'relative',
  },
  upgradePillGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  // Fixed-width shimmer band, full pill height, translated across the pill.
  upgradePillShimmer: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: PILL_SHIMMER_BAND_WIDTH,
  },
  upgradePillShimmerGradient: {
    flex: 1,
  },
  upgradePillText: {
    color: '#FFFDF7',
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.4,
  },
  wrapper: {
    alignSelf: 'stretch',
    // Matches the Spending insights card's own top rhythm so the teaser sits
    // exactly where the real card would; the wrapped shell resets its margin to 0.
    marginTop: 9,
    position: 'relative',
  },
  wrapperPressed: {
    opacity: 0.9,
  },
});
