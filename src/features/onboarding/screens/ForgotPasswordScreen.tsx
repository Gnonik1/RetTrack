import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { AppTextField } from '../../../components/AppTextField';
import { theme } from '../../../constants/theme';
import { resetPassword } from '../../../services/authService';

type ForgotPasswordScreenProps = {
  onBack?: () => void;
};

type ResetMessage = {
  text: string;
  type: 'error' | 'success';
};

const forgotPasswordSubtitle =
  'Enter your email and we\u2019ll send reset instructions.';
const resetConfirmationMessage =
  'If an account exists for this email, reset instructions will be sent';
const resetErrorMessage =
  "We couldn't send a reset email. Check your email and try again.";
const resetConnectionErrorMessage =
  "We couldn't send a reset email. Check your connection and try again.";

function isValidEmailForMvp(email: string) {
  const atIndex = email.indexOf('@');
  const dotAfterAtIndex = email.indexOf('.', atIndex + 1);

  return (
    atIndex > 0 &&
    dotAfterAtIndex > atIndex + 1 &&
    dotAfterAtIndex < email.length - 1
  );
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [isSendingResetLink, setIsSendingResetLink] = useState(false);
  const [resetMessage, setResetMessage] = useState<ResetMessage | null>(null);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError(undefined);
    setResetMessage(null);
  };

  const validateEmail = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError('Email is required');
      setResetMessage(null);
      return false;
    }

    if (!isValidEmailForMvp(trimmedEmail)) {
      setEmailError('Enter a valid email');
      setResetMessage(null);
      return false;
    }

    setEmailError(undefined);
    return true;
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    onBack?.();
  };

  const handleSendResetLink = async () => {
    if (isSendingResetLink) {
      return;
    }

    Keyboard.dismiss();
    setResetMessage(null);

    if (!validateEmail()) {
      return;
    }

    setIsSendingResetLink(true);

    try {
      const { error } = await resetPassword(email.trim());

      if (error) {
        setResetMessage({
          text: resetErrorMessage,
          type: 'error',
        });
        return;
      }

      setResetMessage({
        text: resetConfirmationMessage,
        type: 'success',
      });
    } catch {
      setResetMessage({
        text: resetConnectionErrorMessage,
        type: 'error',
      });
    } finally {
      setIsSendingResetLink(false);
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
              Forgot password?
            </AppText>
            <AppText style={styles.subtitle} variant="subtitle">
              {forgotPasswordSubtitle}
            </AppText>
          </View>

          <View style={styles.fields}>
            <AppTextField
              autoCapitalize="none"
              error={emailError}
              keyboardType="email-address"
              label="Email"
              onChangeText={handleEmailChange}
              onSubmitEditing={handleSendResetLink}
              placeholder="you@example.com"
              returnKeyType="done"
              textContentType="emailAddress"
              value={email}
            />

            {resetMessage ? (
              <View
                style={[
                  styles.confirmationNote,
                  resetMessage.type === 'error' && styles.errorNote,
                ]}
              >
                <AppText
                  style={[
                    styles.confirmationText,
                    resetMessage.type === 'error' && styles.errorText,
                  ]}
                  variant="caption"
                >
                  {resetMessage.text}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            disabled={isSendingResetLink}
            onPress={handleSendResetLink}
            style={styles.primaryActionButton}
            title={isSendingResetLink ? 'Sending reset...' : 'Send reset link'}
            variant="primary"
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
  confirmationNote: {
    backgroundColor: theme.colors.sage,
    borderColor: 'rgba(216, 226, 207, 0.92)',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  confirmationText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  errorNote: {
    backgroundColor: theme.colors.softPending,
    borderColor: '#E4C8C1',
  },
  errorText: {
    color: theme.colors.pending,
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
