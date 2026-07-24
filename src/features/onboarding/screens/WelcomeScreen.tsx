import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';

type WelcomeScreenProps = {
  appleError?: string;
  googleError?: string;
  isContinuingWithApple?: boolean;
  isContinuingAsGuest?: boolean;
  isContinuingWithGoogle?: boolean;
  onContinueAsGuest?: () => void;
  onContinueWithApple?: () => void;
  onContinueWithEmail?: () => void;
  onContinueWithGoogle?: () => void;
  onSignIn?: () => void;
};

export function WelcomeScreen({
  appleError,
  googleError,
  isContinuingWithApple = false,
  isContinuingAsGuest = false,
  isContinuingWithGoogle = false,
  onContinueAsGuest,
  onContinueWithApple,
  onContinueWithEmail,
  onContinueWithGoogle,
  onSignIn,
}: WelcomeScreenProps) {
  const isContinuing =
    isContinuingAsGuest || isContinuingWithApple || isContinuingWithGoogle;

  return (
    <AppScreen style={styles.screen}>
      <View style={styles.hero}>
        <View style={styles.logoCard}>
          <Image
            resizeMode="contain"
            source={require('../../../../assets/rettrack-logo-mark.png')}
            style={styles.logoImage}
          />
        </View>

        <View style={styles.copy}>
          <AppText style={styles.title} variant="title">
            Track what you buy
          </AppText>
          <AppText style={styles.emphasis} variant="title">
            Return on time
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            Return windows close quietly. Get a reminder before yours does — and
            keep the money you'd have lost.
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton
          disabled={isContinuing}
          onPress={onContinueWithApple}
          title={
            isContinuingWithApple
              ? 'Continuing with Apple...'
              : 'Continue with Apple'
          }
          variant="outline"
        />
        {appleError ? (
          <View style={styles.errorCard}>
            <AppText style={styles.errorText} variant="caption">
              {appleError}
            </AppText>
          </View>
        ) : null}
        <AppButton
          disabled={isContinuing}
          onPress={onContinueWithGoogle}
          title={
            isContinuingWithGoogle
              ? 'Continuing with Google...'
              : 'Continue with Google'
          }
          variant="primary"
        />
        {googleError ? (
          <View style={styles.errorCard}>
            <AppText style={styles.errorText} variant="caption">
              {googleError}
            </AppText>
          </View>
        ) : null}
        <AppButton
          disabled={isContinuing}
          onPress={onContinueWithEmail}
          title="Continue with Email"
          variant="outline"
        />
        <AppButton
          disabled={isContinuing}
          onPress={onContinueAsGuest}
          title={
            isContinuingAsGuest ? 'Continuing as guest...' : 'Continue as guest'
          }
          variant="secondary"
        />

        <Pressable
          accessibilityRole="button"
          disabled={isContinuing}
          onPress={onSignIn}
          style={[
            styles.signInButton,
            isContinuing ? styles.signInButtonDisabled : null,
          ]}
        >
          <View style={styles.signInRow}>
            <AppText style={styles.signInPrompt} variant="body">
              Already have an account?{' '}
            </AppText>
            <AppText style={styles.signInAction} variant="button">
              Sign in
            </AppText>
          </View>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl + theme.spacing.sm,
  },
  logoCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: 36,
    borderWidth: 1,
    height: 128,
    justifyContent: 'center',
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    width: 128,
  },
  logoImage: {
    height: 82,
    width: 82,
  },
  copy: {
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    textAlign: 'center',
  },
  emphasis: {
    color: theme.colors.green,
    fontSize: theme.fontSize.xl,
    fontWeight: theme.fontWeight.bold,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    lineHeight: 22,
    marginTop: theme.spacing.lg,
    maxWidth: 320,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  errorCard: {
    backgroundColor: theme.colors.softPending,
    borderColor: '#E4C8C1',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  errorText: {
    color: theme.colors.pending,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    textAlign: 'center',
  },
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signInPrompt: {
    color: theme.colors.muted,
  },
  signInAction: {
    color: theme.colors.greenDark,
  },
});
