import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { CheckIcon, CrossIcon } from '../../../components/MarkIcons';
import { ProSparkleIcon } from '../../../components/ProBadge';
import { theme } from '../../../constants/theme';
import { PRO_BENEFITS } from '../constants';
import {
  getActiveProPlan,
  presentManageSubscriptions,
  restoreProPurchases,
  type ActiveProPlan,
} from '../services/revenueCatService';
import { usePlan } from '../state/PlanState';

// Apple's account-level subscriptions page. Used only as a fallback when the
// native manage sheet cannot be presented (showManageSubscriptions unavailable
// or failed) — see handleManageSubscription.
const APPLE_MANAGE_SUBSCRIPTIONS_URL =
  'https://apps.apple.com/account/subscriptions';

// Restore copy mirrors PaywallScreen's so the two flows read the same. Kept local
// (PaywallScreen's copies are not exported); a future refactor could share them.
const SIGN_IN_REQUIRED_MESSAGE =
  'You need to be signed in to restore. Please sign in and try again.';
const RESTORE_NOTHING_FOUND_MESSAGE =
  "We couldn't find a previous purchase to restore on this Apple Account.";

type ManageProLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; plan: ActiveProPlan }
  | { status: 'unavailable' };

type ManageProNotice = { tone: 'error' | 'info'; text: string };

// Lifetime never renews and has no expiration — it is the only non-subscription
// kind, so it alone hides the renewal line and the manage/cancel affordance.
function isLifetimePlan(plan: ActiveProPlan): boolean {
  return plan.planKind === 'lifetime';
}

// Human plan name from the normalized kind. 'unknown' is a real subscription of
// indeterminate period (it always carries an expiration), so it reads as the
// generic product rather than inventing a cadence.
function getPlanName(plan: ActiveProPlan): string {
  switch (plan.planKind) {
    case 'monthly':
      return 'Monthly';
    case 'annual':
      return 'Yearly';
    case 'lifetime':
      return 'Lifetime';
    default:
      return 'RetTrack Pro';
  }
}

// The plan detail line. Lifetime states permanence; a subscription states its
// next renewal (willRenew) or the date access ends (cancelled but still active).
// Dates use the device locale via toLocaleDateString — no hardcoded format.
function getPlanDetailLine(plan: ActiveProPlan): string | null {
  if (isLifetimePlan(plan)) {
    return 'Lifetime access';
  }

  if (!plan.expirationDate) {
    return null;
  }

  const formattedDate = plan.expirationDate.toLocaleDateString();

  return plan.willRenew
    ? `Renews on ${formattedDate}`
    : `Access until ${formattedDate}`;
}

// Calm, static placeholder for the plan card while getActiveProPlan resolves.
// Mirrors the card's box so the screen does not jump. No spinner, no motion.
function PlanCardPlaceholder() {
  return (
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonBar, styles.skeletonBarWide]} />
      <View style={[styles.skeletonBar, styles.skeletonBarNarrow]} />
    </View>
  );
}

