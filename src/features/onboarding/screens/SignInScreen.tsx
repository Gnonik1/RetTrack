import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { AppTextField } from '../../../components/AppTextField';
import { theme } from '../../../constants/theme';
import { getStoredHasCompletedOnboardingForUser } from '../../settings/state/AppSettingsState';
import {
  resetPassword,
  signInWithApple,
  signInWithEmail,
} from '../../../services/authService';

type SignInScreenProps = {
  onBack?: () => void;
  onForgotPassword?: () => void;
};

type SignInErrors = {
  email?: string;
  password?: string;
};

type ResetMessage = {
  text: string;
  type: 'error' | 'success';
};

type SignInSource = 'limit' | 'onboarding' | 'profile';

function isValidEmailForMvp(email: string) {
  const atIndex = email.indexOf('@');
  const dotAfterAtIndex = email.indexOf('.', atIndex + 1);

  return (
    atIndex > 0 &&
    dotAfterAtIndex > atIndex + 1 &&
    dotAfterAtIndex < email.length - 1
  );
}

function getSignInSource(source?: string | string[]): SignInSource | null {
  const resolvedSource = Array.isArray(source) ? source[0] : source;

  if (
    resolvedSource === 'limit' ||
    resolvedSource === 'onboarding' ||
    resolvedSource === 'profile'
  ) {
    return resolvedSource;
  }

  return null;
}

async function getSignInSuccessRoute(
  source: SignInSource | null,
  userId?: string,
) {
  if (source === 'onboarding') {
    if (!userId) {
      return '/notifications';
    }

    const hasCompletedOnboarding =
      await getStoredHasCompletedOnboardingForUser(userId);

    return hasCompletedOnboarding ? '/purchases' : '/notifications';
  }

  return '/profile';
}

function getAppleSignInErrorMessage(
  status:
    | 'missingToken'
    | 'providerSetupRequired'
    | 'unavailable'
    | 'unknownError',
) {
  if (status === 'unavailable') {
    return 'Apple sign-in is available only on supported Apple devices.';
  }

  if (status === 'missingToken') {
    return "Apple couldn't complete sign-in. Please try again.";
  }

  if (status === 'providerSetupRequired') {
    return "Apple sign-in isn't fully set up yet. Please use email sign-in for now.";
  }

  return "We couldn't sign you in with Apple. Please try again.";
}

