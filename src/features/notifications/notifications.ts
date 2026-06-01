import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MockPurchase } from '../purchases/data/mockPurchases';
import { getPurchaseReturnDate } from '../purchases/utils/purchaseDates';

const REMINDER_CHANNEL_ID = 'rettrack-reminders';
const REMINDER_MINUTE = 0;
const FUTURE_RETURN_REMINDER_HOUR = 10;
const LAST_DAY_REMINDER_HOUR = 10;
const NEAR_FUTURE_REMINDER_DELAY_MS = 60 * 1000;
const PENDING_DIGEST_ANCHOR_STORAGE_KEY =
  'rettrack:pendingDigestAnchorAt:v1';
const LOCAL_REMINDER_SOURCE = 'rettrack-local-reminder';
const PENDING_DIGEST_IDENTIFIER_PREFIX = 'rettrack:pending-digest:';
const PENDING_DIGEST_CATEGORY_IDENTIFIERS = [
  'rettrack-pending-digest',
  'rettrack:pending-digest',
];
const LEGACY_PENDING_DIGEST_TITLE = 'still pending';
const LEGACY_PENDING_DIGEST_BODY_PATTERNS = [
  'purchase needs a decision',
  'purchases need a decision',
];
const QUIET_HOUR_END = 10;
const QUIET_HOUR_START = 22;

type ReminderKind =
  | 'due-today-group'
  | 'pending-digest-initial'
  | 'pending-digest-three-days'
  | 'pending-digest-seven-days'
  | 'pending-now'
  | 'pending-three-days'
  | 'pending-seven-days'
  | 'return-last-day'
  | 'return-three-days'
  | 'return-seven-days';

type ReminderPlan = {
  body: string;
  date: Date;
  identifier: string;
  kind: ReminderKind;
  title: string;
};

type GroupedReturnReminderKind = Extract<
  ReminderKind,
  'return-seven-days' | 'return-three-days'
>;

type GroupedReturnReminderDefinition = {
  daysLeft: 3 | 7;
  kind: GroupedReturnReminderKind;
};

type RescheduleAllPurchaseRemindersOptions = {
  immediatePendingPurchaseIds?: string[];
  remindersEnabled?: boolean;
};

const GROUPED_RETURN_REMINDER_DEFINITIONS: GroupedReturnReminderDefinition[] = [
  {
    daysLeft: 7,
    kind: 'return-seven-days',
  },
  {
    daysLeft: 3,
    kind: 'return-three-days',
  },
];

let hasConfiguredNotificationHandler = false;

export function configureNotificationHandler() {
  if (hasConfiguredNotificationHandler) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  hasConfiguredNotificationHandler = true;

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      importance: Notifications.AndroidImportance.DEFAULT,
      name: 'Return reminders',
    }).catch(() => {
      // Notification channel setup is best-effort in the local Expo app.
    });
  }
}

export async function getNotificationPermissionsStatus() {
  try {
    return await Notifications.getPermissionsAsync();
  } catch {
    return null;
  }
}

export async function requestNotificationPermissions() {
  const currentStatus = await getNotificationPermissionsStatus();

  if (currentStatus?.granted) {
    return true;
  }

  if (currentStatus?.canAskAgain === false) {
    return false;
  }

  try {
    const requestedStatus = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: false,
        allowSound: true,
      },
    });

    return requestedStatus.granted;
  } catch {
    return false;
  }
}

export async function cancelPurchaseReminders(purchaseId: string) {
  const identifiers = getPurchaseReminderIdentifiers(purchaseId);

  await Promise.all(identifiers.map(cancelScheduledReminder));
}

export async function schedulePurchaseReminders(
  purchase: MockPurchase,
  options: { remindersEnabled?: boolean } = {},
) {
  await cancelPurchaseReminders(purchase.id);

  if (purchase.status !== 'active') {
    return [];
  }

  const canSchedule = await canScheduleNotifications(
    options.remindersEnabled ?? false,
  );

  if (!canSchedule) {
    return [];
  }

  const now = new Date();

  return scheduleReminderPlans([
    ...getGroupedReturnReminderPlans([purchase], now),
    ...getGroupedLastDayReturnReminderPlans([purchase], now),
  ]);
}

