import Svg, { Path } from 'react-native-svg';

import { theme } from '../constants/theme';

// Drawn rather than typeset, for the same reason SortChevronIcon replaced "▾" on
// PurchasesHomeScreen: the marks these replace were ✓ U+2713, ✕ U+2715 and × U+00D7
// — dingbat and operator glyphs that resolve through a fallback symbol font, so
// their size and weight rendered inconsistently across platforms, and fontWeight on
// a dingbat is frequently ignored outright. Paths carry none of that risk. Folding
// ✕ and × into one CrossIcon also retires the two different characters the app was
// using for the same close/clear affordance.

// The call sites need these at 10-14px, so the stroke is specified in on-screen
// pixels and converted to viewBox units here: one viewBox unit is size/16 pixels, so
// `16 * STROKE_PX / size` units always lands on STROKE_PX pixels. Scaling the stroke
// with the icon instead would leave the 10px benefit check visibly hairline next to
// the 14px close cross.
const STROKE_PX = 1.6;
const VIEW_BOX_SIZE = 16;

function getStrokeWidth(size: number) {
  return (VIEW_BOX_SIZE * STROKE_PX) / size;
}

type MarkIconProps = {
  color?: string;
  size?: number;
};

// Two-segment tick, both arms at 45°, bounding box centred on the 16x16 canvas.
export function CheckIcon({
  color = theme.colors.text,
  size = 12,
}: MarkIconProps) {
  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      focusable={false}
      height={size}
      viewBox="0 0 16 16"
      width={size}
    >
      <Path
        d="M2.8 8.2 L6.1 11.5 L13.2 4.4"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={getStrokeWidth(size)}
      />
    </Svg>
  );
}

// Two crossed strokes at 45°, sharing the canvas centre.
export function CrossIcon({
  color = theme.colors.text,
  size = 12,
}: MarkIconProps) {
  const strokeWidth = getStrokeWidth(size);

  return (
    <Svg
      accessibilityElementsHidden
      fill="none"
      focusable={false}
      height={size}
      viewBox="0 0 16 16"
      width={size}
    >
      <Path
        d="M3.2 3.2 L12.8 12.8"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
      <Path
        d="M12.8 3.2 L3.2 12.8"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
