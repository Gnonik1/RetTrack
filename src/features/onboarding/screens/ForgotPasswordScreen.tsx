import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { AppTextField } from '../../../components/AppTextField';
import { theme } from '../../../constants/theme';

type ForgotPasswordScreenProps = {
  onBack?: () => void;
};

const forgotPasswordSubtitle =
  'Enter your email and we\u2019ll send reset instructions.';
const resetConfirmationMessage =
  'If an account exists for that email, we\u2019ll send password reset instructions.';

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
  const [isConfirmationVisible, setIsConfirmationVisible] = useState(false);

  const handleEmailChange = (text: string) => {
    setEmail(text);
    setEmailError(undefined);
    setIsConfirmationVisible(false);
  };

  const validateEmail = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError('Email is required');
      setIsConfirmationVisible(false);
      return false;
    }

    if (!isValidEmailForMvp(trimmedEmail)) {
      setEmailError('Enter a valid email');
      setIsConfirmationVisible(false);
      return false;
    }

    setEmailError(undefined);
    return true;
  };

  const handleBackPress = () => {
    Keyboard.dismiss();
    onBack?.();
  };

  const handleSendResetLink = () => {
    Keyboard.dismiss();

    if (!validateEmail()) {
      return;
    }

    setIsConfirmationVisible(true);
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

            {isConfirmationVisible ? (
              <View style={styles.confirmationNote}>
                <AppText style={styles.confirmationText} variant="caption">
                  {resetConfirmationMessage}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.actions}>
          <AppButton
            onPress={handleSendResetLink}
            title="Send reset link"
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
  confirmationNote: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  confirmationText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
});