export async function rescheduleAllPurchaseReminders(
  purchases: MockPurchase[],
  options: RescheduleAllPurchaseRemindersOptions = {},
) {
  const now = new Date();
  // Current pending counts must come only from the hydrated canonical purchases
  // passed by PurchasesProvider, never from guest quota or stale storage counts.
  const pendingPurchases = purchases.filter(
    (purchase) => purchase.status === 'pending',
  );

  if (pendingPurchases.length === 0) {
    await clearPendingDigestAnchor();
  }

  // Older app versions may have scheduled pending digest notifications with
  // stale counts. Clean scheduled and delivered copies before the canonical
  // rebuild creates fresh notifications from the hydrated purchases above.
  await cancelScheduledPendingDigestNotifications();
  await cancelAllScheduledAppReminders();
  await dismissPresentedPendingDigestNotifications();

  const canSchedule = await canScheduleNotifications(
    options.remindersEnabled ?? false,
  );

  if (!canSchedule) {
    return [];
  }

  const activePurchases = purchases.filter(
    (purchase) => purchase.status === 'active',
  );
  const reminderPlans = [
    ...getGroupedReturnReminderPlans(activePurchases, now),
    ...getGroupedLastDayReturnReminderPlans(activePurchases, now),
  ];
  const pendingDigestAnchorDate =
    pendingPurchases.length > 0
      ? await getOrCreatePendingDigestAnchorDate(now)
      : null;
  const pendingDigestReminderPlans = pendingDigestAnchorDate
    ? getPendingDigestReminderPlans(
        pendingPurchases,
        now,
        pendingDigestAnchorDate,
      )
    : [];

  reminderPlans.push(...pendingDigestReminderPlans);

  return scheduleReminderPlans(reminderPlans);
}

function cancelScheduledReminder(identifier: string) {
  return Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {
    // A missing or unavailable scheduled notification should not block UI flow.
  });
}

export function cancelAllScheduledAppReminders() {
  return Notifications.cancelAllScheduledNotificationsAsync().catch(() => {
    // Reconcile should keep working even if the native scheduler is unavailable.
  });
}

async function cancelScheduledPendingDigestNotifications() {
  try {
    const scheduledNotifications =
      await Notifications.getAllScheduledNotificationsAsync();
    const pendingDigestNotifications = scheduledNotifications.filter(
      isRetTrackPendingDigestNotificationRequest,
    );

    await Promise.all(
      pendingDigestNotifications.map((notification) =>
        cancelScheduledReminder(notification.identifier),
      ),
    );
  } catch {
    // Explicit legacy cleanup is best-effort; the broad rebuild clear follows.
  }
}

async function dismissPresentedPendingDigestNotifications() {
  try {
    const presentedNotifications =
      await Notifications.getPresentedNotificationsAsync();
    const pendingDigestNotifications = presentedNotifications.filter(
      isPresentedPendingDigestNotification,
    );

    await Promise.all(
      pendingDigestNotifications.map((notification) =>
        Notifications.dismissNotificationAsync(
          notification.request.identifier,
        ).catch(() => {
          // Dismissing stale delivered digests is best-effort.
        }),
      ),
    );
  } catch {
    // Presented notification cleanup should not block schedule reconciliation.
  }
}

function isPresentedPendingDigestNotification(
  notification: Notifications.Notification,
) {
  return isRetTrackPendingDigestNotificationRequest(notification.request);
}

function isRetTrackPendingDigestNotificationRequest(
  request: Notifications.NotificationRequest,
) {
  const { content, identifier } = request;

  return (
    identifier.startsWith(PENDING_DIGEST_IDENTIFIER_PREFIX) ||
    isPendingDigestNotificationData(content.data) ||
    isPendingDigestCategoryIdentifier(content.categoryIdentifier) ||
    isLegacyPendingDigestNotificationContent(content)
  );
}

function isPendingDigestNotificationData(
  data: Notifications.NotificationContent['data'] | undefined,
) {
  if (!data) {
    return false;
  }

  const pendingDigestDataValues = [
    data.reminderKind,
    data.type,
    data.category,
    data.categoryIdentifier,
  ];

  return (
    pendingDigestDataValues.some(isPendingDigestReminderKind) ||
    (data.source === LOCAL_REMINDER_SOURCE &&
      pendingDigestDataValues.some(isPendingDigestDataIdentifier))
  );
}

function isLegacyPendingDigestNotificationContent(
  content: Notifications.NotificationContent,
) {
  const title = normalizeNotificationText(content.title);
  const body = normalizeNotificationText(content.body);

  return (
    title.includes(LEGACY_PENDING_DIGEST_TITLE) &&
    LEGACY_PENDING_DIGEST_BODY_PATTERNS.some((pattern) =>
      body.includes(pattern),
    )
  );
}

