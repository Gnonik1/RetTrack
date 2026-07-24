import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { AppButton } from "../../../components/AppButton";
import { AppScreen } from "../../../components/AppScreen";
import { AppText } from "../../../components/AppText";
import { ProSparkleIcon } from "../../../components/ProBadge";
import {
  lockedPreviewBar,
  lockedPreviewBarSlot,
  ProLockedOverlay,
} from "../../../components/ProLockedOverlay";
import { theme } from "../../../constants/theme";
import { signOut } from "../../../services/authService";
import { useAuth } from "../../../state/AuthState";
import {
  getPlanAccessSubject,
  getProFeatureAccess,
} from "../../monetization/access/planAccess";
import { usePlan } from "../../monetization/state/PlanState";
import { useProFeatureGate } from "../../monetization/state/useProFeatureGate";
import { usePurchases } from "../../purchases/state/PurchasesState";
import { exportPurchasesCsv } from "../../purchases/utils/purchaseCsvExport";
import {
  formatMoneyBucket,
  getPurchaseValueTotals,
  type CurrencyTotals,
} from "../../purchases/utils/purchaseValue";

const APP_STORE_REVIEW_URL =
  "https://apps.apple.com/app/id6775811683?action=write-review";

type ProfileScreenProps = {
  onSignIn?: () => void;
  onSignUp?: () => void;
};

type SnapshotCounts = {
  activeOpen: number;
  kept: number;
  returned: number;
};

type SpendingInsights = {
  activeTotals: CurrencyTotals;
  hasData: boolean;
  isMultiCurrency: boolean;
  keptTotals: CurrencyTotals;
  returnRatePercent: number | null;
  returnedTotals: CurrencyTotals;
};

function getAccountInitial(fullName?: string | null, email?: string) {
  const trimmedFullName = fullName?.trim();
  const trimmedEmail = email?.trim();

  if (trimmedFullName) {
    return trimmedFullName.charAt(0).toUpperCase();
  }

  return trimmedEmail ? trimmedEmail.charAt(0).toUpperCase() : "A";
}

function getUserAvatarUrl(
  metadata?: Record<string, unknown> | null,
): string | undefined {
  const avatarUrl = metadata?.avatar_url;
  const picture = metadata?.picture;

  if (typeof avatarUrl === "string" && avatarUrl.trim()) {
    return avatarUrl.trim();
  }

  if (typeof picture === "string" && picture.trim()) {
    return picture.trim();
  }

  return undefined;
}

function getProgressStyle(percent: number) {
  return {
    width: `${percent}%` as `${number}%`,
  };
}

const SHIMMER_BAND_WIDTH = 90;

function ProHairlineShimmer({ cardWidth }: { cardWidth: number }) {
  const shimmerProgress = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      if (cardWidth <= 0) {
        return;
      }

      shimmerProgress.setValue(0);

      const shimmerAnimation = Animated.timing(shimmerProgress, {
        duration: 900,
        toValue: 1,
        useNativeDriver: true,
      });

      shimmerAnimation.start();

      return () => {
        shimmerAnimation.stop();
      };
    }, [cardWidth, shimmerProgress]),
  );

  const shimmerTranslateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-SHIMMER_BAND_WIDTH, cardWidth],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.proUsageShimmerWrap,
        { transform: [{ translateX: shimmerTranslateX }] },
      ]}
    >
      <LinearGradient
        colors={[
          "rgba(255, 255, 255, 0)",
          "rgba(255, 255, 255, 0.95)",
          "rgba(255, 255, 255, 0.95)",
          "rgba(255, 255, 255, 0)",
        ]}
        end={{ x: 1, y: 0 }}
        locations={[0, 0.4, 0.6, 1]}
        start={{ x: 0, y: 0 }}
        style={styles.proUsageShimmerGradient}
      />
    </Animated.View>
  );
}

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "guest" | "loading" | "signedIn";
}) {
  return (
    <View
      style={[
        styles.statusBadge,
        tone === "signedIn" && styles.statusBadgeSignedIn,
        tone === "guest" && styles.statusBadgeGuest,
        tone === "loading" && styles.statusBadgeLoading,
      ]}
    >
      <View
        style={[
          styles.statusDot,
          tone === "signedIn" && styles.statusDotSignedIn,
          tone === "guest" && styles.statusDotGuest,
          tone === "loading" && styles.statusDotLoading,
        ]}
      />
      <AppText
        style={[
          styles.statusBadgeText,
          tone === "signedIn" && styles.statusBadgeTextSignedIn,
          tone === "guest" && styles.statusBadgeTextGuest,
          tone === "loading" && styles.statusBadgeTextLoading,
        ]}
        variant="caption"
      >
        {label}
      </AppText>
    </View>
  );
}

function showReviewUnavailableAlert() {
  Alert.alert(
    "Review unavailable",
    "RetTrack is not available on the App Store yet. Please try again after release.",
  );
}

async function openRetTrackReview() {
  try {
    const canOpenReviewUrl = await Linking.canOpenURL(APP_STORE_REVIEW_URL);

    if (!canOpenReviewUrl) {
      showReviewUnavailableAlert();
      return;
    }

    await Linking.openURL(APP_STORE_REVIEW_URL);
  } catch {
    showReviewUnavailableAlert();
  }
}