export function SignInScreen({ onBack }: SignInScreenProps) {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string | string[] }>();
  const signInSource = getSignInSource(source);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignInErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningInWithApple, setIsSigningInWithApple] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState<ResetMessage | null>(null);
  const [submitError, setSubmitError] = useState('');
  const passwordInputRef = useRef<TextInput>(null);

  const clearFieldError = (field: keyof SignInErrors) => {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];

      return nextErrors;
    });
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setResetMessage(null);
    setSubmitError('');
    clearFieldError('email');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setSubmitError('');
    clearFieldError('password');
  };

  const validateForm = () => {
    const nextErrors: SignInErrors = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required';
    } else if (!isValidEmailForMvp(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    onBack?.();
  };

  const handleSignInPress = async () => {
    Keyboard.dismiss();
    setResetMessage(null);
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await signInWithEmail(email.trim(), password);

      if (error) {
        setSubmitError(
          "We couldn't sign you in. Check your email and password, then try again.",
        );
        return;
      }

      router.replace(await getSignInSuccessRoute(signInSource, data.user?.id));
    } catch {
      setSubmitError(
        "We couldn't sign you in. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleSignInPress = async () => {
    Keyboard.dismiss();
    setResetMessage(null);
    setSubmitError('');
    setIsSigningInWithApple(true);

    try {
      const result = await signInWithApple();

      if (result.status === 'canceled') {
        return;
      }

      if (result.status !== 'success') {
        setSubmitError(getAppleSignInErrorMessage(result.status));
        return;
      }

      router.replace(
        await getSignInSuccessRoute(signInSource, result.data.user?.id),
      );
    } catch {
      setSubmitError("We couldn't sign you in with Apple. Please try again.");
    } finally {
      setIsSigningInWithApple(false);
    }
  };

  const handleForgotPasswordPress = async () => {
    Keyboard.dismiss();
    setResetMessage(null);
    setSubmitError('');

    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        email: 'Enter your email first.',
      }));
      return;
    }

    if (!isValidEmailForMvp(trimmedEmail)) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        email: 'Enter a valid email address.',
      }));
      return;
    }

    clearFieldError('email');
    setIsResettingPassword(true);

    try {
      const { error } = await resetPassword(trimmedEmail);

      if (error) {
        setResetMessage({
          text: "We couldn't send a reset email. Check your email and try again.",
          type: 'error',
        });
        return;
      }

      setResetMessage({
        text: 'Password reset email sent.',
        type: 'success',
      });
    } catch {
      setResetMessage({
        text: "We couldn't send a reset email. Check your connection and try again.",
        type: 'error',
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <AppScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.content}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            onPress={handleBackPress}
            style={styles.backButton}
          >
            <AppText style={styles.backButtonText} variant="body">
              {'\u2039'}
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
            <AppTextField
              autoCapitalize="none"
              error={errors.email}
              keyboardType="email-address"
              label="Email"
              onChangeText={handleEmailChange}
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              placeholder="you@example.com"
              returnKeyType="next"
              textContentType="emailAddress"
              value={email}
            />
            <AppTextField
              ref={passwordInputRef}
              autoCapitalize="none"
              error={errors.password}
              label="Password"
              onChangeText={handlePasswordChange}
              onSubmitEditing={Keyboard.dismiss}
              placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
              returnKeyType="done"
              secureTextEntry
              showPasswordToggle
              textContentType="password"
              value={password}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={
              isSubmitting || isResettingPassword || isSigningInWithApple
            }
            onPress={handleForgotPasswordPress}
            style={[
              styles.forgotButton,
              isSubmitting || isResettingPassword || isSigningInWithApple
                ? styles.forgotButtonDisabled
                : null,
            ]}
          >
            <AppText style={styles.forgotText} variant="button">
              {isResettingPassword ? 'Sending reset...' : 'Forgot password?'}
            </AppText>
          </Pressable>

          {resetMessage ? (
            <View
              style={[
                styles.resetMessageCard,
                resetMessage.type === 'error'
                  ? styles.resetErrorCard
                  : styles.resetSuccessCard,
              ]}
            >
              <AppText
                style={[
                  styles.resetMessageText,
                  resetMessage.type === 'error'
                    ? styles.resetErrorText
                    : styles.resetSuccessText,
                ]}
                variant="caption"
              >
                {resetMessage.text}
              </AppText>
            </View>
          ) : null}

          {submitError ? (
            <View style={styles.submitErrorCard}>
              <AppText style={styles.submitErrorText} variant="caption">
                {submitError}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          <AppButton
            disabled={
              isSubmitting || isResettingPassword || isSigningInWithApple
            }
            onPress={handleSignInPress}
            title={isSubmitting ? 'Signing in...' : 'Sign in'}
            variant="primary"
          />
          <AppButton
            disabled={
              isSubmitting || isResettingPassword || isSigningInWithApple
            }
            onPress={Keyboard.dismiss}
            title="Continue with Google"
            variant="outline"
          />
          <AppButton
            disabled={
              isSubmitting || isResettingPassword || isSigningInWithApple
            }
            onPress={handleAppleSignInPress}
            title={
              isSigningInWithApple
                ? 'Continuing with Apple...'
                : 'Continue with Apple'
            }
            variant="outline"
          />
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
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
  forgotButton: {
    alignSelf: 'flex-start',
    marginTop: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  forgotButtonDisabled: {
    opacity: 0.7,
  },
  forgotText: {
    ...theme.typography.textLink,
    color: theme.colors.green,
    fontWeight: theme.fontWeight.medium,
  },
  resetMessageCard: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  resetErrorCard: {
    backgroundColor: theme.colors.softPending,
    borderColor: '#E4C8C1',
  },
  resetSuccessCard: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
  },
  resetMessageText: {
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  resetErrorText: {
    color: theme.colors.pending,
  },
  resetSuccessText: {
    color: theme.colors.greenDark,
  },
  submitErrorCard: {
    backgroundColor: theme.colors.softPending,
    borderColor: '#E4C8C1',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  submitErrorText: {
    color: theme.colors.pending,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
});
