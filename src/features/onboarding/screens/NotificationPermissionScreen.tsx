import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';

type NotificationPermissionScreenProps = {
  isNotificationsEnabled?: boolean;
  onBack?: () => void;
  onDone?: () => void;
  onEnableNotifications?: () => void;
  onNotNow?: () => void;
};

export function NotificationPermissionScreen({
  isNotificationsEnabled = false,
  onBack,
  onDone,
  onEnableNotifications,
  onNotNow,
}: NotificationPermissionScreenProps) {
  return (
    <AppScreen style={styles.screen}>
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

      <View style={styles.centerArea}>
        <View style={styles.content}>
          <View style={styles.iconCard} accessibilityElementsHidden importantForAccessibility="no">
            <View style={styles.bell}>
              <View style={styles.bellTop} />
              <View style={styles.bellBody} />
              <View style={styles.bellBase} />
              <View style={styles.bellClapper} />
            </View>
            <View style={styles.reminderDot} />
          </View>

          {isNotificationsEnabled ? (
            <>
              <AppText style={styles.title} variant="title">
                Notifications{'\n'}are on
              </AppText>
              <AppText style={styles.subtitle} variant="subtitle">
                We{'\u2019'}ll remind you before return dates and pending decisions.
              </AppText>

              <View style={styles.enabledCard}>
                <View style={styles.enabledItem}>
                  <AppText style={styles.enabledItemTitle} variant="body">
                    Return reminders
                  </AppText>
                  <AppText style={styles.enabledItemBody} variant="caption">
                    7 days before, 3 days before, and last day
                  </AppText>
                </View>
                <View style={styles.enabledDivider} />
                <View style={styles.enabledItem}>
                  <AppText style={styles.enabledItemTitle} variant="body">
                    Pending reminders
                  </AppText>
                  <AppText style={styles.enabledItemBody} variant="caption">
                    When a return date passes, then 3 and 7 days later
                  </AppText>
                </View>
                <View style={styles.enabledDivider} />
                <View style={styles.enabledItem}>
                  <AppText style={styles.enabledItemTitle} variant="body">
                    Quiet hours
                  </AppText>
                  <AppText style={styles.enabledItemBody} variant="caption">
                    No reminders from 9 PM to 9 AM
                  </AppText>
                </View>
              </View>
            </>
          ) : (
            <>
              <AppText style={styles.title} variant="title">
                Want reminders{'\n'}before it{'\u2019'}s too late?
              </AppText>
              <AppText style={styles.subtitle} variant="subtitle">
                Get reminded before return dates and stay updated on your purchases
              </AppText>
            </>
          )}
        </View>
      </View>

      <View style={styles.actions}>
        {isNotificationsEnabled ? (
          <AppButton onPress={onDone} title="Done" variant="primary" />
        ) : (
          <>
            <AppButton
              onPress={onEnableNotifications}
              title="Enable notifications"
              variant="primary"
            />
            <Pressable
              accessibilityRole="button"
              onPress={onNotNow}
              style={styles.notNowButton}
            >
              <AppText style={styles.notNowText} variant="button">
                Not now
              </AppText>
            </Pressable>
          </>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
  },
  centerArea: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingBottom: theme.spacing.xxl + 42,
  },
  content: {
    alignItems: 'center',
    width: '100%',
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
  iconCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: 36,
    borderWidth: 1,
    height: 118,
    justifyContent: 'center',
    marginBottom: theme.spacing.lg + theme.spacing.xs,
    shadowColor: theme.colors.text,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.075,
    shadowRadius: 20,
    width: 118,
  },
  bell: {
    alignItems: 'center',
    height: 62,
    justifyContent: 'flex-end',
    width: 58,
  },
  bellTop: {
    backgroundColor: theme.colors.green,
    borderRadius: theme.radius.pill,
    height: 9,
    marginBottom: -2,
    opacity: 0.92,
    width: 16,
  },
  bellBody: {
    backgroundColor: theme.colors.green,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    height: 40,
    opacity: 0.92,
    width: 43,
  },
  bellBase: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 5,
    marginTop: -2,
    opacity: 0.86,
    width: 51,
  },
  bellClapper: {
    backgroundColor: theme.colors.amber,
    borderRadius: theme.radius.pill,
    height: 8,
    marginTop: 3,
    width: 8,
  },
  reminderDot: {
    backgroundColor: theme.colors.amber,
    borderColor: theme.colors.card,
    borderRadius: theme.radius.pill,
    borderWidth: 3,
    height: 19,
    position: 'absolute',
    right: 31,
    top: 30,
    width: 19,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 38,
    textAlign: 'center',
  },
  subtitle: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    lineHeight: 23,
    marginTop: theme.spacing.md,
    maxWidth: 254,
    textAlign: 'center',
  },
  enabledCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    marginTop: theme.spacing.lg,
    paddingHorizontal: 16,
    paddingVertical: 14,
    shadowColor: theme.colors.text,
    shadowOffset: {
      height: 10,
      width: 0,
    },
    shadowOpacity: 0.045,
    shadowRadius: 16,
    width: '100%',
  },
  enabledDivider: {
    backgroundColor: theme.colors.border,
    height: 1,
    marginVertical: 12,
  },
  enabledItem: {
    gap: 4,
  },
  enabledItemBody: {
    color: theme.colors.muted,
    fontSize: 13,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 18,
  },
  enabledItemTitle: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 20,
  },
  actions: {
    gap: 12,
    width: '100%',
  },
  notNowButton: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: theme.spacing.sm,
  },
  notNowText: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
});
