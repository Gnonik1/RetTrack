import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppBottomNav } from '../../../components/AppBottomNav';
import { AppButton } from '../../../components/AppButton';
import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { theme } from '../../../constants/theme';
import { signOut } from '../../../services/authService';
import { useAuth } from '../../../state/AuthState';
import { ACCOUNT_ITEM_LIMIT, GUEST_ITEM_LIMIT } from '../../purchases/constants';
import { usePurchases } from '../../purchases/state/PurchasesState';

type ProfileScreenProps = {
  onSignIn?: () => void;
  onSignUp?: () => void;
};

type SnapshotCounts = {
  activeOpen: number;
  kept: number;
  returned: number;
};

function getAccountInitial(fullName?: string | null, email?: string) {
  const trimmedFullName = fullName?.trim();
  const trimmedEmail = email?.trim();

  if (trimmedFullName) {
    return trimmedFullName.charAt(0).toUpperCase();
  }

  return trimmedEmail ? trimmedEmail.charAt(0).toUpperCase() : 'A';
}

function getUserAvatarUrl(
  metadata?: Record<string, unknown> | null,
): string | undefined {
  const avatarUrl = metadata?.avatar_url;
  const picture = metadata?.picture;

  if (typeof avatarUrl === 'string' && avatarUrl.trim()) {
    return avatarUrl.trim();
  }

  if (typeof picture === 'string' && picture.trim()) {
    return picture.trim();
  }

  return undefined;
}

function getProgressStyle(percent: number) {
  return {
    width: `${percent}%` as `${number}%`,
  };
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'guest' | 'loading' | 'signedIn';
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        tone === 'signedIn' && styles.statusBadgeSignedIn,
        tone === 'guest' && styles.statusBadgeGuest,
        tone === 'loading' && styles.statusBadgeLoading,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          tone === 'signedIn' && styles.statusDotSignedIn,
          tone === 'guest' && styles.statusDotGuest,
          tone === 'loading' && styles.statusDotLoading,
        ]}
      />
      <AppText
        style={[
          styles.statusBadgeText,
          tone === 'signedIn' && styles.statusBadgeTextSignedIn,
          tone === 'guest' && styles.statusBadgeTextGuest,
          tone === 'loading' && styles.statusBadgeTextLoading,
        ]}
        variant="caption"
      >
        {label}
      </AppText>
    </View>
  );
}

function RateRetTrackCard() {
  return (
    <View style={styles.ratingCard}>
      <AppText style={styles.ratingTitle} variant="body">
        Rate RetTrack
      </AppText>
      <AppText style={styles.ratingBody} variant="caption">
        Enjoying RetTrack? A quick App Store rating helps us grow.
      </AppText>
      <View style={styles.ratingCta}>
        <AppText style={styles.ratingCtaText} variant="caption">
          Rate app
        </AppText>
      </View>
    </View>
  );
}

