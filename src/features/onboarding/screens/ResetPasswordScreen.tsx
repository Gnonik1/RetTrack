import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
  getCurrentSession,
  updatePassword,
} from '../../../services/authService';
import { useAuth } from '../../../state/AuthState';

type ResetPasswordScreenProps = {
  onBack?: () => void;
};

type ResetPasswordErrors = {
  confirmPassword?: string;
  newPassword?: string;
};

const invalidResetLinkMessage =
  'This reset link is invalid or expired. Request a new password reset email.';
const resetSessionCheckIntervalMs = 250;
const resetSessionCheckMaxAttempts = 16;

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function ResetPasswordScreen({ onBack }: ResetPasswordScreenProps) {
  const router = useRouter();
  const { isAuthenticated, isAuthLoading } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<ResetPasswordErrors>({});
  const [isPreparingSession, setIsPreparingSession] = useState(true);
  const [isRecoverySessionReady, setIsRecoverySessionReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const confirmPasswordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let isMounted = true;

    const checkRecoverySession = async () => {
      setIsPreparingSession(true);
      setIsRecoverySessionReady(false);
      setRecoveryError('');

      try {
        for (
          let attempt = 0;
          attempt < resetSessionCheckMaxAttempts;
          attempt += 1
        ) {
          const { data } = await getCurrentSession();

          if (!isMounted) {
            return;
          }

          if (data.session) {
            setIsRecoverySessionReady(true);
            setRecoveryError('');
            setIsPreparingSession(false);
            return;
          }

          await wait(resetSessionCheckIntervalMs);
        }

        if (isMounted) {
          setRecoveryError(invalidResetLinkMessage);
          setIsRecoverySessionReady(false);
        }
      } catch {
        if (isMounted) {
          setRecoveryError(invalidResetLinkMessage);
          setIsRecoverySessionReady(false);
        }
      } finally {
        if (isMounted) {
          setIsPreparingSession(false);
        }
      }
    };

    checkRecoverySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const clearFieldError = (field: keyof ResetPasswordErrors) => {
    setErrors((currentErrors) => {
      if (!currentErrors[field]) {
        return currentErrors;
      }

      const nextErrors = { ...currentErrors };
      delete nextErrors[field];

      return nextErrors;
    });
  };

  const handleNewPasswordChange = (text: string) => {
    setNewPassword(text);
    setSubmitError('');
    setSuccessMessage('');
    clearFieldError('newPassword');
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    setSubmitError('');
    setSuccessMessage('');
    clearFieldError('confirmPassword');
  };

  const validateForm = () => {
    const nextErrors: ResetPasswordErrors = {};

    if (!newPassword) {
      nextErrors.newPassword = 'New password is required';
    } else if (newPassword.length < 8) {
      nextErrors.newPassword = 'Password must be at least 8 characters';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Confirm your new password';
    } else if (newPassword && confirmPassword !== newPassword) {
      nextErrors.confirmPassword = 'Passwords must match';
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length === 0;
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    onBack?.();
  };

  const handleUpdatePasswordPress = async () => {
    Keyboard.dismiss();
    setSubmitError('');
    setSuccessMessage('');

    if (!validateForm()) {
      return;
    }

    if (isPreparingSession) {
      setSubmitError('Give the reset link a moment to finish opening.');
      return;
    }

    if (!isRecoverySessionReady) {
      setSubmitError(invalidResetLinkMessage);
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        setSubmitError(
          "We couldn't update your password. Open the latest reset link and try again.",
        );
        return;
      }

      setSuccessMessage('Password updated.');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setSubmitError(
        "We couldn't update your password. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinuePress = () => {
    router.replace(isAuthenticated ? '/profile' : '/sign-in');
  };

  const isBusy = isPreparingSession || isSubmitting || !isRecoverySessionReady;
  const continueTitle = isAuthenticated ? 'Go to Profile' : 'Go to Sign in';
  const visibleError = isPreparingSession ? '' : recoveryError || submitError;

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
              Reset password
            </AppText>
            <AppText style={styles.subtitle} variant="subtitle">
              Choose a new password for your RetTrack account.
            </AppText>
          </View>

          <View style={styles.fields}>
            <AppTextField
              autoCapitalize="none"
              error={errors.newPassword}
              label="New password"
              onChangeText={handleNewPasswordChange}
              onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
              placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
              returnKeyType="next"
              secureTextEntry
              showPasswordToggle
              textContentType="newPassword"
              value={newPassword}
            />
            <AppTextField
              ref={confirmPasswordInputRef}
              autoCapitalize="none"
              error={errors.confirmPassword}
              label="Confirm password"
              onChangeText={handleConfirmPasswordChange}
              onSubmitEditing={handleUpdatePasswordPress}
              placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
              returnKeyType="done"
              secureTextEntry
              showPasswordToggle
              textContentType="newPassword"
              value={confirmPassword}
            />
          </View>

          {isPreparingSession ? (
            <View style={styles.statusCard}>
              <AppText style={styles.statusText} variant="caption">
                Preparing reset link...
              </AppText>
            </View>
          ) : null}

          {visibleError ? (
            <View style={styles.submitErrorCard}>
              <AppText style={styles.submitErrorText} variant="caption">
                {visibleError}
              </AppText>
            </View>
          ) : null}

          {successMessage ? (
            <View style={styles.successCard}>
              <AppText style={styles.successText} variant="caption">
                {successMessage}
              </AppText>
            </View>
          ) : null}
        </View>

        <View style={styles.actions}>
          {successMessage ? (
            <AppButton
              disabled={isAuthLoading}
              onPress={handleContinuePress}
              title={continueTitle}
              variant="primary"
            />
          ) : (
            <AppButton
              disabled={isBusy}
              onPress={handleUpdatePasswordPress}
              title={isSubmitting ? 'Updating password...' : 'Update password'}
              variant="primary"
            />
          )}
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
  statusCard: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  statusText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
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
  successCard: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  successText: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
});
