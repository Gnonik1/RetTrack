import type { ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { theme } from '../constants/theme';

type AppScreenProps = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  stableTopInset?: boolean;
};

function getPaddingTop(style?: StyleProp<ViewStyle>) {
  const flattenedStyle = StyleSheet.flatten(style);
  const paddingTop = flattenedStyle?.paddingTop;
  const paddingVertical = flattenedStyle?.paddingVertical;
  const padding = flattenedStyle?.padding;

  if (typeof paddingTop === 'number') {
    return paddingTop;
  }

  if (typeof paddingVertical === 'number') {
    return paddingVertical;
  }

  if (typeof padding === 'number') {
    return padding;
  }

  return 0;
}

function StableTopInsetScreen({
  children,
  style,
}: Omit<AppScreenProps, 'stableTopInset'>) {
  const insets = useSafeAreaInsets();
  const localPaddingTop = getPaddingTop(style);

  return (
    <SafeAreaView
      edges={['right', 'bottom', 'left']}
      style={[styles.screen, style, { paddingTop: insets.top + localPaddingTop }]}
    >
      {children}
    </SafeAreaView>
  );
}

export function AppScreen({
  children,
  style,
  stableTopInset = false,
}: AppScreenProps) {
  if (stableTopInset) {
    return <StableTopInsetScreen style={style}>{children}</StableTopInsetScreen>;
  }

  return <SafeAreaView style={[styles.screen, style]}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.bg,
    paddingHorizontal: theme.spacing.md,
  },
});