function CurrentSnapshotCard({ snapshot }: { snapshot: SnapshotCounts }) {
  return (
    <View style={styles.snapshotCard}>
      <View style={styles.snapshotHeader}>
        <View style={styles.snapshotTitleBlock}>
          <AppText style={styles.snapshotTitle} variant="caption">
            Purchase status
          </AppText>
        </View>
      </View>

      <View style={styles.snapshotGrid}>
        <View style={[styles.snapshotItem, styles.snapshotItemOpen]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentOpen]} />
          <AppText style={styles.snapshotValue} variant="body">
            {snapshot.activeOpen}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelOpen]}
            variant="caption"
          >
            Open
          </AppText>
        </View>
        <View style={[styles.snapshotItem, styles.snapshotItemReturned]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentReturned]} />
          <AppText style={styles.snapshotValue} variant="body">
            {snapshot.returned}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelReturned]}
            variant="caption"
          >
            Returned
          </AppText>
        </View>
        <View style={[styles.snapshotItem, styles.snapshotItemKept]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentKept]} />
          <AppText style={styles.snapshotValue} variant="body">
            {snapshot.kept}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelKept]}
            variant="caption"
          >
            Kept
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function ProfileScreen({ onSignIn, onSignUp }: ProfileScreenProps) {
  const {
    isAuthenticated,
    isAuthLoading,
    isProfileLoading,
    profileFullName,
    user,
  } = useAuth();
  const {
    accountPurchaseEntriesUsed,
    guestPurchaseEntriesUsed,
    hasHydratedPurchases,
    purchases,
  } = usePurchases();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [hasAvatarLoadError, setHasAvatarLoadError] = useState(false);
  const userEmail = user?.email;
  const googleAvatarUrl = getUserAvatarUrl(user?.user_metadata);
  const shouldShowAvatarImage =
    isAuthenticated && Boolean(googleAvatarUrl) && !hasAvatarLoadError;
  const accountDisplayName = profileFullName ?? userEmail ?? 'Signed in';
  const guestRemainingItems = Math.max(
    GUEST_ITEM_LIMIT - guestPurchaseEntriesUsed,
    0,
  );
  const usagePercent = Math.min(
    100,
    Math.round((guestPurchaseEntriesUsed / GUEST_ITEM_LIMIT) * 100),
  );
  const isAccountLoading =
    isAuthLoading ||
    (isAuthenticated && (isProfileLoading || !hasHydratedPurchases));
  const accountRemainingItems = Math.max(
    ACCOUNT_ITEM_LIMIT - accountPurchaseEntriesUsed,
    0,
  );
  const accountUsagePercent = Math.min(
    100,
    Math.round((accountPurchaseEntriesUsed / ACCOUNT_ITEM_LIMIT) * 100),
  );
  const snapshot = useMemo(
    () =>
      purchases.reduce<SnapshotCounts>(
        (counts, purchase) => {
          if (purchase.status === 'returned') {
            return {
              ...counts,
              returned: counts.returned + 1,
            };
          }

          if (purchase.status === 'kept') {
            return {
              ...counts,
              kept: counts.kept + 1,
            };
          }

          return {
            ...counts,
            activeOpen: counts.activeOpen + 1,
          };
        },
        {
          activeOpen: 0,
          kept: 0,
          returned: 0,
        },
      ),
    [purchases],
  );
  const shouldShowSnapshot =
    !isAccountLoading && hasHydratedPurchases && purchases.length > 0;
  const accountName = isAccountLoading
    ? 'Checking account'
    : isAuthenticated
      ? accountDisplayName
      : 'Guest User';
  const accountMeta = isAccountLoading
    ? 'Loading your RetTrack account.'
    : isAuthenticated
      ? userEmail
      : undefined;
  const avatarLabel = isAuthenticated
    ? getAccountInitial(profileFullName, userEmail)
    : 'G';

  useEffect(() => {
    setHasAvatarLoadError(false);
  }, [googleAvatarUrl]);

  const handleSignOutPress = async () => {
    if (isSigningOut) {
      return;
    }

    setSignOutError('');
    setIsSigningOut(true);

    try {
      const { error } = await signOut();

      if (error) {
        setSignOutError("We couldn't sign you out. Please try again.");
      }
    } catch {
      setSignOutError("We couldn't sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <AppScreen style={styles.screen}>
      <LinearGradient
        colors={['#FBFAF3', '#F0F5E9', '#FFF8EC']}
        end={{ x: 0.94, y: 1 }}
        locations={[0, 0.52, 1]}
        pointerEvents="none"
        start={{ x: 0.08, y: 0 }}
        style={styles.backgroundBaseGradient}
      />
      <View pointerEvents="none" style={styles.backgroundGlowTop} />
      <View pointerEvents="none" style={styles.backgroundSageVeil} />
      <View pointerEvents="none" style={styles.backgroundMossGlow} />
      <View pointerEvents="none" style={styles.backgroundCardWash} />
      <View pointerEvents="none" style={styles.backgroundWarmVeil} />
      <View pointerEvents="none" style={styles.backgroundGlowBottom} />

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
          <View style={styles.identityRow}>
            <View style={styles.avatar}>
              {shouldShowAvatarImage && googleAvatarUrl ? (
                <Image
                  accessibilityIgnoresInvertColors
                  onError={() => setHasAvatarLoadError(true)}
                  source={{ uri: googleAvatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <AppText style={styles.avatarText} variant="button">
                  {avatarLabel}
                </AppText>
              )}
            </View>

            <View style={styles.identityContent}>
              <StatusBadge
                label={
                  isAccountLoading
                    ? 'Checking'
                    : isAuthenticated
                      ? 'Signed in'
                      : 'Guest mode'
                }
                tone={
                  isAccountLoading
                    ? 'loading'
                    : isAuthenticated
                      ? 'signedIn'
                      : 'guest'
                }
              />
              <AppText
                numberOfLines={2}
                style={styles.accountName}
                variant="body"
              >
                {accountName}
              </AppText>
              {accountMeta ? (
                <AppText
                  numberOfLines={1}
                  style={styles.accountMeta}
                  variant="caption"
                >
                  {accountMeta}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.syncRow}>
            <View style={styles.syncDot} />
            <AppText style={styles.syncText} variant="caption">
              {isAccountLoading
                ? 'Preparing your account details'
                : isAuthenticated
                  ? 'Purchases sync across devices'
                  : 'Saved only on this device'}
            </AppText>
          </View>

          {!isAccountLoading && isAuthenticated ? (
            <View style={styles.usageCard}>
              <View style={styles.usageHeader}>
                <AppText style={styles.usageLabel} variant="caption">
                  Account usage
                </AppText>
                <View style={styles.remainingPill}>
                  <AppText style={styles.remainingText} variant="caption">
                    {accountRemainingItems} remaining
                  </AppText>
                </View>
              </View>

              <AppText style={styles.usageTitle} variant="body">
                {accountPurchaseEntriesUsed} / {ACCOUNT_ITEM_LIMIT} purchase entries used
              </AppText>
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    getProgressStyle(accountUsagePercent),
                  ]}
                />
              </View>
              <View style={styles.featureLine}>
                <View style={styles.featureDot} />
                <AppText style={styles.featureText} variant="caption">
                  Up to 3 photos per item
                </AppText>
              </View>
            </View>
          ) : null}

          {!isAccountLoading && !isAuthenticated ? (
            <>
              <View style={styles.usageCard}>
                <View style={styles.usageHeader}>
                  <AppText style={styles.usageLabel} variant="caption">
                    Guest usage
                  </AppText>
                  <View style={styles.remainingPill}>
                    <AppText style={styles.remainingText} variant="caption">
                      {guestRemainingItems} remaining
                    </AppText>
                  </View>
                </View>

                <AppText style={styles.usageTitle} variant="body">
                  {guestPurchaseEntriesUsed} / {GUEST_ITEM_LIMIT} guest entries used
                </AppText>
                <View style={styles.progressTrack}>
                  <View
                    style={[styles.progressFill, getProgressStyle(usagePercent)]}
                  />
                </View>
                <View style={styles.featureLine}>
                  <View style={styles.featureDot} />
                  <AppText style={styles.featureText} variant="caption">
                    1 photo per item
                  </AppText>
                </View>
              </View>

              <View style={styles.benefitsCard}>
                <View style={styles.benefitsHeader}>
                  <AppText style={styles.benefitsTitle} variant="caption">
                    Account unlocks
                  </AppText>
                  <View style={styles.benefitsPill}>
                    <AppText style={styles.benefitsPillText} variant="caption">
                      Account
                    </AppText>
                  </View>
                </View>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitDot} />
                  <AppText style={styles.benefitText} variant="caption">
                    Up to {ACCOUNT_ITEM_LIMIT} purchase entries
                  </AppText>
                </View>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitDot} />
                  <AppText style={styles.benefitText} variant="caption">
                    Up to 3 photos per item
                  </AppText>
                </View>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitDot} />
                  <AppText style={styles.benefitText} variant="caption">
                    Sync purchases across devices
                  </AppText>
                </View>
              </View>

              <RateRetTrackCard />
            </>
          ) : null}

          {shouldShowSnapshot ? <CurrentSnapshotCard snapshot={snapshot} /> : null}

          {!isAccountLoading && isAuthenticated ? <RateRetTrackCard /> : null}
        </View>

        {!isAccountLoading && !isAuthenticated ? (
          <View style={[styles.actions, styles.guestActions, styles.guestCtaSection]}>
            <AppButton
              onPress={onSignUp}
              style={styles.guestActionButton}
              title="Sign up"
            />
            <AppButton
              onPress={onSignIn}
              style={styles.guestActionButton}
              title="Sign in"
              variant="outline"
            />
          </View>
        ) : null}

        {!isAccountLoading && isAuthenticated ? (
          <View style={styles.signOutSection}>
            <Pressable
              accessibilityRole="button"
              disabled={isSigningOut}
              onPress={handleSignOutPress}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && !isSigningOut && styles.signOutButtonPressed,
                isSigningOut && styles.signOutButtonDisabled,
              ]}
            >
              <AppText style={styles.signOutButtonText} variant="button">
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </AppText>
            </Pressable>
            {signOutError ? (
              <View style={styles.signOutErrorCard}>
                <AppText style={styles.signOutErrorText} variant="caption">
                  {signOutError}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <AppBottomNav activeTab="profile" />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accountMeta: {
    color: '#74796F',
    fontSize: 14,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 21,
    marginTop: 3,
  },
  accountName: {
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 28,
    marginTop: 8,
  },
  actions: {
    alignSelf: 'stretch',
    gap: 10,
    marginTop: 14,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#E6EEDF',
    borderColor: '#DDE6D5',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 5,
      width: 0,
    },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 68,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarText: {
    color: theme.colors.greenDark,
    fontSize: 21,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 28,
  },
  backgroundBaseGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundCardWash: {
    backgroundColor: '#EEEBDC',
    borderRadius: 108,
    height: 650,
    left: -2,
    opacity: 0.46,
    position: 'absolute',
    right: -2,
    top: 260,
  },
  backgroundGlowBottom: {
    backgroundColor: '#EFE2C9',
    borderRadius: 460,
    bottom: -136,
    height: 920,
    left: -655,
    opacity: 0.28,
    position: 'absolute',
    width: 920,
  },
  backgroundGlowTop: {
    backgroundColor: '#E3EEDB',
    borderRadius: 470,
    height: 940,
    opacity: 0.32,
    position: 'absolute',
    right: -700,
    top: -540,
    width: 940,
  },
  backgroundMossGlow: {
    backgroundColor: '#D7E5CF',
    borderRadius: 250,
    height: 500,
    opacity: 0.18,
    position: 'absolute',
    right: -215,
    top: 430,
    transform: [{ rotate: '10deg' }],
    width: 560,
  },
  backgroundSageVeil: {
    backgroundColor: '#E8F1E0',
    borderRadius: 220,
    height: 420,
    opacity: 0.26,
    position: 'absolute',
    right: -175,
    top: 190,
    transform: [{ rotate: '-12deg' }],
    width: 600,
  },
  backgroundWarmVeil: {
    backgroundColor: '#F4E8D2',
    borderRadius: 260,
    height: 520,
    left: -250,
    opacity: 0.22,
    position: 'absolute',
    top: 660,
    transform: [{ rotate: '-18deg' }],
    width: 520,
  },
  benefitDot: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 4,
    marginTop: 7,
    opacity: 0.52,
    width: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  benefitText: {
    color: theme.colors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  benefitsCard: {
    alignSelf: 'stretch',
    backgroundColor: '#F5F5EA',
    borderColor: '#DCE5D3',
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 5,
      width: 0,
    },
    shadowOpacity: 0.055,
    shadowRadius: 16,
    elevation: 2,
  },
  benefitsHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  benefitsPill: {
    backgroundColor: '#EEF4EA',
    borderColor: '#D5E1CC',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  benefitsPillText: {
    color: theme.colors.greenDark,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 14,
  },
  benefitsTitle: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
  },
  content: {
    flexGrow: 1,
    paddingBottom: 110,
    paddingTop: theme.spacing.xs,
  },
  featureDot: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 4,
    marginTop: 7,
    opacity: 0.34,
    width: 4,
  },
  featureLine: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 12,
  },
  featureText: {
    color: '#787D72',
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  guestActionButton: {
    borderRadius: theme.radius.pill,
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  guestActions: {
    flexDirection: 'row',
  },
  guestCtaSection: {
    marginTop: 14,
  },
  header: {
    gap: 7,
  },
  identityContent: {
    alignItems: 'flex-start',
    flex: 1,
    minWidth: 0,
  },
  identityRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 15,
  },
  profileCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFDFB',
    borderColor: '#E3E5DD',
    borderRadius: 28,
    borderWidth: 1,
    marginTop: 28,
    paddingBottom: 18,
    paddingHorizontal: 26,
    paddingTop: 24,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 22,
      width: 0,
    },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 3,
  },
  progressFill: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: '100%',
  },
  progressTrack: {
    backgroundColor: '#DDE8D5',
    borderRadius: theme.radius.pill,
    height: 6,
    marginTop: 15,
    overflow: 'hidden',
  },
  ratingBody: {
    color: '#74796F',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    maxWidth: 274,
    textAlign: 'center',
  },
  ratingCard: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#FFF8EC',
    borderColor: '#E9DCC8',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 10,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 12,
    elevation: 1,
  },
  ratingCta: {
    backgroundColor: theme.colors.card,
    borderColor: '#E1D7C8',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    marginTop: 7,
    paddingHorizontal: 17,
    paddingVertical: 6,
  },
  ratingCtaText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  ratingTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 21,
    textAlign: 'center',
  },
  remainingPill: {
    backgroundColor: theme.colors.card,
    borderColor: '#DBE1D4',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 5,
  },
  remainingText: {
    color: theme.colors.greenDark,
    fontSize: 12,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 16,
  },
  screen: {
    backgroundColor: '#FBFAF3',
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  signOutButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#FFFBF8',
    borderColor: '#E8CFC8',
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    maxWidth: 278,
    minHeight: 55,
    paddingHorizontal: 28,
    paddingVertical: 14,
    shadowColor: theme.colors.pending,
    shadowOffset: {
      height: 7,
      width: 0,
    },
    shadowOpacity: 0.03,
    shadowRadius: 14,
    width: '72%',
    elevation: 1,
  },
  signOutButtonDisabled: {
    opacity: 0.55,
  },
  signOutButtonPressed: {
    opacity: 0.76,
  },
  signOutButtonText: {
    color: '#8E5D55',
    fontSize: 15,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
    textAlign: 'center',
  },
  signOutErrorCard: {
    alignSelf: 'stretch',
    backgroundColor: theme.colors.softPending,
    borderColor: '#E4C8C1',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    marginTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 10,
  },
  signOutErrorText: {
    color: theme.colors.pending,
    fontSize: 13,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 18,
    textAlign: 'center',
  },
  signOutSection: {
    alignSelf: 'stretch',
    marginTop: 12,
  },
  snapshotCard: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFCF3',
    borderColor: '#E9E0D0',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 9,
    paddingHorizontal: 16,
    paddingVertical: 13,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 6,
      width: 0,
    },
    shadowOpacity: 0.025,
    shadowRadius: 12,
    elevation: 1,
  },
  snapshotGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  snapshotHeader: {
    alignItems: 'flex-start',
  },
  snapshotItem: {
    backgroundColor: '#F7F4EC',
    borderColor: '#E8E2D6',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 9,
  },
  snapshotAccent: {
    borderRadius: theme.radius.pill,
    height: 3,
    marginBottom: 7,
    opacity: 0.72,
    width: 22,
  },
  snapshotAccentKept: {
    backgroundColor: '#9A743D',
  },
  snapshotAccentOpen: {
    backgroundColor: theme.colors.greenDark,
  },
  snapshotAccentReturned: {
    backgroundColor: '#65845D',
  },
  snapshotItemKept: {
    backgroundColor: '#FBF4E8',
    borderColor: '#E9DDC8',
  },
  snapshotItemOpen: {
    backgroundColor: '#F3F6EE',
    borderColor: '#DDE7D6',
  },
  snapshotItemReturned: {
    backgroundColor: '#F4F8F0',
    borderColor: '#DCE8D4',
  },
  snapshotLabel: {
    color: '#74796F',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  snapshotLabelKept: {
    color: '#8A6A3E',
  },
  snapshotLabelOpen: {
    color: theme.colors.greenDark,
  },
  snapshotLabelReturned: {
    color: '#5F7C58',
  },
  snapshotTitle: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
  },
  snapshotTitleBlock: {
    alignItems: 'flex-start',
  },
  snapshotValue: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
  },
  statusBadge: {
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeGuest: {
    backgroundColor: '#F6F1E8',
    borderColor: '#E6DCCB',
  },
  statusBadgeLoading: {
    backgroundColor: '#F5F6F0',
    borderColor: '#E1E5DC',
  },
  statusBadgeSignedIn: {
    backgroundColor: '#EEF4EA',
    borderColor: '#D9E5D3',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 16,
  },
  statusBadgeTextGuest: {
    color: theme.colors.amber,
  },
  statusBadgeTextLoading: {
    color: theme.colors.muted,
  },
  statusBadgeTextSignedIn: {
    color: theme.colors.greenDark,
  },
  statusDot: {
    borderRadius: theme.radius.pill,
    height: 6,
    width: 6,
  },
  statusDotGuest: {
    backgroundColor: theme.colors.amber,
  },
  statusDotLoading: {
    backgroundColor: theme.colors.muted,
    opacity: 0.52,
  },
  statusDotSignedIn: {
    backgroundColor: theme.colors.greenDark,
    opacity: 0.78,
  },
  subtitle: {
    ...theme.typography.screenSubtitle,
    color: '#74796F',
    fontSize: 16,
    lineHeight: 23,
  },
  syncDot: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 6,
    opacity: 0.7,
    width: 6,
  },
  syncRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  syncText: {
    color: '#4D6048',
    flex: 1,
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
  },
  title: {
    ...theme.typography.screenTitle,
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: theme.fontWeight.bold,
    lineHeight: 38,
  },
  usageCard: {
    alignSelf: 'stretch',
    backgroundColor: '#F2F7EE',
    borderColor: '#DCE8D5',
    borderRadius: 22,
    borderWidth: 1,
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 7,
      width: 0,
    },
    shadowOpacity: 0.035,
    shadowRadius: 14,
    elevation: 1,
  },
  usageHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  usageLabel: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
  },
  usageTitle: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 24,
    marginTop: 15,
  },
});
