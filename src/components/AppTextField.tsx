import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
  View,
} from 'react-native';

import { theme } from '../constants/theme';
import { AppText } from './AppText';

type AppTextFieldProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  label: string;
  leftIcon?: string;
  onChangeText?: (text: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  style?: StyleProp<ViewStyle>;
  textContentType?: TextInputProps['textContentType'];
  value?: string;
};

export function AppTextField({
  autoCapitalize,
  keyboardType,
  label,
  leftIcon,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  showPasswordToggle = false,
  style,
  textContentType,
  value,
}: AppTextFieldProps) {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const hasLeftIcon = Boolean(leftIcon);
  const effectiveSecureTextEntry = showPasswordToggle
    ? !isPasswordVisible
    : secureTextEntry;
  const passwordToggleLabel = isPasswordVisible ? 'Hide' : 'Show';

  return (
    <View style={[styles.fieldGroup, style]}>
      <AppText style={styles.label} variant="caption">
        {label}
      </AppText>
      <View style={[styles.inputCard, hasLeftIcon && styles.inputCardWithIcon]}>
        {hasLeftIcon ? (
          <AppText style={styles.leftIcon} variant="body">
            {leftIcon}
          </AppText>
        ) : null}
        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          secureTextEntry={effectiveSecureTextEntry}
          selectionColor={theme.colors.green}
          style={styles.input}
          textContentType={textContentType}
          value={value}
        />
        {showPasswordToggle ? (
          <Pressable
            accessibilityLabel={`${passwordToggleLabel} password`}
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setIsPasswordVisible((current) => !current)}
            style={({ pressed }) => [
              styles.passwordToggle,
              pressed && styles.passwordTogglePressed,
            ]}
          >
            <AppText style={styles.passwordToggleText} variant="caption">
              {passwordToggleLabel}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: 7,
  },
  label: {
    ...theme.typography.fieldLabel,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: theme.spacing.md,
  },
  inputCardWithIcon: {
    gap: 10,
  },
  leftIcon: {
    color: theme.colors.greenDark,
    fontSize: 17,
    lineHeight: 20,
    textAlign: 'center',
    width: 20,
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: theme.spacing.sm,
    paddingVertical: theme.spacing.sm,
  },
  passwordTogglePressed: {
    opacity: 0.7,
  },
  passwordToggleText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    opacity: 0.75,
  },
  input: {
    ...theme.typography.input,
    color: theme.colors.text,
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 28,
    padding: 0,
    paddingVertical: 0,
  },
});