function RateRetTrackCard() {
  return (
    <Pressable
      accessibilityLabel="Rate RetTrack on the App Store"
      accessibilityRole="button"
      onPress={() => {
        void openRetTrackReview();
      }}
      style={({ pressed }) => [
        styles.ratingCard,
        pressed && styles.ratingCardPressed,
      ]}
    >
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
    </Pressable>
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
          <View
            style={[styles.snapshotAccent, styles.snapshotAccentReturned]}
          />
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

function SpendingInsightsCard({ insights }: { insights: SpendingInsights }) {
  const returnRateLabel =
    insights.returnRatePercent === null
      ? "—"
      : `${insights.returnRatePercent}%`;

  return (
    <View style={[styles.snapshotCard, styles.insightsHairline]}>
      <View style={styles.snapshotHeader}>
        <View style={styles.snapshotTitleBlock}>
          <AppText style={styles.snapshotTitle} variant="caption">
            Spending insights
          </AppText>
        </View>
      </View>

      <View style={styles.snapshotGrid}>
        <View style={[styles.snapshotItem, styles.snapshotItemReturned]}>
          <View
            style={[styles.snapshotAccent, styles.snapshotAccentReturned]}
          />
          <AppText
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.snapshotValue, styles.insightsValue]}
            variant="body"
          >
            {formatMoneyBucket(
              insights.returnedTotals,
              insights.isMultiCurrency,
            )}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelReturned]}
            variant="caption"
          >
            Returned value
          </AppText>
        </View>
        <View style={[styles.snapshotItem, styles.snapshotItemOpen]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentOpen]} />
          <AppText
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.snapshotValue, styles.insightsValue]}
            variant="body"
          >
            {formatMoneyBucket(insights.activeTotals, insights.isMultiCurrency)}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelOpen]}
            variant="caption"
          >
            Open value
          </AppText>
        </View>
      </View>

      <View style={styles.snapshotGrid}>
        <View style={[styles.snapshotItem, styles.snapshotItemKept]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentKept]} />
          <AppText
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.snapshotValue, styles.insightsValue]}
            variant="body"
          >
            {formatMoneyBucket(insights.keptTotals, insights.isMultiCurrency)}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelKept]}
            variant="caption"
          >
            Kept value
          </AppText>
        </View>
        <View style={styles.snapshotItem}>
          <View style={[styles.snapshotAccent, styles.insightsAccentRate]} />
          <AppText
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[styles.snapshotValue, styles.insightsValue]}
            variant="body"
          >
            {returnRateLabel}
          </AppText>
          <AppText
            style={[styles.snapshotLabel, styles.insightsLabelRate]}
            variant="caption"
          >
            Return rate
          </AppText>
        </View>
      </View>
    </View>
  );
}

// Free/Guest teaser shell for Spending insights. Intentionally propless: it
// reproduces the real card's header, hairline, and tile layout but renders a locked
// skeleton bar in every value slot instead of an amount — so no spending figure
// (real OR fake) is ever constructed in the non-Pro render path, and nothing can be
// mistaken for the user's own data. The real SpendingInsightsCard (which formats
// actual totals) stays Pro-gated and untouched; this shell shares only the static
// styles and labels, never the data.
function LockedSpendingInsightsCard() {
  return (
    <View
      style={[
        styles.snapshotCard,
        styles.insightsHairline,
        styles.lockedInsightsCard,
      ]}
    >
      <View style={styles.snapshotHeader}>
        <View style={styles.snapshotTitleBlock}>
          <AppText style={styles.snapshotTitle} variant="caption">
            Spending insights
          </AppText>
        </View>
      </View>

      <View style={styles.snapshotGrid}>
        <View style={[styles.snapshotItem, styles.snapshotItemReturned]}>
          <View
            style={[styles.snapshotAccent, styles.snapshotAccentReturned]}
          />
          <View style={lockedPreviewBarSlot}>
            <View style={[lockedPreviewBar, { width: "52%" }]} />
          </View>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelReturned]}
            variant="caption"
          >
            Returned value
          </AppText>
        </View>
        <View style={[styles.snapshotItem, styles.snapshotItemOpen]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentOpen]} />
          <View style={lockedPreviewBarSlot}>
            <View style={[lockedPreviewBar, { width: "70%" }]} />
          </View>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelOpen]}
            variant="caption"
          >
            Open value
          </AppText>
        </View>
      </View>

      <View style={styles.snapshotGrid}>
        <View style={[styles.snapshotItem, styles.snapshotItemKept]}>
          <View style={[styles.snapshotAccent, styles.snapshotAccentKept]} />
          <View style={lockedPreviewBarSlot}>
            <View style={[lockedPreviewBar, { width: "52%" }]} />
          </View>
          <AppText
            style={[styles.snapshotLabel, styles.snapshotLabelKept]}
            variant="caption"
          >
            Kept value
          </AppText>
        </View>
        <View style={styles.snapshotItem}>
          <View style={[styles.snapshotAccent, styles.insightsAccentRate]} />
          <View style={lockedPreviewBarSlot}>
            <View style={[lockedPreviewBar, { width: "42%" }]} />
          </View>
          <AppText
            style={[styles.snapshotLabel, styles.insightsLabelRate]}
            variant="caption"
          >
            Return rate
          </AppText>
        </View>
      </View>
    </View>
  );
}

