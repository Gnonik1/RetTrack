import { useRouter } from 'expo-router';
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
import { signInWithEmail } from '../../../services/authService';

type SignInScreenProps = {
  onBack?: () => void;
  onForgotPassword?: () => void;
};

type SignInErrors = {
  email?: string;
  password?: string;
};

function isValidEmailForMvp(email: string) {
  const atIndex = email.indexOf('@');
  const dotAfterAtIndex = email.indexOf('.', atIndex + 1);

  return (
    atIndex > 0 &&
    dotAfterAtIndex > atIndex + 1 &&
    dotAfterAtIndex < email.length - 1
  );
}

export function SignInScreen({
  onBack,
  onForgotPassword,
}: SignInScreenProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignInErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
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
    setSubmitError('');

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await signInWithEmail(email.trim(), password);

      if (error) {
        setSubmitError(
          "We couldn't sign you in. Check your email and password, then try again.",
        );
        return;
      }

      router.replace('/profile');
    } catch {
      setSubmitError(
        "We couldn't sign you in. Check your connection and try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPasswordPress = () => {
    Keyboard.dismiss();
    onForgotPassword?.();
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
            onPress={handleForgotPasswordPress}
            style={styles.forgotButton}
          >
            <AppText style={styles.forgotText} variant="button">
              Forgot password?
            </AppText>
          </Pressable>

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
            disabled={isSubmitting}
            onPress={handleSignInPress}
            title={isSubmitting ? 'Signing in...' : 'Sign in'}
            variant="primary"
          />
          <AppButton
            disabled={isSubmitting}
            onPress={Keyboard.dismiss}
            title="Continue with Google"
            variant="outline"
          />
          <AppButton
            disabled={isSubmitting}
            onPress={Keyboard.dismiss}
            title="Continue with Apple"
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
  forgotText: {
    ...theme.typography.textLink,
    color: theme.colors.green,
    fontWeight: theme.fontWeight.medium,
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
