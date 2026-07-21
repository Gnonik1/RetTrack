import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesPackage,
} from 'react-native-purchases';

import { AppScreen } from '../../../components/AppScreen';
import { AppText } from '../../../components/AppText';
import { ShimmerSweep } from '../../../components/ShimmerSweep';
import { theme } from '../../../constants/theme';
import {
  getProOfferings,
  purchaseProPackage,
  restoreProPurchases,
} from '../services/revenueCatService';
import { usePlan } from '../state/PlanState';

// Mirrors UpgradePill's gold gradient (ProLockedOverlay): a lighter highlight
// over the deeper amber token, so the primary button speaks the same gold
// language as the app's existing Pro CTA.
const GOLD_GRADIENT_TOP = '#DEAC59';

// Legal URLs mirror the canonical copies in SettingsScreen.tsx. Kept in sync by
// hand for now; a future refactor should lift both into one shared module so
// there is a single source of truth.
const PRIVACY_POLICY_URL =
  'https://gnonik1.github.io/rettrack-legal/privacy-policy/';
const TERMS_OF_USE_URL =
  'https://gnonik1.github.io/rettrack-legal/terms-of-use/';

// Product copy (not prices) — safe to author here. Every price and currency on
// this screen comes from the SDK's priceString; nothing money-related is hard
// coded.
const PRO_BENEFITS = [
  'Unlimited purchase tracking',
  'Spending insights and trends',
  'More photos on every item',
  'Export your history to CSV',
] as const;

// Honest outcome messaging. notConfigured is a sign-in prompt, never a payment
// error; payment-pending is Ask to Buy awaiting approval, not a failure.
const SIGN_IN_REQUIRED_MESSAGE =
  'You need to be signed in to upgrade. Please sign in and try again.';
const PAYMENT_PENDING_MESSAGE =
  "This purchase needs approval before it can finish. RetTrack Pro will unlock automatically once it's approved, so there's no need to buy again.";
const RESTORE_NOTHING_FOUND_MESSAGE =
  "We couldn't find a previous purchase to restore on this Apple Account.";
const GENERIC_LOAD_ERROR_MESSAGE =
  "We couldn't load plans right now. Please check your connection and try again.";
const LEGAL_LINK_ERROR_MESSAGE =
  "We couldn't open that page. Please try again in a moment.";

// Auto-renew + management disclosure required by App Store review for auto-
// renewable subscriptions. Shown only when the offering actually contains a
// subscription package.
const AUTO_RENEW_DISCLOSURE =
  'Payment is charged to your Apple Account at confirmation of purchase. ' +
  'Subscriptions renew automatically unless cancelled at least 24 hours before ' +
  'the end of the current period. You can manage or cancel anytime in your App ' +
  'Store settings.';

type OfferingsLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; packages: PurchasesPackage[] }
  | { status: 'error' };

type PaywallNotice = { tone: 'error' | 'info'; text: string };

// Human period name from the package type — derived from packageType, never
// from a hard coded price or currency.
function getPlanPeriodLabel(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.LIFETIME:
      return 'Lifetime';
    case PACKAGE_TYPE.ANNUAL:
      return 'Yearly';
    case PACKAGE_TYPE.SIX_MONTH:
      return 'Every 6 months';
    case PACKAGE_TYPE.THREE_MONTH:
      return 'Every 3 months';
    case PACKAGE_TYPE.TWO_MONTH:
      return 'Every 2 months';
    case PACKAGE_TYPE.MONTHLY:
      return 'Monthly';
    case PACKAGE_TYPE.WEEKLY:
      return 'Weekly';
    default:
      return 'Plan';
  }
}

function getPriceSuffix(pkg: PurchasesPackage): string {
  switch (pkg.packageType) {
    case PACKAGE_TYPE.LIFETIME:
      return 'one-time';
    case PACKAGE_TYPE.ANNUAL:
      return 'per year';
    case PACKAGE_TYPE.SIX_MONTH:
      return 'per 6 months';
    case PACKAGE_TYPE.THREE_MONTH:
      return 'per 3 months';
    case PACKAGE_TYPE.TWO_MONTH:
      return 'per 2 months';
    case PACKAGE_TYPE.MONTHLY:
      return 'per month';
    case PACKAGE_TYPE.WEEKLY:
      return 'per week';
    default:
      return '';
  }
}

