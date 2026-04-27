import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { theme } from '../constants/theme';
import { AppText } from './AppText';

type AppButtonVariant = 'primary' | 'secondary' | 'outline';

type AppButtonProps = {
  disabled?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  title: string;
  variant?: AppButtonVariant;
};

export function AppButton({
  disabled = false,
  onPress,
  style,
  title,
  variant = 'primary',
}: AppButtonProps) {
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <AppText
        style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}
        variant="button"
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  primary: {
    backgroundColor: theme.colors.green,
  },
  secondary: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  outline: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    textAlign: 'center',
  },
  primaryLabel: {
    color: theme.colors.card,
  },
  secondaryLabel: {
    color: theme.colors.greenDark,
  },
});
