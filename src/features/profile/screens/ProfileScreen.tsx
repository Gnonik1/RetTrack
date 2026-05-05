import { ScrollView, StyleSheet, View } from 'react-native';

import { AppBottomNav } from '../../../components/AppBottomNav';
import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import { GUEST_ITEM_LIMIT } from '../../purchases/constants';
import { usePurchases } from '../../purchases/state/PurchasesState';

type ProfileScreenProps = {
  onSignIn?: () => void;
  onSignUp?: () => void;
};

export function ProfileScreen({ onSignIn, onSignUp }: ProfileScreenProps) {
  const { guestPurchaseEntriesUsed } = usePurchases();
  const usagePercent = Math.min(
    100,
    Math.round((guestPurchaseEntriesUsed / GUEST_ITEM_LIMIT) * 100),
  );
  const usageProgressStyle = {
    width: `${usagePercent}%` as `${number}%`,
  };

  return (
    <AppScreen style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <View style={styles.header}>
          <AppText style={styles.title} variant="title">
            Profile
          </AppText>
          <AppText style={styles.subtitle} variant="subtitle">
            Your RetTrack account.
          </AppText>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <AppText style={styles.avatarText} variant="button">
              G
            </AppText>
          </View>

          <AppText style={styles.guestTitle} variant="body">
            Guest User
          </AppText>
          <AppText style={styles.guestBody} variant="caption">
            Create an account anytime to sync your purchases.
          </AppText>

          <View style={styles.usagePanel}>
            <View style={styles.usageTopRow}>
              <AppText style={styles.usageLabel} variant="caption">
                Free plan
              </AppText>
            </View>

            <AppText style={styles.usageTitle} variant="body">
              {guestPurchaseEntriesUsed} / {GUEST_ITEM_LIMIT} guest entries used
            </AppText>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, usageProgressStyle]} />
            </View>
            <AppText style={styles.usageNote} variant="caption">
              Create an account for more room and more photos.
            </AppText>
          </View>

          <View style={styles.limitsCard}>
            <View style={styles.limitColumn}>
              <AppText style={styles.limitEyebrow} variant="caption">
                Guest
              </AppText>
              <View style={styles.limitLine}>
                <View style={styles.limitDot} />
                <AppText style={styles.limitText} variant="caption">
                  Up to {GUEST_ITEM_LIMIT} entries
                </AppText>
              </View>
              <View style={styles.limitLine}>
                <View style={styles.limitDot} />
                <AppText style={styles.limitText} variant="caption">
                  1 photo per item
                </AppText>
              </View>
            </View>

            <View style={styles.limitDivider} />

            <View style={[styles.limitColumn, styles.accountLimitColumn]}>
              <AppText style={styles.accountLimitEyebrow} variant="caption">
                Account
              </AppText>
              <View style={styles.limitLine}>
                <View style={[styles.limitDot, styles.accountLimitDot]} />
                <AppText style={styles.accountLimitText} variant="caption">
                  Up to 20 items
                </AppText>
              </View>
              <View style={styles.limitLine}>
                <View style={[styles.limitDot, styles.accountLimitDot]} />
                <AppText style={styles.accountLimitText} variant="caption">
                  Up to 3 photos per item
                </AppText>
              </View>
            </View>
          </View>

          <View style={styles.ratingCard}>
            <View style={styles.ratingStars}>
              <View style={styles.ratingDot} />
              <View style={styles.ratingDot} />
              <View style={styles.ratingDot} />
              <View style={styles.ratingDot} />
              <View style={styles.ratingDotMuted} />
            </View>
            <AppText style={styles.ratingTitle} variant="body">
              Rate RetTrack
            </AppText>
            <AppText style={styles.ratingBody} variant="caption">
              Enjoying RetTrack? A quick App Store rating helps us grow.
            </AppText>
            <View style={styles.ratingCta}>
              <AppText style={styles.ratingCtaText} variant="caption">
                Rate on App Store
              </AppText>
            </View>
          </View>

          <View style={styles.actions}>
            <AppButton onPress={onSignUp} title="Sign up" />
            <AppButton onPress={onSignIn} title="Sign in" variant="outline" />
          </View>
        </View>
      </ScrollView>

      <AppBottomNav activeTab="profile" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignSelf: 'stretch',
    gap: theme.spacing.sm,
    marginTop: 12,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E6EEDF',
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  avatarText: {
    color: theme.colors.greenDark,
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 24,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 112,
    paddingTop: theme.spacing.xs,
  },
  guestBody: {
    color: theme.colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 5,
    maxWidth: 250,
    textAlign: 'center',
  },
  guestTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 24,
    marginTop: 11,
    textAlign: 'center',
  },
  header: {
    gap: 6,
  },
  accountLimitColumn: {
    backgroundColor: '#F3F6EF',
    borderColor: '#D9E4D1',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  accountLimitDot: {
    backgroundColor: theme.colors.greenDark,
    opacity: 0.68,
  },
  accountLimitEyebrow: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
    marginBottom: 7,
  },
  accountLimitText: {
    color: theme.colors.text,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  limitColumn: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 4,
    paddingVertical: 9,
  },
  limitDivider: {
    backgroundColor: theme.colors.border,
    width: 1,
  },
  limitDot: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 4,
    marginTop: 6,
    opacity: 0.42,
    width: 4,
  },
  limitEyebrow: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
    marginBottom: 7,
  },
  limitLine: {
    flexDirection: 'row',
    gap: 7,
    marginTop: 5,
  },
  limitText: {
    color: theme.colors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  limitsCard: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.paper,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    padding: 12,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    marginTop: 22,
    paddingHorizontal: 18,
    paddingVertical: 17,
  },
  progressFill: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: '#DDE6D5',
    borderRadius: theme.radius.pill,
    height: 6,
    marginTop: 11,
    overflow: 'hidden',
  },
  ratingBody: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    textAlign: 'center',
  },
  ratingCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#F3F6EF',
    borderColor: '#D9E4D1',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  ratingCta: {
    backgroundColor: theme.colors.card,
    borderColor: '#D9E4D1',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  ratingCtaText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  ratingDot: {
    backgroundColor: theme.colors.amber,
    borderRadius: theme.radius.pill,
    height: 5,
    width: 5,
  },
  ratingDotMuted: {
    backgroundColor: theme.colors.amber,
    borderRadius: theme.radius.pill,
    height: 5,
    opacity: 0.34,
    width: 5,
  },
  ratingStars: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 8,
  },
  ratingTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 20,
    textAlign: 'center',
  },
  screen: {
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: theme.colors.muted,
    lineHeight: 21,
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.text,
    fontSize: 29,
    lineHeight: 36,
  },
  usageLabel: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  usageNote: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  usagePanel: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.sage,
    borderColor: '#D8E3D0',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  usageTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 21,
    marginTop: 8,
  },
  usageTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