function normalizeNotificationText(value: string | null | undefined) {
  return value?.toLowerCase() ?? '';
}

function isPendingDigestReminderKind(reminderKind: unknown) {
  return (
    reminderKind === 'pending-digest-initial' ||
    reminderKind === 'pending-digest-three-days' ||
    reminderKind === 'pending-digest-seven-days'
  );
}

function isPendingDigestDataIdentifier(identifier: unknown) {
  return (
    isPendingDigestReminderKind(identifier) ||
    identifier === 'pending-digest' ||
    isPendingDigestCategoryIdentifier(identifier)
  );
}

function isPendingDigestCategoryIdentifier(identifier: unknown) {
  return (
    typeof identifier === 'string' &&
    PENDING_DIGEST_CATEGORY_IDENTIFIERS.includes(identifier)
  );
}

async function canScheduleNotifications(remindersEnabled: boolean) {
  if (!remindersEnabled) {
    return false;
  }

  const status = await getNotificationPermissionsStatus();

  return Boolean(status?.granted);
}

async function clearPendingDigestAnchor() {
  await AsyncStorage.removeItem(PENDING_DIGEST_ANCHOR_STORAGE_KEY).catch(() => {
    // Pending digest tracking is best-effort; scheduling should still reconcile.
  });
}

async function getOrCreatePendingDigestAnchorDate(now: Date) {
  const storedAnchorDate = await getStoredPendingDigestAnchorDate();

  if (storedAnchorDate) {
    const normalizedAnchorDate =
      normalizePendingDigestAnchorDate(storedAnchorDate);

    if (normalizedAnchorDate.getTime() !== storedAnchorDate.getTime()) {
      await storePendingDigestAnchorDate(normalizedAnchorDate);
    }

    return normalizedAnchorDate;
  }

  const nextAnchorDate = getImmediatePendingReminderDate(now);

  await storePendingDigestAnchorDate(nextAnchorDate);

  return nextAnchorDate;
}

async function storePendingDigestAnchorDate(anchorDate: Date) {
  await AsyncStorage.setItem(
    PENDING_DIGEST_ANCHOR_STORAGE_KEY,
    String(anchorDate.getTime()),
  ).catch(() => {
    // If local tracking cannot be written, keep this reconcile best-effort.
  });
}

async function getStoredPendingDigestAnchorDate() {
  try {
    const storedAnchor = await AsyncStorage.getItem(
      PENDING_DIGEST_ANCHOR_STORAGE_KEY,
    );
    const parsedAnchor = Number(storedAnchor);

    if (!Number.isFinite(parsedAnchor) || parsedAnchor <= 0) {
      return null;
    }

    const anchorDate = new Date(parsedAnchor);

    return Number.isNaN(anchorDate.getTime()) ? null : anchorDate;
  } catch {
    return null;
  }
}

function getPurchaseReminderIdentifiers(purchaseId: string) {
  const kinds: ReminderKind[] = [
    'return-seven-days',
    'return-three-days',
    'return-last-day',
    'pending-now',
    'pending-three-days',
    'pending-seven-days',
  ];

  return kinds.map((kind) => getReminderIdentifier(purchaseId, kind));
}

function getReminderIdentifier(purchaseId: string, kind: ReminderKind) {
  return `rettrack:${purchaseId}:${kind}`;
}

function getGroupedReturnReminderPlans(
  purchases: MockPurchase[],
  now: Date,
) {
  const groupedReminders = new Map<
    string,
    {
      count: number;
      date: Date;
      daysLeft: 3 | 7;
      kind: GroupedReturnReminderKind;
    }
  >();

  for (const purchase of purchases) {
    const returnDate = getPurchaseReturnDate(purchase);

    if (!returnDate) {
      continue;
    }

    for (const reminderDefinition of GROUPED_RETURN_REMINDER_DEFINITIONS) {
      const reminderDate = getReturnReminderDate(
        returnDate,
        reminderDefinition.daysLeft,
        FUTURE_RETURN_REMINDER_HOUR,
      );

      if (!isFutureDate(reminderDate, now)) {
        continue;
      }

      const reminderDateKey = getLocalDateKey(reminderDate);
      const groupKey = `${reminderDefinition.kind}:${reminderDateKey}`;
      const groupedReminder = groupedReminders.get(groupKey);

      if (groupedReminder) {
        groupedReminder.count += 1;
        continue;
      }

      groupedReminders.set(groupKey, {
        count: 1,
        date: reminderDate,
        daysLeft: reminderDefinition.daysLeft,
        kind: reminderDefinition.kind,
      });
    }
  }

  return Array.from(groupedReminders.values()).map(
    (groupedReminder): ReminderPlan => ({
      body: getGroupedReturnReminderBody(
        groupedReminder.count,
        groupedReminder.daysLeft,
      ),
      date: groupedReminder.date,
      identifier: getGroupedReturnReminderIdentifier(
        groupedReminder.kind,
        groupedReminder.date,
      ),
      kind: groupedReminder.kind,
      title: 'Return reminder',
    }),
  );
}