// A free trial is an introductory price of exactly zero; its length comes from
// the SDK's periodNumberOfUnits + periodUnit (e.g. 7 + DAY -> "7-day free
// trial"). Returns null when the product has no zero-cost intro offer. Paid
// intro offers (price > 0) are intentionally not surfaced this pass.
function getFreeTrialLabel(pkg: PurchasesPackage): string | null {
  const intro = pkg.product.introPrice;

  if (!intro || intro.price !== 0) {
    return null;
  }

  const unit = intro.periodUnit.toLowerCase();

  return `${intro.periodNumberOfUnits}-${unit} free trial`;
}

function isSubscriptionPackage(pkg: PurchasesPackage): boolean {
  return (
    pkg.packageType !== PACKAGE_TYPE.LIFETIME &&
    pkg.packageType !== PACKAGE_TYPE.CUSTOM &&
    pkg.packageType !== PACKAGE_TYPE.UNKNOWN
  );
}

// Default to the annual plan: it is the conventional best-value default and the
// typical carrier of an intro trial. Fall back to the first package the service
// returned, so the dashboard's own order decides when there is no annual.
function getDefaultSelectedIdentifier(packages: PurchasesPackage[]): string {
  const annual = packages.find(
    (pkg) => pkg.packageType === PACKAGE_TYPE.ANNUAL,
  );

  return (annual ?? packages[0]).identifier;
}

function PlanCard({
  onSelect,
  pkg,
  selected,
}: {
  onSelect: () => void;
  pkg: PurchasesPackage;
  selected: boolean;
}) {
  const trialLabel = getFreeTrialLabel(pkg);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onSelect}
      style={({ pressed }) => [
        styles.planCard,
        selected && styles.planCardSelected,
        pressed && styles.planCardPressed,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.planInfo}>
        <AppText style={styles.planPeriod}>{getPlanPeriodLabel(pkg)}</AppText>
        {trialLabel ? (
          <AppText style={styles.planTrial}>{trialLabel}</AppText>
        ) : null}
      </View>
      <View style={styles.planPricing}>
        {/* priceString is taken verbatim from the SDK — never reformatted. */}
        <AppText style={styles.planPrice}>{pkg.product.priceString}</AppText>
        <AppText style={styles.planPriceSuffix}>{getPriceSuffix(pkg)}</AppText>
      </View>
    </Pressable>
  );
}

function CostSummary({ pkg }: { pkg: PurchasesPackage }) {
  const trialLabel = getFreeTrialLabel(pkg);
  const price = `${pkg.product.priceString} ${getPriceSuffix(pkg)}`.trim();

  return (
    <AppText style={styles.costSummary}>
      {trialLabel ? `${trialLabel}, then ${price}` : price}
    </AppText>
  );
}

// Gold-gradient primary CTA sharing the app's Pro language: the same gradient as
// UpgradePill plus one non-looping ShimmerSweep on focus (no added loop).
function PrimaryGoldButton({
  busy,
  disabled,
  label,
  onPress,
}: {
  busy: boolean;
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const [width, setWidth] = useState(0);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy, disabled }}
      disabled={disabled}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && !disabled && styles.primaryButtonPressed,
        disabled && styles.primaryButtonDisabled,
      ]}
    >
      <LinearGradient
        colors={[GOLD_GRADIENT_TOP, theme.colors.amber]}
        end={{ x: 0, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {width > 0 && !busy ? <ShimmerSweep bandWidth={90} width={width} /> : null}
      <View style={styles.primaryButtonContent}>
        {busy ? <ActivityIndicator color="#FFFDF7" size="small" /> : null}
        <AppText style={styles.primaryButtonLabel} variant="button">
          {busy ? 'Processing...' : label}
        </AppText>
      </View>
    </Pressable>
  );
}

// Calm, static skeleton — mirrors the plan-card layout so the screen does not
// jump when real plans arrive. No spinner, no shimmer, no loop.
function PlansPlaceholder() {
  return (
    <View style={styles.planList}>
      {[0, 1, 2].map((key) => (
        <View key={key} style={styles.skeletonCard}>
          <View style={styles.skeletonRadio} />
          <View style={styles.skeletonInfo}>
            <View style={[styles.skeletonBar, styles.skeletonBarWide]} />
            <View style={[styles.skeletonBar, styles.skeletonBarNarrow]} />
          </View>
          <View style={[styles.skeletonBar, styles.skeletonBarPrice]} />
        </View>
      ))}
    </View>
  );
}

