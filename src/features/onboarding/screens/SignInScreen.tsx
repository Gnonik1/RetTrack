import {
  Pressable,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';

type SignInFieldProps = {
  autoCapitalize?: TextInputProps['autoCapitalize'];
  keyboardType?: TextInputProps['keyboardType'];
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
  textContentType?: TextInputProps['textContentType'];
};

function SignInField({
  autoCapitalize,
  keyboardType,
  label,
  placeholder,
  secureTextEntry = false,
  textContentType,
}: SignInFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <AppText style={styles.fieldLabel} variant="caption">
        {label}
      </AppText>
      <View style={styles.inputCard}>
        <TextInput
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.muted}
          secureTextEntry={secureTextEntry}
          selectionColor={theme.colors.green}
          style={styles.input}
          textContentType={textContentType}
        />
      </View>
    </View>
  );
}

export function SignInScreen() {
  return (
    <AppScreen style={styles.screen}>
      <View style={styles.content}>
        <Pressable accessibilityLabel="Back" accessibilityRole="button" style={styles.backButton}>
          <AppText style={styles.backButtonText} variant="body">
            ‹
          </AppText>
        </Pressable>

        <View style={styles.header}>
          <AppText style={styles.title} variant="title">
            Sign in
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            Access your purchases across devices
          </AppText>
        </View>

        <View style={styles.fields}>
          <SignInField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            placeholder="you@example.com"
            textContentType="emailAddress"
          />
          <SignInField
            autoCapitalize="none"
            label="Password"
            placeholder="••••••••"
            secureTextEntry
            textContentType="password"
          />
        </View>

        <Pressable accessibilityRole="button" style={styles.forgotButton}>
          <AppText style={styles.forgotText} variant="button">
            Forgot password?
          </AppText>
        </Pressable>
      </View>

      <View style={styles.actions}>
        <AppButton title="Sign in" variant="primary" />
        <AppButton title="Continue with Google" variant="outline" />
        <AppButton title="Continue with Apple" variant="outline" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  content: {
    paddingTop: 0,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  backButtonText: {
    color: theme.colors.greenDark,
    fontSize: 28,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 30,
  },
  header: {
    marginTop: theme.spacing.xl,
  },
  title: {
    ...theme.typography.screenTitle,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    lineHeight: 20,
    marginTop: 6,
  },
  fields: {
    gap: 14,
    marginTop: theme.spacing.xl + theme.spacing.sm,
  },
  fieldGroup: {
    gap: 7,
  },
  fieldLabel: {
    ...theme.typography.fieldLabel,
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  inputCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  input: {
    ...theme.typography.input,
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 28,
    padding: 0,
    paddingVertical: 0,
  },
  forgotButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  forgotText: {
    ...theme.typography.textLink,
    color: theme.colors.green,
    fontWeight: theme.fontWeight.medium,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
});