export function ManageProScreen({ onDismiss }: { onDismiss: () => void }) {
  const { refreshPlan } = usePlan();
  const [loadState, setLoadState] = useState<ManageProLoadState>({
    status: 'loading',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<ManageProNotice | null>(null);

  const loadPlan = useCallback(async () => {
    // getActiveProPlan never throws; null means we could not read a plan (still a
    // Pro user reaching this screen), so we fall back to the status + benefits view.
    const plan = await getActiveProPlan();
    setLoadState(plan ? { status: 'loaded', plan } : { status: 'unavailable' });
  }, []);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  const activePlan = loadState.status === 'loaded' ? loadState.plan : null;
  const planDetailLine = activePlan ? getPlanDetailLine(activePlan) : null;
  // Manage/cancel is a subscription-only affordance. Lifetime does not renew, so
  // it is omitted entirely.
  const canManageSubscription = activePlan !== null && !isLifetimePlan(activePlan);

  const handleManageSubscription = async () => {
    // Apple's supported path: present the native sheet; only if that cannot be
    // shown do we deep link to the account-subscriptions page.
    const shown = await presentManageSubscriptions();

    if (!shown) {
      void Linking.openURL(APPLE_MANAGE_SUBSCRIPTIONS_URL).catch(() => undefined);
    }
  };

  const handleRestore = async () => {
    if (isProcessing) {
      return;
    }

    setNotice(null);
    setIsProcessing(true);

    const result = await restoreProPurchases();

    // Same branching as PaywallScreen. The one difference: on success we stay and
    // reload the plan summary (the paywall dismisses, because its job is done —
    // here the screen's job is to show current status), so the card reflects it.
    if (result.status === 'restoredPro') {
      await refreshPlan();
      await loadPlan();
      setIsProcessing(false);
      return;
    }

    if (result.status === 'noEntitlement') {
      setNotice({ tone: 'info', text: RESTORE_NOTHING_FOUND_MESSAGE });
    } else if (result.status === 'notConfigured') {
      setNotice({ tone: 'error', text: SIGN_IN_REQUIRED_MESSAGE });
    } else {
      setNotice({ tone: 'error', text: result.message });
    }

    setIsProcessing(false);
  };

  return (
    <AppScreen>
      {/* Dark-green Pro hero: the same proUsageCard/attentionCard gradient and
          amber top hairline the paywall hero uses, carrying a calm status title
          and the on-dark close control. Reused, not reinvented. */}
      <LinearGradient
        colors={['#2F442F', '#415C3D', '#314832']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          {/* The gold Pro sparkle above the title — the app's single Pro mark
              (ProBadge), drawn in theme.colors.amber (#C7923E), the gold accent
              that also draws the amber hairline. An accent emblem, so gold stays
              reserved for accents; the hero gains a premium cue without growing. */}
          <View style={styles.heroTitleBlock}>
            <ProSparkleIcon />
            <AppText style={styles.heroTitle} variant="title">
              You're on Pro
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Close"
            accessibilityRole="button"
            hitSlop={12}
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <CrossIcon color="#FFFDF7" size={14} />
          </Pressable>
        </View>
        <AppText style={styles.heroSubtitle} variant="subtitle">
          Thanks for supporting RetTrack. Here's everything your membership
          includes.
        </AppText>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loadState.status === 'loading' ? <PlanCardPlaceholder /> : null}

        {activePlan ? (
          <View style={styles.planCard}>
            <AppText style={styles.planName}>{getPlanName(activePlan)}</AppText>
            {planDetailLine ? (
              <AppText style={styles.planDetail}>{planDetailLine}</AppText>
            ) : null}
          </View>
        ) : null}

        <View style={styles.benefits}>
          {PRO_BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={styles.benefitCheck}>
                <CheckIcon color={theme.colors.amber} size={10} />
              </View>
              <AppText style={styles.benefitText}>{benefit}</AppText>
            </View>
          ))}
        </View>

        {/* Flexible spacer: with the ScrollView contentContainer set to
            flexGrow 1, this expands to fill leftover height on short content,
            sinking the actions group into the lower third so the empty space
            above reads as intentional breathing room, not abandonment. On tall
            content it collapses and the actions scroll normally. */}
        <View style={styles.actionsSpacer} />

        <View style={styles.actionsGroup}>
          {canManageSubscription ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void handleManageSubscription()}
              style={({ pressed }) => [
                styles.manageButton,
                pressed && styles.manageButtonPressed,
              ]}
            >
              <AppText style={styles.manageLabel} variant="button">
                Manage subscription
              </AppText>
            </Pressable>
          ) : null}

          {notice ? (
            <AppText
              style={[
                styles.notice,
                notice.tone === 'error' ? styles.noticeError : styles.noticeInfo,
              ]}
            >
              {notice.text}
            </AppText>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isProcessing}
            onPress={() => void handleRestore()}
            style={styles.restoreButton}
          >
            <AppText
              style={[
                styles.restoreLabel,
                isProcessing && styles.restoreLabelDisabled,
              ]}
            >
              Restore Purchases
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  // Hero surface: PaywallScreen's hero values verbatim — dark-green gradient
  // (set on the LinearGradient), card radius, amber top hairline, shadowless.
  hero: {
    borderRadius: theme.radius.lg,
    borderTopColor: theme.colors.amber,
    borderTopWidth: 2,
    // xl (was lg): one token step more air between the dark hero and the plan
    // card, so the top of the screen breathes instead of bunching.
    marginBottom: theme.spacing.xl,
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  heroTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  // Column that stacks the gold sparkle above the title, left-aligned, so the
  // close control stays pinned top-right (heroTopRow's space-between). xs gap
  // keeps the emblem tight to the title without enlarging the hero.
  heroTitleBlock: {
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  // proUsageTitle/attentionCount's on-dark cream, verbatim.
  heroTitle: {
    color: '#FFFDF7',
  },
  // proUsageCount's softer on-dark tone: sage at 0.78.
  heroSubtitle: {
    color: theme.colors.sage,
    marginTop: theme.spacing.xs,
    opacity: 0.78,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  scrollContent: {
    // flexGrow lets the contentContainer fill the viewport height so the
    // actionsSpacer can expand and sink the actions to the lower third when the
    // content is short; content taller than the screen still scrolls.
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  // Premium status card in the Pro family's cream/gold surface — the #FFF6E5
  // fill + #D6C28F gold hairline shared by proIdentityPill/statusBadge and the
  // paywall's selected plan card — so it reads as a warm reward, not a plain
  // white box. (proUsageCard, the OTHER Pro surface, is dark-green: gradient
  // #2F442F→#314832 with a rgba(255,255,255,0.14) border. A second dark slab
  // under the dark hero would double the dark mass, so this takes the Pro
  // family's light-surface counterpart. No new hex.)
  planCard: {
    backgroundColor: '#FFF6E5',
    borderColor: '#D6C28F',
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.xs,
    // xxl (was xl): one token step more air down to the benefits list.
    marginBottom: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  planName: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  planDetail: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
  },
  // Calm static skeleton for the plan card, matching its box. No motion.
  skeletonCard: {
    backgroundColor: theme.colors.paper,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  skeletonBar: {
    backgroundColor: theme.colors.sage,
    borderRadius: 6,
    height: 12,
  },
  skeletonBarWide: {
    width: '55%',
  },
  skeletonBarNarrow: {
    width: '35%',
  },
  // Benefits list: PaywallScreen's benefit styles verbatim, so the check
  // treatment (cream/gold emblem + amber glyph) reads identically on both screens.
  benefits: {
    // md (was sm): more line spacing so the list fills the middle comfortably.
    gap: theme.spacing.md,
    // 0 (was xl): the gap below the benefits is now owned by the flexible
    // actionsSpacer + the actions group's top margin, which sink the actions to
    // the lower third rather than a fixed margin pinning them mid-page.
    marginBottom: 0,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  benefitCheck: {
    alignItems: 'center',
    backgroundColor: '#FFF6E5',
    borderColor: '#D6C28F',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
  benefitText: {
    color: theme.colors.text,
    flex: 1,
  },
  // Bottom anchor: with scrollContent flexGrow 1, this grows to absorb leftover
  // height, pushing the actions group down; on tall content it collapses to 0.
  actionsSpacer: {
    flex: 1,
  },
  // The two bottom actions kept together with a generous top margin, so they
  // settle low as a deliberate footer rather than floating mid-page. This margin
  // is the single gap above them (the benefits list drops its bottom margin).
  actionsGroup: {
    marginTop: theme.spacing.xl,
  },
  // Calm but solid secondary button: the sage green-tinted fill kept, its pale
  // border swapped for a defined green edge (theme.colors.green) so it reads
  // clearly tappable and intentional — quiet, never primary (the paywall's gold
  // CTA is that) and never alarming. greenDark label; established tokens only.
  manageButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.green,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingVertical: theme.spacing.md,
  },
  manageButtonPressed: {
    opacity: 0.8,
  },
  manageLabel: {
    color: theme.colors.greenDark,
  },
  notice: {
    fontSize: theme.fontSize.sm,
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  noticeError: {
    color: theme.colors.pending,
  },
  noticeInfo: {
    color: theme.colors.green,
  },
  // Restore: tertiary text action, PaywallScreen's restore styling verbatim.
  restoreButton: {
    alignItems: 'center',
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  restoreLabel: {
    color: theme.colors.green,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  restoreLabelDisabled: {
    opacity: 0.5,
  },
});