export function PaywallScreen({ onDismiss }: { onDismiss: () => void }) {
  const { refreshPlan } = usePlan();
  const [loadState, setLoadState] = useState<OfferingsLoadState>({
    status: 'loading',
  });
  const [selectedIdentifier, setSelectedIdentifier] = useState<string | null>(
    null,
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [notice, setNotice] = useState<PaywallNotice | null>(null);

  const loadOfferings = useCallback(async () => {
    setNotice(null);
    setLoadState({ status: 'loading' });

    const packages = await getProOfferings();

    // null (not configured / error) and empty both mean "no plans to show". We
    // never fall back to hard coded prices.
    if (!packages || packages.length === 0) {
      setLoadState({ status: 'error' });
      return;
    }

    setSelectedIdentifier(getDefaultSelectedIdentifier(packages));
    setLoadState({ status: 'loaded', packages });
  }, []);

  useEffect(() => {
    void loadOfferings();
  }, [loadOfferings]);

  const selectedPackage = useMemo(() => {
    if (loadState.status !== 'loaded') {
      return null;
    }

    return (
      loadState.packages.find((pkg) => pkg.identifier === selectedIdentifier) ??
      null
    );
  }, [loadState, selectedIdentifier]);

  const hasSubscriptionPlan =
    loadState.status === 'loaded' &&
    loadState.packages.some(isSubscriptionPackage);

  const handleOpenLegalUrl = (url: string) => {
    void Linking.openURL(url).catch(() => {
      setNotice({ tone: 'error', text: LEGAL_LINK_ERROR_MESSAGE });
    });
  };

  const handlePurchase = async () => {
    if (isProcessing || !selectedPackage) {
      return;
    }

    setNotice(null);
    setIsProcessing(true);

    const result = await purchaseProPackage(selectedPackage);

    if (result.status === 'purchased') {
      // PlanProvider owns plan state; refresh it so Pro takes effect without a
      // restart, then leave the screen. isProcessing stays true through unmount.
      await refreshPlan();
      onDismiss();
      return;
    }

    if (result.status === 'notConfigured') {
      setNotice({ tone: 'error', text: SIGN_IN_REQUIRED_MESSAGE });
    } else if (result.status === 'failed') {
      setNotice(
        result.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR
          ? { tone: 'info', text: PAYMENT_PENDING_MESSAGE }
          : { tone: 'error', text: result.message },
      );
    }
    // 'cancelled' is a normal outcome: fall through silently to the idle state.

    setIsProcessing(false);
  };

  const handleRestore = async () => {
    if (isProcessing) {
      return;
    }

    setNotice(null);
    setIsProcessing(true);

    const result = await restoreProPurchases();

    if (result.status === 'restoredPro') {
      await refreshPlan();
      onDismiss();
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
      <View style={styles.header}>
        <AppText variant="title">RetTrack Pro</AppText>
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
          <AppText style={styles.closeGlyph}>{'✕'}</AppText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText style={styles.intro} variant="subtitle">
          Everything you need to track, remember, and understand what you buy.
        </AppText>

        <View style={styles.benefits}>
          {PRO_BENEFITS.map((benefit) => (
            <View key={benefit} style={styles.benefitRow}>
              <View style={styles.benefitCheck}>
                <AppText style={styles.benefitCheckGlyph}>{'✓'}</AppText>
              </View>
              <AppText style={styles.benefitText}>{benefit}</AppText>
            </View>
          ))}
        </View>

        {loadState.status === 'loading' ? <PlansPlaceholder /> : null}

        {loadState.status === 'error' ? (
          <View style={styles.errorCard}>
            <AppText style={styles.errorText}>
              {GENERIC_LOAD_ERROR_MESSAGE}
            </AppText>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadOfferings()}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <AppText style={styles.retryLabel} variant="button">
                Try again
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {loadState.status === 'loaded' ? (
          <View style={styles.planList}>
            {loadState.packages.map((pkg) => (
              <PlanCard
                key={pkg.identifier}
                onSelect={() => setSelectedIdentifier(pkg.identifier)}
                pkg={pkg}
                selected={pkg.identifier === selectedIdentifier}
              />
            ))}
          </View>
        ) : null}

        {selectedPackage ? (
          <View style={styles.purchaseArea}>
            <CostSummary pkg={selectedPackage} />
            <PrimaryGoldButton
              busy={isProcessing}
              disabled={isProcessing}
              label={
                getFreeTrialLabel(selectedPackage) ? 'Start free trial' : 'Continue'
              }
              onPress={() => void handlePurchase()}
            />
          </View>
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

        {hasSubscriptionPlan ? (
          <AppText style={styles.disclosure}>{AUTO_RENEW_DISCLOSURE}</AppText>
        ) : null}

        <View style={styles.legalRow}>
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => handleOpenLegalUrl(TERMS_OF_USE_URL)}
          >
            <AppText style={styles.legalLink}>Terms of Use</AppText>
          </Pressable>
          <View style={styles.legalDot} />
          <Pressable
            accessibilityRole="link"
            hitSlop={8}
            onPress={() => handleOpenLegalUrl(PRIVACY_POLICY_URL)}
          >
            <AppText style={styles.legalLink}>Privacy Policy</AppText>
          </Pressable>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  closeGlyph: {
    color: theme.colors.muted,
    fontSize: 15,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  intro: {
    marginBottom: theme.spacing.lg,
  },
  benefits: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  benefitRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  benefitCheck: {
    alignItems: 'center',
    // Warm cream-gold tint behind the gold check, matching the Pro accent.
    backgroundColor: '#FBF3E2',
    borderRadius: theme.radius.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  benefitCheckGlyph: {
    color: theme.colors.amber,
    fontSize: 12,
    fontWeight: theme.fontWeight.bold,
  },
  benefitText: {
    color: theme.colors.text,
    flex: 1,
  },
  planList: {
    gap: theme.spacing.sm,
  },
  planCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  planCardSelected: {
    // Barely-there gold tint plus the amber border so the choice reads warm.
    backgroundColor: '#FFFCF4',
    borderColor: theme.colors.amber,
    borderWidth: 2,
    // Pull padding in by 1 so the thicker border does not shift the layout.
    paddingHorizontal: theme.spacing.md - 1,
    paddingVertical: theme.spacing.md - 1,
  },
  planCardPressed: {
    opacity: 0.9,
  },
  radio: {
    alignItems: 'center',
    borderColor: theme.colors.border,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  radioSelected: {
    borderColor: theme.colors.amber,
  },
  radioDot: {
    backgroundColor: theme.colors.amber,
    borderRadius: theme.radius.pill,
    height: 10,
    width: 10,
  },
  planInfo: {
    flex: 1,
    gap: 2,
  },
  planPeriod: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  planTrial: {
    color: theme.colors.green,
    fontSize: theme.fontSize.xs,
    fontWeight: theme.fontWeight.semibold,
  },
  planPricing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  planPrice: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: theme.fontWeight.semibold,
  },
  planPriceSuffix: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.xs,
  },
  purchaseArea: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  costSummary: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },
  primaryButton: {
    alignItems: 'center',
    borderRadius: theme.radius.lg,
    justifyContent: 'center',
    minHeight: 54,
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.lg,
  },
  primaryButtonPressed: {
    opacity: 0.9,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  primaryButtonLabel: {
    color: '#FFFDF7',
    letterSpacing: 0.3,
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
  disclosure: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  legalRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: theme.spacing.sm,
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  legalLink: {
    color: theme.colors.green,
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.semibold,
  },
  legalDot: {
    backgroundColor: theme.colors.muted,
    borderRadius: theme.radius.pill,
    height: 3,
    width: 3,
  },
  errorCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.paper,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xl,
  },
  errorText: {
    color: theme.colors.muted,
    fontSize: theme.fontSize.sm,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryLabel: {
    color: theme.colors.greenDark,
  },
  skeletonCard: {
    alignItems: 'center',
    backgroundColor: theme.colors.paper,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  skeletonRadio: {
    backgroundColor: theme.colors.sage,
    borderRadius: theme.radius.pill,
    height: 22,
    width: 22,
  },
  skeletonInfo: {
    flex: 1,
    gap: theme.spacing.sm,
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
  skeletonBarPrice: {
    width: 56,
  },
});
