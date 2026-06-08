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
import {
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail,
} from '../../../services/authService';
import { useAuth } from '../../../state/AuthState';

type SignUpScreenProps = {
  onBack?: () => void;
};

type SignUpErrors = {
  fullName?: string;
  email?: string;
  password?: string;
};

type SignUpSource = 'limit' | 'onboarding' | 'profile';

function isValidEmailForMvp(email: string) {
  const atIndex = email.indexOf('@');
  const dotAfterAtIndex = email.indexOf('.', atIndex + 1);

  return (
    atIndex > 0 &&
    dotAfterAtIndex > atIndex + 1 &&
    dotAfterAtIndex < email.length - 1
  );
}

function getSignUpSource(source?: string | string[]): SignUpSource | null {
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

function getSignUpSuccessRoute(source: SignUpSource | null) {
  if (source === 'onboarding') {
    return '/notifications?source=auth';
  }

  if (source === 'limit') {
    // TODO: After backend sync is implemented, migrate local guest purchases before routing.
    return '/profile';
  }

  return '/profile';
}

function getAppleSignUpErrorMessage(
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
    return "Apple couldn't complete account setup. Please try again.";
  }

  if (status === 'providerSetupRequired') {
    return "Apple sign-in isn't fully set up yet. Please use email sign-up for now.";
  }

  return "We couldn't continue with Apple. Please try again.";
}

function getGoogleSignUpErrorMessage(
  status:
    | 'missingProviderUrl'
    | 'providerSetupRequired'
    | 'sessionExchangeFailed'
    | 'unknownError',
) {
  if (status === 'providerSetupRequired') {
    return "Google sign-in isn't fully set up yet. Please use email sign-up for now.";
  }

  if (status === 'missingProviderUrl') {
    return "Google couldn't start account setup. Please try again.";
  }

  if (status === 'sessionExchangeFailed') {
    return "Google sign-in couldn't finish. Please try again.";
  }

  return "We couldn't continue with Google. Please try again.";
}

export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const router = useRouter();
  const { refreshProfile } = useAuth();
  const { source } = useLocalSearchParams<{ source?: string | string[] }>();
  const signUpSource = getSignUpSource(source);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignUpErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSigningInWithApple, setIsSigningInWithApple] = useState(false);
  const [isSigningInWithGoogle, setIsSigningInWithGoogle] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);

  const clearFieldError = (field: keyof SignUpErrors) => {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];

      return nextErrors;
    });
  };

  const handleFullNameChange = (text: string) => {
    setFullName(text);
    setSubmitError('');
    clearFieldError('fullName');
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setSubmitError('');
    clearFieldError('email');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    setSubmitError('');
    clearFieldError('password');
  };

  const validateForm = () => {
    const nextErrors: SignUpErrors = {};
    const trimmedEmail = email.trim();

    if (!fullName.trim()) {
      nextErrors.fullName = 'Full name is required';
    }

    if (!trimmedEmail) {
      nextErrors.email = 'Email is required';
    } else if (!isValidEmailForMvp(trimmedEmail)) {
      nextErrors.email = 'Enter a valid email';
    }

    if (!password) {
      nextErrors.password = 'Password is required';
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    onBack?.();
  };

  const handleCreateAccountPress = async () => {
    Keyboard.dismiss();
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const trimmedFullName = fullName.trim();
      const { error } = await signUpWithEmail(
        email.trim(),
        password,
        trimmedFullName,
      );

      if (error) {
        setSubmitError(
          "We couldn't create your account. Check your details and try again.",
        );
        return;
      }

      await refreshProfile();
      router.replace(getSignUpSuccessRoute(signUpSource));
    } catch {
      setSubmitError(
        "We couldn't create your account. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAppleSignInPress = async () => {
    Keyboard.dismiss();
    setSubmitError('');
    setIsSigningInWithApple(true);

    try {
      const result = await signInWithApple();

      if (result.status === 'canceled') {
        return;
      }

      if (result.status !== 'success') {
        setSubmitError(getAppleSignUpErrorMessage(result.status));
        return;
      }

      await refreshProfile();
      router.replace(getSignUpSuccessRoute(signUpSource));
    } catch {
      setSubmitError("We couldn't continue with Apple. Please try again.");
    } finally {
      setIsSigningInWithApple(false);
    }
  };

  const handleGoogleSignInPress = async () => {
    Keyboard.dismiss();
    setSubmitError('');
    setIsSigningInWithGoogle(true);

    try {
      const result = await signInWithGoogle();

      if (result.status === 'canceled') {
        return;
      }

      if (result.status !== 'success') {
        setSubmitError(getGoogleSignUpErrorMessage(result.status));
        return;
      }

      await refreshProfile();
      router.replace(getSignUpSuccessRoute(signUpSource));
    } catch {
      setSubmitError("We couldn't continue with Google. Please try again.");
    } finally {
      setIsSigningInWithGoogle(false);
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
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <AppText style={styles.backButtonText} variant="body">
              {'\u2039'}
            </AppText>
          </Pressable>

          <View style={styles.header}>
            <AppText style={styles.title} variant="title">
              Create account
            </AppText>
            <AppText style={styles.subtitle} variant="subtitle">
              Save your purchases and sync them everywhere.
            </AppText>
          </View>

          <View style={styles.fields}>
            <AppTextField
              autoCapitalize="words"
              error={errors.fullName}
              label="Full name"
              onChangeText={handleFullNameChange}
              onSubmitEditing={() => emailInputRef.current?.focus()}
              placeholder="Your name"
              returnKeyType="next"
              textContentType="name"
              value={fullName}
            />
            <AppTextField
              ref={emailInputRef}
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
              textContentType="newPassword"
              value={password}
            />
          </View>

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
              isSubmitting || isSigningInWithApple || isSigningInWithGoogle
            }
            onPress={handleCreateAccountPress}
            style={styles.primaryActionButton}
            title={isSubmitting ? 'Creating account...' : 'Create account'}
            variant="primary"
          />
          <AppButton
            disabled={
              isSubmitting || isSigningInWithApple || isSigningInWithGoogle
            }
            onPress={handleGoogleSignInPress}
            title={
              isSigningInWithGoogle
                ? 'Continuing with Google...'
                : 'Continue with Google'
            }
            variant="outline"
          />
          <AppButton
            disabled={
              isSubmitting || isSigningInWithApple || isSigningInWithGoogle
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
    paddingBottom: theme.spacing.xl + theme.spacing.xs,
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
    backgroundColor: 'rgba(255, 253, 248, 0.94)',
    borderColor: 'rgba(222, 227, 216, 0.9)',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    elevation: 3,
    height: 44,
    justifyContent: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    width: 44,
  },
  backButtonPressed: {
    backgroundColor: '#F6F8F1',
    opacity: theme.press.pressedOpacity,
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
    color: theme.colors.text,
    lineHeight: 36,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: theme.colors.muted,
    lineHeight: 20,
    marginTop: 6,
  },
  fields: {
    gap: 14,
    marginTop: theme.spacing.xl + theme.spacing.sm,
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
  primaryActionButton: {
    elevation: 3,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 8,
      width: 0,
    },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
});