function getGroupedReturnReminderBody(purchaseCount: number, daysLeft: 3 | 7) {
  if (purchaseCount === 1) {
    return `1 purchase has ${daysLeft} days left to return.`;
  }

  return `${purchaseCount} purchases have ${daysLeft} days left to return.`;
}

function getGroupedLastDayReturnReminderPlans(
  purchases: MockPurchase[],
  now: Date,
) {
  const groupedReminders = new Map<
    string,
    {
      count: number;
      date: Date;
      returnDate: Date;
    }
  >();

  for (const purchase of purchases) {
    const returnDate = getPurchaseReturnDate(purchase);

    if (!returnDate) {
      continue;
    }

    const reminderDate = getLastDayReminderDate(returnDate, now);

    if (!reminderDate || !isFutureDate(reminderDate, now)) {
      continue;
    }

    const returnDateKey = getLocalDateKey(returnDate);
    const groupedReminder = groupedReminders.get(returnDateKey);

    if (groupedReminder) {
      groupedReminder.count += 1;
      continue;
    }

    groupedReminders.set(returnDateKey, {
      count: 1,
      date: reminderDate,
      returnDate,
    });
  }

  return Array.from(groupedReminders.values()).map(
    (groupedReminder): ReminderPlan => ({
      body: getDueTodayReminderBody(groupedReminder.count),
      date: groupedReminder.date,
      identifier: getDueTodayReminderIdentifier(groupedReminder.returnDate),
      kind: 'due-today-group',
      title: 'Last day to return',
    }),
  );
}

function getGroupedReturnReminderIdentifier(
  kind: GroupedReturnReminderKind,
  date: Date,
) {
  return `rettrack:${kind}:${getLocalDateKey(date)}`;
}

function getPendingDigestReminderPlans(
  pendingPurchases: MockPurchase[],
  now: Date,
  anchorDate: Date,
) {
  if (pendingPurchases.length === 0) {
    return [];
  }

  const pendingDigestBody = getPendingDigestReminderBody(
    pendingPurchases.length,
  );
  const reminderPlans: ReminderPlan[] = [
    {
      body: pendingDigestBody,
      date: anchorDate,
      identifier: getPendingDigestReminderIdentifier('initial'),
      kind: 'pending-digest-initial',
      title: 'Pending review',
    },
    {
      body: pendingDigestBody,
      date: getPendingFollowUpDate(anchorDate, 3),
      identifier: getPendingDigestReminderIdentifier('3d'),
      kind: 'pending-digest-three-days',
      title: 'Pending review',
    },
    {
      body: pendingDigestBody,
      date: getPendingFollowUpDate(anchorDate, 7),
      identifier: getPendingDigestReminderIdentifier('7d'),
      kind: 'pending-digest-seven-days',
      title: 'Pending review',
    },
  ];

  return reminderPlans.filter((plan) => isFutureDate(plan.date, now));
}

function getPendingDigestReminderBody(pendingCount: number) {
  if (pendingCount === 1) {
    return '1 purchase is ready for your decision in RetTrack';
  }

  return `${pendingCount} purchases are ready for your decision in RetTrack`;
}

function getPendingDigestReminderIdentifier(timing: 'initial' | '3d' | '7d') {
  return `rettrack:pending-digest:${timing}`;
}

function getReturnReminderDate(
  returnDate: Date,
  daysBefore: number,
  reminderHour: number,
) {
  const reminderDate = new Date(returnDate);
  reminderDate.setDate(returnDate.getDate() - daysBefore);

  return atReminderTime(reminderDate, reminderHour);
}

function getLastDayReminderDate(returnDate: Date, now: Date) {
  const lastDayReminderDate = getReturnReminderDate(
    returnDate,
    0,
    LAST_DAY_REMINDER_HOUR,
  );

  if (isSameLocalDate(returnDate, now)) {
    return getDueTodayReminderDate(now);
  }

  return lastDayReminderDate;
}

