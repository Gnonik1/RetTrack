import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { AppTextField } from '../../../components/AppTextField';
import { theme } from '../../../constants/theme';

type SignUpScreenProps = {
  onBack?: () => void;
  onCreateAccount?: () => void;
};

export function SignUpScreen({ onBack, onCreateAccount }: SignUpScreenProps) {
  return (
    <AppScreen style={styles.screen}>
      <View style={styles.content}>
        <Pressable
          accessibilityLabel="Back"
          accessibilityRole="button"
          onPress={onBack}
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
            label="Full name"
            placeholder="Your name"
            textContentType="name"
          />
          <AppTextField
            autoCapitalize="none"
            keyboardType="email-address"
            label="Email"
            placeholder="you@example.com"
            textContentType="emailAddress"
          />
          <AppTextField
            autoCapitalize="none"
            label="Password"
            placeholder={'\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
            secureTextEntry
            showPasswordToggle
            textContentType="newPassword"
          />
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          onPress={onCreateAccount}
          title="Create account"
          variant="primary"
        />
        <AppButton title="Continue with Google" variant="outline" />
        <AppButton title="Continue with Apple" variant="outline" />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.xl + theme.spacing.xs,
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