// Minimal amber lock mark for the CSV export row's trailing slot when the feature
// is locked (Free/Guest). ProLockedOverlay's LockGlyph is NOT exported, so this is
// a small local shape in the same visual language (amber, understated) rather than
// reaching into that module. Pro users keep the chevron (csvExportChevron).
function CsvExportLockGlyph() {
  return (
    <Svg
      accessibilityElementsHidden
      focusable={false}
      height={14}
      viewBox="0 0 16 16"
      width={14}
    >
      <Path
        d="M5.2 7 V5.5 A2.8 2.8 0 0 1 10.8 5.5 V7"
        fill="none"
        stroke={theme.colors.amber}
        strokeLinecap="round"
        strokeWidth={1.7}
      />
      <Path
        d="M5.3 7 H10.7 A1.3 1.3 0 0 1 12 8.3 V11.7 A1.3 1.3 0 0 1 10.7 13 H5.3 A1.3 1.3 0 0 1 4 11.7 V8.3 A1.3 1.3 0 0 1 5.3 7 Z"
        fill={theme.colors.amber}
      />
    </Svg>
  );
}

// The `locked` (Free/Guest) row keeps the title + subtitle fully crisp — they are
// the upsell copy, never dimmed or scrimmed — and only swaps the trailing chevron
// for the amber lock. It is never given csvExportCardDisabled: the row must read as
// tappable (its tap routes to sign-in/paywall through the plan-access model). The
// unlocked (Pro) row is byte-identical to before: chevron + the real export handler.
function CsvExportCard({
  disabled,
  locked,
  onPress,
}: {
  disabled: boolean;
  locked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel="Export CSV"
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.csvExportCard,
        styles.insightsHairline,
        locked && styles.csvExportCardLocked,
        pressed && !disabled && styles.csvExportCardPressed,
        disabled && styles.csvExportCardDisabled,
      ]}
    >
      <View style={styles.csvExportCopy}>
        <AppText style={styles.csvExportTitle} variant="body">
          Export CSV
        </AppText>
        <AppText
          numberOfLines={1}
          style={
            locked
              ? [styles.csvExportBody, styles.csvExportBodyLocked]
              : styles.csvExportBody
          }
          variant="caption"
        >
          Download purchases as a spreadsheet
        </AppText>
      </View>

      {locked ? (
        <CsvExportLockGlyph />
      ) : (
        <View style={styles.csvExportChevron} />
      )}
    </Pressable>
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
    effectiveGuestRemaining,
    guestPurchaseEntriesUsed,
    hasHydratedPurchases,
    purchases,
  } = usePurchases();
  const { isPro, limits } = usePlan();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const [hasAvatarLoadError, setHasAvatarLoadError] = useState(false);
  const [proUsageCardWidth, setProUsageCardWidth] = useState(0);
  const handleProFeaturePress = useProFeatureGate({ signInSource: "profile" });
  const userEmail = user?.email;
  const googleAvatarUrl = getUserAvatarUrl(user?.user_metadata);
  const shouldShowAvatarImage =
    isAuthenticated && Boolean(googleAvatarUrl) && !hasAvatarLoadError;
  const accountDisplayName = profileFullName ?? userEmail ?? "Signed in";
  const guestRemainingItems = effectiveGuestRemaining;
  const guestPurchaseLimit = limits.guestPurchases;
  const signedInPurchaseLimit = limits.signedInFreePurchases;
  const usagePercent = Math.min(
    100,
    Math.round((guestPurchaseEntriesUsed / guestPurchaseLimit) * 100),
  );
  const isAccountLoading =
    isAuthLoading ||
    (isAuthenticated && (isProfileLoading || !hasHydratedPurchases));
  const accountRemainingItems = Math.max(
    signedInPurchaseLimit - accountPurchaseEntriesUsed,
    0,
  );
  const accountUsagePercent = Math.min(
    100,
    Math.round((accountPurchaseEntriesUsed / signedInPurchaseLimit) * 100),
  );
  const proSavedPurchaseCountLabel =
    accountPurchaseEntriesUsed === 1
      ? "1 saved purchase"
      : `${accountPurchaseEntriesUsed} saved purchases`;
  const snapshot = useMemo(
    () =>
      purchases.reduce<SnapshotCounts>(
        (counts, purchase) => {
          if (purchase.status === "returned") {
            return {
              ...counts,
              returned: counts.returned + 1,
            };
          }

          if (purchase.status === "kept") {
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
  const spendingInsights = useMemo<SpendingInsights>(() => {
    // Free/Guest never see real amounts — the teaser renders dummy bars — and
    // nothing downstream reads these totals unless isPro. Short-circuit so no
    // purchase price is even parsed or summed for non-Pro users. For Pro this
    // guard is skipped and the computation below is byte-identical to before.
    if (!isPro) {
      return {
        activeTotals: {},
        hasData: false,
        isMultiCurrency: false,
        keptTotals: {},
        returnRatePercent: null,
        returnedTotals: {},
      };
    }

    // The bucket loop itself now lives in purchases/utils/purchaseValue so History's
    // ungated hero reads the same numbers. It is ungated by design; this card keeps
    // its own isPro guard above, so Free/Guest still reach the teaser, never this.
    const {
      activeTotals,
      isMultiCurrency,
      keptCount,
      keptTotals,
      openCount,
      returnedCount,
      returnedTotals,
    } = getPurchaseValueTotals(purchases);
    const resolvedCount = returnedCount + keptCount;

    return {
      activeTotals,
      hasData: returnedCount + keptCount + openCount > 0,
      isMultiCurrency,
      keptTotals,
      returnRatePercent:
        resolvedCount === 0
          ? null
          : Math.round((returnedCount / resolvedCount) * 100),
      returnedTotals,
    };
  }, [isPro, purchases]);
  const shouldShowSpendingInsights =
    !isAccountLoading &&
    isAuthenticated &&
    isPro &&
    hasHydratedPurchases &&
    spendingInsights.hasData;
  // Both non-Pro states (guest and signed-in-free) get the same locked teaser —
  // showing dummy shapes needs no purchase data, so it is not gated on hydration
  // or hasData, only on a resolved, non-Pro account.
  const shouldShowSpendingInsightsTeaser = !isAccountLoading && !isPro;
  // CSV export renders for everyone once the account resolves. Non-Pro users
  // (guest + signed-in Free) get the locked row (CsvExportCard `locked`); Pro users
  // get the live export. Guest-inclusive and !isPro-aware, mirroring
  // shouldShowSpendingInsightsTeaser, so the upsell is visible instead of hidden.
  const shouldShowCsvExport = !isAccountLoading;
  const statusBadgeLabel = isAccountLoading
    ? "Checking"
    : isAuthenticated
      ? "Signed in"
      : "Guest mode";
  const statusBadgeTone: "guest" | "loading" | "signedIn" = isAccountLoading
    ? "loading"
    : isAuthenticated
      ? "signedIn"
      : "guest";
  const accountName = isAccountLoading
    ? "Checking account"
    : isAuthenticated
      ? accountDisplayName
      : "Guest User";
  const accountMeta = isAccountLoading
    ? "Loading your RetTrack account."
    : isAuthenticated
      ? userEmail
      : undefined;
  const avatarLabel = isAuthenticated
    ? getAccountInitial(profileFullName, userEmail)
    : "G";

  useEffect(() => {
    setHasAvatarLoadError(false);
  }, [googleAvatarUrl]);

  const handleSignOutPress = async () => {
    if (isSigningOut) {
      return;
    }

    setSignOutError("");
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

  const handleCsvExportPress = async () => {
    if (isExportingCsv) {
      return;
    }

    const subject = getPlanAccessSubject({
      isAuthenticated,
      isPro,
    });
    const access = getProFeatureAccess({
      feature: "csvExport",
      subject,
    });

    if (!access.allowed) {
      // Non-Pro taps route through the shared plan-access gate instead of exporting
      // (guest → sign-in, signed-in Free → paywall). Same split as the Spending
      // insights teaser; the routing lives once, in handleProFeaturePress.
      handleProFeaturePress("csvExport");

      return;
    }

    setIsExportingCsv(true);

    try {
      const result = await exportPurchasesCsv(purchases);

      if (result.ok) {
        return;
      }

      if (result.reason === "empty") {
        Alert.alert(
          "Nothing to export",
          "Add a purchase before exporting your CSV",
        );
        return;
      }

      if (result.reason === "sharingUnavailable") {
        Alert.alert(
          "Sharing unavailable",
          "CSV export is ready, but sharing is not available on this device",
        );
        return;
      }

      Alert.alert(
        "Export failed",
        "Something went wrong while creating your CSV",
      );
    } finally {
      setIsExportingCsv(false);
    }
  };

  return (
    <AppScreen stableTopInset style={styles.screen}>
      <LinearGradient
        colors={["#FBFAF3", "#F4F7EF", "#FFF8EC"]}
        end={{ x: 1, y: 1 }}
        pointerEvents="none"
        start={{ x: 0, y: 0 }}
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

        <View
          style={[
            styles.profileCard,
            isAccountLoading && styles.profileCardLoading,
          ]}
        >
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
              <StatusBadge label={statusBadgeLabel} tone={statusBadgeTone} />
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
                ? "Preparing your account details"
                : isAuthenticated
                  ? "Purchases sync across devices"
                  : "Saved only on this device"}
            </AppText>
          </View>

          {!isAccountLoading && isAuthenticated ? (
            isPro ? (
              <View style={styles.proUsageCardWrapper}>
                <LinearGradient
                  colors={["#2F442F", "#415C3D", "#314832"]}
                  end={{ x: 1, y: 1 }}
                  onLayout={(event) => {
                    setProUsageCardWidth(event.nativeEvent.layout.width);
                  }}
                  start={{ x: 0, y: 0 }}
                  style={[styles.usageCard, styles.proUsageCard]}
                >
                  <View pointerEvents="none" style={styles.proUsageBlobOuter} />
                  <View pointerEvents="none" style={styles.proUsageBlobMid} />
                  <View pointerEvents="none" style={styles.proUsageBlobInner} />
                  <View pointerEvents="none" style={styles.proUsageAccent} />
                  <ProHairlineShimmer cardWidth={proUsageCardWidth} />
                  <View style={styles.usageHeader}>
                    <AppText
                      style={[styles.usageLabel, styles.proUsageLabel]}
                      variant="caption"
                    >
                      Account usage
                    </AppText>
                    <View style={styles.proUsagePillWrapper}>
                      <View
                        pointerEvents="none"
                        style={styles.proUsagePillGlowOuter}
                      />
                      <View
                        pointerEvents="none"
                        style={styles.proUsagePillGlowMid}
                      />
                      <View
                        pointerEvents="none"
                        style={styles.proUsagePillGlowInner}
                      />
                      <Pressable
                        accessibilityLabel="Manage RetTrack Pro"
                        accessibilityRole="button"
                        onPress={() =>
                          handleProFeaturePress("unlimitedPurchases")
                        }
                        style={({ pressed }) => [
                          pressed && styles.proUsagePillPressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.proIdentityPill,
                            styles.proUsagePill,
                            styles.proUsagePillOnDark,
                          ]}
                        >
                          <ProSparkleIcon />
                          <AppText
                            style={styles.proIdentityPillText}
                            variant="caption"
                          >
                            Pro
                          </AppText>
                        </View>
                      </Pressable>
                    </View>
                  </View>

                  <AppText style={styles.proUsageTitle} variant="body">
                    {proSavedPurchaseCountLabel}
                  </AppText>
                  <AppText style={styles.proUsageCount} variant="caption">
                    No limit with RetTrack Pro
                  </AppText>
                </LinearGradient>
              </View>
            ) : (
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
                  {accountPurchaseEntriesUsed} / {signedInPurchaseLimit} saved
                  purchases
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
                    Photos, notes, and return dates
                  </AppText>
                </View>
                <View style={styles.usageProHintDivider} />
                <Pressable
                  accessibilityLabel="Upgrade to RetTrack Pro to remove the purchase limit"
                  accessibilityRole="button"
                  onPress={() => handleProFeaturePress("unlimitedPurchases")}
                  style={({ pressed }) => [
                    styles.usageProHintRow,
                    pressed && styles.usageProHintRowPressed,
                  ]}
                >
                  <AppText style={styles.usageProHintText} variant="caption">
                    No limit with RetTrack Pro
                  </AppText>
                  <View style={styles.usageProHintChevron} />
                </Pressable>
              </View>
            )
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
                  {guestPurchaseEntriesUsed} / {guestPurchaseLimit} guest
                  entries used
                </AppText>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      getProgressStyle(usagePercent),
                    ]}
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
                    Up to {signedInPurchaseLimit} saved purchases
                  </AppText>
                </View>
                <View style={styles.benefitRow}>
                  <View style={styles.benefitDot} />
                  <AppText style={styles.benefitText} variant="caption">
                    Photos, notes, and return dates
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

          {shouldShowSnapshot ? (
            <CurrentSnapshotCard snapshot={snapshot} />
          ) : null}

          {shouldShowSpendingInsights ? (
            <SpendingInsightsCard insights={spendingInsights} />
          ) : null}

          {shouldShowSpendingInsightsTeaser ? (
            <ProLockedOverlay
              caption="Unlock spending insights with Pro"
              onUpgrade={() => handleProFeaturePress("spendingInsights")}
            >
              <LockedSpendingInsightsCard />
            </ProLockedOverlay>
          ) : null}

          {shouldShowCsvExport ? (
            <CsvExportCard
              disabled={isExportingCsv}
              locked={!isPro}
              onPress={handleCsvExportPress}
            />
          ) : null}

          {!isAccountLoading && isAuthenticated ? <RateRetTrackCard /> : null}
        </View>

        {isAccountLoading ? (
          <View style={styles.profileActionsLoadingSpace} />
        ) : null}

        {!isAccountLoading && !isAuthenticated ? (
          <View
            style={[
              styles.actions,
              styles.guestActions,
              styles.guestCtaSection,
            ]}
          >
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
                {isSigningOut ? "Signing out..." : "Sign out"}
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  accountMeta: {
    ...theme.typography.meta,
    color: theme.colors.muted,
    fontWeight: theme.fontWeight.regular,
    lineHeight: 20,
    marginTop: 3,
  },
  accountName: {
    color: theme.colors.greenDark,
    fontSize: 22,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 28,
    marginTop: 8,
  },
  actions: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 14,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#E6EEDF",
    borderColor: "#DDE6D5",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    height: 68,
    justifyContent: "center",
    overflow: "hidden",
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
    height: "100%",
    width: "100%",
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
    backgroundColor: "#EEEBDC",
    borderRadius: 108,
    height: 650,
    left: -2,
    opacity: 0.46,
    position: "absolute",
    right: -2,
    top: 260,
  },
  backgroundGlowBottom: {
    backgroundColor: "#EFE2C9",
    borderRadius: 460,
    bottom: -136,
    height: 920,
    left: -655,
    opacity: 0.28,
    position: "absolute",
    width: 920,
  },
  backgroundGlowTop: {
    backgroundColor: "#E3EEDB",
    borderRadius: 470,
    height: 940,
    opacity: 0.32,
    position: "absolute",
    right: -700,
    top: -540,
    width: 940,
  },
  backgroundMossGlow: {
    backgroundColor: "#D7E5CF",
    borderRadius: 250,
    height: 500,
    opacity: 0.18,
    position: "absolute",
    right: -215,
    top: 430,
    transform: [{ rotate: "10deg" }],
    width: 560,
  },
  backgroundSageVeil: {
    backgroundColor: "#E8F1E0",
    borderRadius: 220,
    height: 420,
    opacity: 0.26,
    position: "absolute",
    right: -175,
    top: 190,
    transform: [{ rotate: "-12deg" }],
    width: 600,
  },
  backgroundWarmVeil: {
    backgroundColor: "#F4E8D2",
    borderRadius: 260,
    height: 520,
    left: -250,
    opacity: 0.22,
    position: "absolute",
    top: 660,
    transform: [{ rotate: "-18deg" }],
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
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  benefitText: {
    color: theme.colors.muted,
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
  benefitsCard: {
    alignSelf: "stretch",
    backgroundColor: "#F5F5EA",
    borderColor: "#DCE5D3",
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
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 1,
  },
  benefitsPill: {
    backgroundColor: "#EEF4EA",
    borderColor: "#D5E1CC",
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
  csvExportBody: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  // Locked subtitle lightened one step from theme.colors.muted (#6F7468 →
  // rgb(111, 116, 104)) to rgba(111, 116, 104, 0.7). Only the subtitle color softens;
  // the title stays fully legible and the card gets no opacity.
  csvExportBodyLocked: {
    color: "rgba(111, 116, 104, 0.7)",
  },
  csvExportCard: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#FFFDF8",
    borderColor: "rgba(92, 111, 82, 0.13)",
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
    minHeight: 58,
    paddingHorizontal: 19,
    paddingVertical: 11,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 4,
      width: 0,
    },
    shadowOpacity: 0.015,
    shadowRadius: 8,
    elevation: 0,
  },
  csvExportCardDisabled: {
    opacity: 0.56,
  },
  // Softer, less-bright fill than the active row (#FFFDF8 → #FDFBF5) so the locked
  // state reads as subtly set-back — NOT disabled. No opacity, border, or shadow
  // change; the row must still invite the tap that opens the paywall.
  csvExportCardLocked: {
    backgroundColor: "#FDFBF5",
  },
  csvExportCardPressed: {
    opacity: 0.82,
  },
  csvExportChevron: {
    borderColor: "#7F8778",
    borderRightWidth: 1.2,
    borderTopWidth: 1.2,
    height: 7,
    opacity: 0.42,
    transform: [{ rotate: "45deg" }],
    width: 7,
  },
  csvExportCopy: {
    flex: 1,
    minWidth: 0,
  },
  csvExportTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 19,
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
    flexDirection: "row",
    gap: 9,
    marginTop: 12,
  },
  featureText: {
    ...theme.typography.meta,
    color: "#787D72",
    flex: 1,
    lineHeight: 20,
  },
  guestActionButton: {
    borderRadius: theme.radius.pill,
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  guestActions: {
    flexDirection: "row",
  },
  guestCtaSection: {
    marginTop: 14,
  },
  header: {
    gap: 7,
  },
  identityContent: {
    alignItems: "flex-start",
    flex: 1,
    minWidth: 0,
  },
  identityRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 15,
  },
  insightsAccentRate: {
    backgroundColor: theme.colors.amber,
  },
  // Shared Pro-card hairline — the two-tier Pro marker: the hero Account usage card
  // keeps the pill + hairline, every other Pro card (Spending insights, CSV export)
  // gets the hairline only. Matches the sort menu's mechanism: a 2px amber top
  // *border* layered on the card's normal 1px border. A border follows borderRadius
  // on its own, so it needs no overflow:'hidden' (which would clip the card's shadow)
  // — unlike proUsageAccent, an absolute bar that must clip.
  insightsHairline: {
    borderTopColor: theme.colors.amber,
    borderTopWidth: 2,
  },
  insightsLabelRate: {
    color: theme.colors.amber,
  },
  // Scoped override for the insights money tiles only (Purchase status keeps the
  // larger snapshotValue): a smaller value gives multi-currency strings
  // ("GEL 300 · USD 239") room, paired with numberOfLines={1} + adjustsFontSizeToFit
  // so a long value shrinks to fit rather than clipping silently.
  insightsValue: {
    fontSize: 15,
    lineHeight: 20,
  },
  // The teaser shell owns no outer spacing — ProLockedOverlay's wrapper supplies
  // the top rhythm, so the frosted glass + badge cover the card exactly with no
  // margin seam.
  lockedInsightsCard: {
    marginTop: 0,
  },
  profileCard: {
    alignSelf: "stretch",
    backgroundColor: "#FFFDFB",
    borderColor: "#E3E5DD",
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
  profileActionsLoadingSpace: {
    minHeight: 66,
  },
  profileCardLoading: {
    minHeight: 548,
  },
  proIdentityPill: {
    backgroundColor: "#FFF6E5",
    borderColor: "#D6C28F",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowColor: theme.colors.greenDark,
    shadowOffset: {
      height: 3,
      width: 0,
    },
    shadowOpacity: 0.035,
    shadowRadius: 8,
    elevation: 1,
  },
  proIdentityPillText: {
    color: "#604B25",
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 14,
  },
  proUsageAccent: {
    backgroundColor: theme.colors.amber,
    height: 2,
    left: -1,
    opacity: 0.85,
    position: "absolute",
    right: -1,
    top: -1,
  },
  proUsageBlobInner: {
    backgroundColor: "rgba(255, 255, 255, 0.26)",
    borderRadius: 26,
    bottom: -26,
    height: 52,
    position: "absolute",
    right: -26,
    width: 52,
  },
  proUsageBlobMid: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    borderRadius: 32,
    bottom: -32,
    height: 64,
    position: "absolute",
    right: -32,
    width: 64,
  },
  proUsageBlobOuter: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 40,
    bottom: -40,
    height: 80,
    position: "absolute",
    right: -40,
    width: 80,
  },
  proUsageCard: {
    borderColor: "rgba(255, 255, 255, 0.14)",
    elevation: 0,
    marginTop: 0,
    overflow: "hidden",
    paddingBottom: 18,
    paddingTop: 19,
    shadowOpacity: 0,
  },
  proUsageCardWrapper: {
    alignSelf: "stretch",
    backgroundColor: "#2F442F",
    borderRadius: 22,
    elevation: 6,
    marginTop: 20,
    shadowColor: "#0F1A0F",
    shadowOffset: {
      height: 16,
      width: 0,
    },
    shadowOpacity: 0.24,
    shadowRadius: 16,
  },
  proUsageCount: {
    color: theme.colors.sage,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 7,
    opacity: 0.78,
  },
  proUsageLabel: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  proUsagePill: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
  },
  proUsagePillGlowInner: {
    backgroundColor: "rgba(199, 146, 62, 0.24)",
    borderRadius: theme.radius.pill,
    bottom: -3,
    left: -3,
    position: "absolute",
    right: -3,
    top: -3,
  },
  proUsagePillGlowMid: {
    backgroundColor: "rgba(199, 146, 62, 0.16)",
    borderRadius: theme.radius.pill,
    bottom: -7,
    left: -7,
    position: "absolute",
    right: -7,
    top: -7,
  },
  proUsagePillGlowOuter: {
    backgroundColor: "rgba(199, 146, 62, 0.1)",
    borderRadius: theme.radius.pill,
    bottom: -11,
    left: -11,
    position: "absolute",
    right: -11,
    top: -11,
  },
  proUsagePillOnDark: {
    borderColor: "rgba(255, 246, 229, 0.62)",
    elevation: 0,
    position: "relative",
    shadowOpacity: 0,
    zIndex: 1,
  },
  // Pressed feedback for the pill now that it is the Manage Pro entry point: a
  // subtle dim on the pill only (the glow rings are outside this Pressable), so
  // the press reads without distorting the pill's shape or colour.
  proUsagePillPressed: {
    opacity: 0.7,
  },
  proUsagePillWrapper: {
    position: "relative",
  },
  proUsageShimmerGradient: {
    flex: 1,
  },
  proUsageShimmerWrap: {
    height: 3,
    left: 0,
    position: "absolute",
    top: -1.5,
    width: SHIMMER_BAND_WIDTH,
  },
  proUsageTitle: {
    color: "#FFFDF7",
    fontSize: 24,
    fontWeight: theme.fontWeight.medium,
    letterSpacing: 0.4,
    lineHeight: 30,
    marginTop: 16,
  },
  progressFill: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: "100%",
  },
  progressTrack: {
    backgroundColor: "#DDE8D5",
    borderRadius: theme.radius.pill,
    height: 6,
    marginTop: 15,
    overflow: "hidden",
  },
  ratingBody: {
    color: theme.colors.muted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
    maxWidth: 274,
    textAlign: "center",
  },
  ratingCard: {
    alignItems: "center",
    alignSelf: "stretch",
    backgroundColor: "#FFF8EC",
    borderColor: "#E9DCC8",
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
  ratingCardPressed: {
    opacity: 0.82,
  },
  ratingCta: {
    backgroundColor: "rgba(255, 253, 248, 0.5)",
    borderColor: "rgba(225, 215, 200, 0.7)",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    marginTop: 7,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  ratingCtaText: {
    color: theme.colors.greenDark,
    fontSize: 11,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 15,
    opacity: 0.78,
  },
  ratingTitle: {
    color: theme.colors.greenDark,
    fontSize: 16,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 21,
    textAlign: "center",
  },
  remainingPill: {
    backgroundColor: theme.colors.card,
    borderColor: "#DBE1D4",
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
    backgroundColor: "#FBFAF3",
    paddingBottom: 0,
    paddingTop: theme.spacing.xl,
  },
  scroll: {
    flex: 1,
  },
  signOutButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#FFFBF8",
    borderColor: "#E8CFC8",
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
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
    width: "72%",
    elevation: 1,
  },
  signOutButtonDisabled: {
    opacity: 0.55,
  },
  signOutButtonPressed: {
    opacity: 0.76,
  },
  signOutButtonText: {
    color: "#8E5D55",
    fontSize: 15,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
    textAlign: "center",
  },
  signOutErrorCard: {
    alignSelf: "stretch",
    backgroundColor: theme.colors.softPending,
    borderColor: "#E4C8C1",
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
    textAlign: "center",
  },
  signOutSection: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  snapshotCard: {
    alignSelf: "stretch",
    backgroundColor: "#FFFCF3",
    borderColor: "#E9E0D0",
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
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  snapshotHeader: {
    alignItems: "flex-start",
  },
  snapshotItem: {
    backgroundColor: "#F7F4EC",
    borderColor: "#E8E2D6",
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
    backgroundColor: "#9A743D",
  },
  snapshotAccentOpen: {
    backgroundColor: theme.colors.greenDark,
  },
  snapshotAccentReturned: {
    backgroundColor: "#65845D",
  },
  snapshotItemKept: {
    backgroundColor: "#FBF4E8",
    borderColor: "#E9DDC8",
  },
  snapshotItemOpen: {
    backgroundColor: "#F3F6EE",
    borderColor: "#DDE7D6",
  },
  snapshotItemReturned: {
    backgroundColor: "#F4F8F0",
    borderColor: "#DCE8D4",
  },
  snapshotLabel: {
    color: theme.colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  snapshotLabelKept: {
    color: "#8A6A3E",
  },
  snapshotLabelOpen: {
    color: theme.colors.greenDark,
  },
  snapshotLabelReturned: {
    color: "#5F7C58",
  },
  snapshotTitle: {
    color: theme.colors.greenDark,
    fontSize: 14,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 19,
  },
  snapshotTitleBlock: {
    alignItems: "flex-start",
  },
  snapshotValue: {
    color: theme.colors.greenDark,
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 22,
  },
  statusBadge: {
    alignItems: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusBadgeGuest: {
    backgroundColor: "#F6F1E8",
    borderColor: "#E6DCCB",
  },
  statusBadgeLoading: {
    backgroundColor: "#F5F6F0",
    borderColor: "#E1E5DC",
  },
  statusBadgeSignedIn: {
    backgroundColor: "#EEF4EA",
    borderColor: "#D9E5D3",
  },
  statusBadgeText: {
    ...theme.typography.chipText,
    lineHeight: 15,
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
    color: theme.colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
  syncDot: {
    backgroundColor: theme.colors.greenDark,
    borderRadius: theme.radius.pill,
    height: 6,
    opacity: 0.7,
    width: 6,
  },
  syncRow: {
    alignItems: "center",
    alignSelf: "stretch",
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  syncText: {
    color: "#4D6048",
    flex: 1,
    fontSize: 14,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
  },
  title: {
    ...theme.typography.accountTitle,
    color: "#12322D",
    fontWeight: theme.fontWeight.bold,
    lineHeight: 38,
  },
  usageCard: {
    alignSelf: "stretch",
    backgroundColor: "#F2F7EE",
    borderColor: "#DCE8D5",
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
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
  },
  usageLabel: {
    color: theme.colors.greenDark,
    fontSize: 13,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 18,
  },
  // Amber chevron for the Pro action chip — the same CSS-border chevron as
  // csvExportChevron (a 45°-rotated corner), amber and crisp. Bumped 6→7px / 1.4→1.5
  // stroke so it sits balanced beside the label inside the filled chip rather than
  // looking incidental.
  usageProHintChevron: {
    borderColor: theme.colors.amber,
    borderRightWidth: 1.5,
    borderTopWidth: 1.5,
    height: 7,
    transform: [{ rotate: "45deg" }],
    width: 7,
  },
  // Hairline separating the informational bullets from the Pro action row. Reuses the
  // usageCard's own borderColor (#DCE8D5) rather than a new colour, and sits inside the
  // card's padding so it spans the content width with no negative margins.
  usageProHintDivider: {
    backgroundColor: "#DCE8D5",
    height: 1,
    marginTop: 14,
  },
  // The Pro entry point, styled as a soft amber chip — mirroring remainingPill's
  // filled-pill language in this same card, but in amber: a low-alpha amber fill + a
  // 1px amber border so it reads as a tap target, not a green footnote. Content-width
  // and centred so the chip hugs its label. No shadow, elevation, or gradient — the
  // solid gold pill (Spending Insights) stays the tier above this.
  usageProHintRow: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(199, 146, 62, 0.12)",
    borderColor: "rgba(199, 146, 62, 0.5)",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  // Pressed feedback: a deeper step of the chip's own amber fill (0.12 → 0.2), so the
  // press reads as the same chip darkening rather than a colour change.
  usageProHintRowPressed: {
    backgroundColor: "rgba(199, 146, 62, 0.2)",
  },
  // Label for the Pro action chip. theme.colors.amber (#C7923E) is the only amber and
  // is too light for caption text on its own tint, so the label keeps greenDark — the
  // card's on-brand dark, already used on every other line here — for strong contrast
  // on the soft amber fill. The chip's fill + border (not the text colour) carries the
  // affordance now. Not flexed — the row centres label + chevron as a unit.
  usageProHintText: {
    ...theme.typography.meta,
    color: theme.colors.greenDark,
    fontWeight: theme.fontWeight.medium,
    lineHeight: 20,
  },
  usageTitle: {
    color: theme.colors.greenDark,
    fontSize: 18,
    fontWeight: theme.fontWeight.semibold,
    lineHeight: 24,
    marginTop: 15,
  },
});
