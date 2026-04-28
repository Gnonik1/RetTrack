import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';

type WelcomeScreenProps = {
  onContinueAsGuest?: () => void;
  onContinueWithEmail?: () => void;
  onSignIn?: () => void;
};

export function WelcomeScreen({
  onContinueAsGuest,
  onContinueWithEmail,
  onSignIn,
}: WelcomeScreenProps) {
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
            Never lose track of what you purchased.
          </AppText>
        </View>
      </View>

      <View style={styles.actions}>
        <AppButton title="Continue with Apple" variant="outline" />
        <AppButton title="Continue with Google" variant="primary" />
        <AppButton
          onPress={onContinueWithEmail}
          title="Continue with Email"
          variant="outline"
        />
        <AppButton
          onPress={onContinueAsGuest}
          title="Continue as guest"
          variant="secondary"
        />

        <Pressable
          accessibilityRole="button"
          onPress={onSignIn}
          style={styles.signInButton}
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
  signInButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
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
