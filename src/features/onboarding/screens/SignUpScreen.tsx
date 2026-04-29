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

type SignUpScreenProps = {
  onBack?: () => void;
  onCreateAccount?: () => void;
};

type SignUpErrors = {
  fullName?: string;
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

export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<SignUpErrors>({});
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
    clearFieldError('fullName');
  };

  const handleEmailChange = (text: string) => {
    setEmail(text);
    clearFieldError('email');
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
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

  const handleCreateAccountPress = () => {
    Keyboard.dismiss();

    if (!validateForm()) {
      return;
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
        </View>

        <View style={styles.actions}>
          <AppButton
            onPress={handleCreateAccountPress}
            title="Create account"
            variant="primary"
          />
          <AppButton
            onPress={Keyboard.dismiss}
            title="Continue with Google"
            variant="outline"
          />
          <AppButton
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
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: theme.fontWeight.bold,
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
  actions: {
    gap: 12,
    width: '100%',
  },
});
