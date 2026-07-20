import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { theme } from '../constants/theme';
import { AppText } from './AppText';
import { ShimmerSweep } from './ShimmerSweep';

// Narrower than ShimmerSweep's canonical 64: the badge is a much smaller pill than
// the Upgrade pill the recipe came from — the status "Pro" badge is only ~55px wide,
// so a 64px band would blanket it and read as a full flash instead of a sweep. 40
// stays narrower than the smallest variant, so a moving highlight is visible on both
// "Pro" and "Get Pro". This is a geometry fit for the small size, not a new colour or
// timing (those are reproduced exactly by ShimmerSweep).
const BADGE_SHIMMER_BAND_WIDTH = 40;

// The gold four-point sparkle that marks every Pro surface. Moved here from
// ProfileScreen unchanged — same 12×12 viewBox, same path, same amber fill — so the
// Profile hero pill and this badge draw the identical mark from a single source.
export function ProSparkleIcon() {
  return (
    <Svg
      accessibilityElementsHidden
      focusable={false}
      height={12}
      viewBox="0 0 12 12"
      width={12}
    >
      <Path
        d="M6 0.8 7.45 4.55 11.2 6 7.45 7.45 6 11.2 4.55 7.45 0.8 6 4.55 4.55 6 0.8Z"
        fill={theme.colors.amber}
      />
    </Svg>
  );
}

type ProBadgeProps =
  | { variant: 'status' }
  | {
      variant: 'action';
      accessibilityLabel?: string;
      onPress?: () => void;
    };

// One Pro marker in two tiers that share a single shape + palette (cream/gold, both
// lifted from ProfileScreen's proIdentityPill) so they read as one family with a
// clear tier between them:
// - 'status': a filled, non-interactive reward badge ("Pro"). A plain View — never a
//   Pressable, never a button role. It states a fact, it is not a control.
// - 'action': an OUTLINED invitation ("Get Pro") for non-Pro users. A Pressable. The
//   wording is deliberate: "Get Pro" (not "Pro") so it never implies the user already
//   has it.
// Both tiers carry a single one-shot shimmer that fires when the screen gains focus —
// a reward flourish on 'status', an eye-catch on 'action'. It sweeps once and stops.
export function ProBadge(props: ProBadgeProps) {
  const [badgeWidth, setBadgeWidth] = useState(0);

  const content = (
    <>
      {/* The shimmer's clip layer. overflow:'hidden' lives HERE, on a dedicated
          absolutely-filled layer, NOT on the badge root — putting it on the root
          would clip the status badge's soft iOS drop shadow. Rounded to the pill so
          the band clips to the badge shape; rendered first so it sits behind the
          sparkle/label; non-interactive so it never intercepts the action tap. */}
      <View accessibilityElementsHidden pointerEvents="none" style={styles.shimmerClip}>
        <ShimmerSweep bandWidth={BADGE_SHIMMER_BAND_WIDTH} width={badgeWidth} />
      </View>
      <ProSparkleIcon />
      <AppText style={styles.label} variant="caption">
        {props.variant === 'action' ? 'Get Pro' : 'Pro'}
      </AppText>
    </>
  );

  if (props.variant === 'action') {
    return (
      <Pressable
        accessibilityLabel={props.accessibilityLabel ?? 'Get RetTrack Pro'}
        accessibilityRole="button"
        onLayout={(event) => setBadgeWidth(event.nativeEvent.layout.width)}
        onPress={props.onPress}
        style={({ pressed }) => [
          styles.badge,
          styles.actionBadge,
          pressed && styles.actionBadgePressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return (
    <View
      onLayout={(event) => setBadgeWidth(event.nativeEvent.layout.width)}
      style={[styles.badge, styles.statusBadge]}
    >
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  // Shared shell for both tiers: proIdentityPill's gold hairline (#D6C28F), pill
  // radius, and paddings, plus the row layout (flexDirection/alignItems/gap) that
  // arranges the sparkle + label. gap 5 matches Profile's proUsagePill; these are
  // layout props, not new colours. No overflow here — see shimmerClip.
  badge: {
    alignItems: 'center',
    borderColor: '#D6C28F',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  // Reward tier: proIdentityPill's cream fill + soft shadow, verbatim.
  statusBadge: {
    backgroundColor: '#FFF6E5',
    elevation: 1,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: 0.035,
    shadowRadius: 8,
  },
  // Invitation tier: same shape and gold border, no shadow, plus a soft amber fill so
  // it reads as present and tappable rather than a bare outline. The value is
  // ProfileScreen's usageProHintRow fill verbatim (theme.colors.amber #C7923E at 0.12
  // alpha), so both "Get Pro" surfaces share one language.
  actionBadge: {
    backgroundColor: 'rgba(199, 146, 62, 0.12)',
  },
  // Pressed feedback: a deeper step of the same amber (0.12 → 0.2), reproducing
  // ProfileScreen's usageProHintRow → usageProHintRowPressed relationship, so the
  // press reads as the chip darkening rather than a colour change.
  actionBadgePressed: {
    backgroundColor: 'rgba(199, 146, 62, 0.2)',
  },
  // proIdentityPillText, verbatim.
  label: {
    color: '#604B25',
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 14,
  },
  // Bounds the one-shot shimmer to the pill without clipping the badge's own drop
  // shadow. Absolutely fills the badge and rounds to the pill radius; the shimmer
  // band (position absolute inside) is clipped to this rounded rect.
  shimmerClip: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
  },
});
