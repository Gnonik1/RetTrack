import type { ReactNode } from 'react';
import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import { theme } from '../constants/theme';

type AppTextVariant = 'title' | 'subtitle' | 'body' | 'caption' | 'button';

type AppTextProps = TextProps & {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  variant?: AppTextVariant;
};

export function AppText({
  children,
  style,
  variant = 'body',
  ...textProps
}: AppTextProps) {
  return (
    <Text style={[styles.base, styles[variant], style]} {...textProps}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.text,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: theme.fontWeight.semibold,
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.regular,
  },
  body: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.regular,
  },
  caption: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.regular,
  },
  button: {
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
});