function getPendingFollowUpDate(startDate: Date, daysLater: number) {
  const reminderDate = new Date(startDate);
  reminderDate.setDate(startDate.getDate() + daysLater);

  return atReminderTime(reminderDate, FUTURE_RETURN_REMINDER_HOUR);
}

function getImmediatePendingReminderDate(now: Date) {
  if (now.getTime() < atReminderTime(now, QUIET_HOUR_END).getTime()) {
    return atReminderTime(now, QUIET_HOUR_END);
  }

  return atReminderTime(addDays(now, 1), QUIET_HOUR_END);
}

function normalizePendingDigestAnchorDate(anchorDate: Date) {
  const morningAnchorDate = atReminderTime(anchorDate, QUIET_HOUR_END);

  if (anchorDate.getTime() <= morningAnchorDate.getTime()) {
    return morningAnchorDate;
  }

  return atReminderTime(addDays(anchorDate, 1), QUIET_HOUR_END);
}

function getDueTodayReminderDate(now: Date) {
  if (isBeforeQuietHourEnd(now)) {
    return atReminderTime(now, QUIET_HOUR_END);
  }

  if (isAtOrAfterQuietHourStart(now)) {
    return null;
  }

  const nearFutureDate = new Date(
    now.getTime() + NEAR_FUTURE_REMINDER_DELAY_MS,
  );

  return isSameLocalDate(nearFutureDate, now) &&
    isWithinReminderHours(nearFutureDate)
    ? nearFutureDate
    : null;
}

function atReminderTime(date: Date, reminderHour: number) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    reminderHour,
    REMINDER_MINUTE,
  );
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);

  return nextDate;
}

function isFutureDate(date: Date, now: Date) {
  return date.getTime() > now.getTime();
}

function isSameLocalDate(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function isBeforeQuietHourEnd(date: Date) {
  return getMinutesSinceMidnight(date) < QUIET_HOUR_END * 60;
}

function isAtOrAfterQuietHourStart(date: Date) {
  return getMinutesSinceMidnight(date) >= QUIET_HOUR_START * 60;
}

function isWithinReminderHours(date: Date) {
  return !isBeforeQuietHourEnd(date) && !isAtOrAfterQuietHourStart(date);
}

function getMinutesSinceMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getDueTodayReminderBody(purchaseCount: number) {
  if (purchaseCount === 1) {
    return '1 purchase is due today';
  }

  return `${purchaseCount} purchases are due today`;
}

function getDueTodayReminderIdentifier(date: Date) {
  return `rettrack:due-today:${getLocalDateKey(date)}`;
}

function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

async function scheduleReminderPlans(reminderPlans: ReminderPlan[]) {
  const scheduledIdentifiers: string[] = [];

  for (const reminderPlan of reminderPlans) {
    const identifier = await scheduleReminder(reminderPlan);

    if (identifier) {
      scheduledIdentifiers.push(identifier);
    }
  }

  return scheduledIdentifiers;
}

async function scheduleReminder(reminderPlan: ReminderPlan) {
  const purchaseId = getPurchaseIdFromReminderIdentifier(
    reminderPlan.identifier,
  );

  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        body: reminderPlan.body,
        data: {
          ...(purchaseId ? { purchaseId } : {}),
          reminderKind: reminderPlan.kind,
          source: LOCAL_REMINDER_SOURCE,
        },
        title: reminderPlan.title,
      },
      identifier: reminderPlan.identifier,
      trigger: getDateTrigger(reminderPlan.date),
    });
  } catch {
    return null;
  }
}

function getDateTrigger(date: Date): Notifications.DateTriggerInput {
  const trigger: Notifications.DateTriggerInput = {
    date,
    type: Notifications.SchedulableTriggerInputTypes.DATE,
  };

  if (Platform.OS === 'android') {
    trigger.channelId = REMINDER_CHANNEL_ID;
  }

  return trigger;
}

function getPurchaseIdFromReminderIdentifier(identifier: string) {
  if (
    identifier.startsWith('rettrack:due-today:') ||
    identifier.startsWith('rettrack:pending-digest:') ||
    identifier.startsWith('rettrack:return-seven-days:') ||
    identifier.startsWith('rettrack:return-three-days:')
  ) {
    return null;
  }

  const [, purchaseId] = identifier.match(/^rettrack:(.*):[^:]+$/) ?? [];

  return purchaseId ?? identifier;
}
