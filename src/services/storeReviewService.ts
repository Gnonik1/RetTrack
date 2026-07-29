import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const LAST_REVIEW_REQUEST_STORAGE_KEY = 'rettrack:lastReviewRequestedAt:v1';

// Apple throttles review prompts on its own, so this cooldown only keeps the
// app from re-asking a user who already saw the sheet a release or two ago.
const REVIEW_REQUEST_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

// Resolving a purchase re-renders the list and can pop the details screen, so
// let that settle before Apple's sheet takes over the frame.
const REVIEW_REQUEST_SETTLE_DELAY_MS = 1200;

// Resolving several purchases in quick succession would otherwise let every
// call read the stored timestamp before the first one writes it.
let isReviewRequestInFlight = false;

async function getLastReviewRequestedAt() {
  const storedTimestamp = await AsyncStorage.getItem(
    LAST_REVIEW_REQUEST_STORAGE_KEY,
  );
  const parsedTimestamp = Number(storedTimestamp);

  if (!Number.isFinite(parsedTimestamp) || parsedTimestamp <= 0) {
    return null;
  }

  return parsedTimestamp;
}

function waitForResolveAnimation() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, REVIEW_REQUEST_SETTLE_DELAY_MS);
  });
}

export async function maybeRequestReviewAfterReturn(): Promise<void> {
  if (isReviewRequestInFlight) {
    return;
  }

  isReviewRequestInFlight = true;

  try {
    const lastRequestedAt = await getLastReviewRequestedAt();

    if (
      lastRequestedAt !== null &&
      Date.now() - lastRequestedAt < REVIEW_REQUEST_COOLDOWN_MS
    ) {
      return;
    }

    // Checked before the delay so an unsupported device costs nothing, and
    // before the timestamp write so a later eligible return still gets a turn.
    const isReviewAvailable = await StoreReview.isAvailableAsync();

    if (!isReviewAvailable) {
      return;
    }

    await waitForResolveAnimation();
    await StoreReview.requestReview();

    await AsyncStorage.setItem(
      LAST_REVIEW_REQUEST_STORAGE_KEY,
      String(Date.now()),
    );
  } catch {
    // A review prompt is never worth surfacing a failure for. If storage or the
    // native module misbehaves, the resolve flow carries on untouched.
  } finally {
    isReviewRequestInFlight = false;
  }
}
