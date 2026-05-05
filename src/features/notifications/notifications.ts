import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MockPurchase } from '../purchases/data/mockPurchases';
import { getPurchaseReturnDate } from '../purchases/utils/purchaseDates';

const REMINDER_CHANNEL_ID = 'rettrack-reminders';
const REMINDER_MINUTE = 0;
const FUTURE_RETURN_REMINDER_HOUR = 10;
const LAST_DAY_REMINDER_HOUR = 9;
const NEAR_FUTURE_REMINDER_DELAY_MS = 60 * 1000;
const PENDING_SOON_DELAY_MS = 60 * 1000;
const QUIET_HOUR_END = 9;
const QUIET_HOUR_START = 21;

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

type ReturnReminderPlanOptions = {
  skipDueTodayLastDayReminder?: boolean;
};

type RescheduleAllPurchaseRemindersOptions = {
  immediatePendingPurchaseIds?: string[];
};

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

export async function schedulePurchaseReminders(purchase: MockPurchase) {
  await cancelPurchaseReminders(purchase.id);

  if (purchase.status !== 'active') {
    return [];
  }

  const canSchedule = await canScheduleNotifications();

  if (!canSchedule) {
    return [];
  }

  return scheduleReminderPlans(getReturnReminderPlans(purchase, new Date()));
}

export async function rescheduleAllPurchaseReminders(
  purchases: MockPurchase[],
  _options: RescheduleAllPurchaseRemindersOptions = {},
) {
  const now = new Date();

  await cancelAllScheduledAppReminders();

  const canSchedule = await canScheduleNotifications();

  if (!canSchedule) {
    return [];
  }

  const dueTodayPurchases = purchases.filter(
    (purchase) =>
      purchase.status === 'active' && isPurchaseDueToday(purchase, now),
  );
  const dueTodayPurchaseIds = new Set(
    dueTodayPurchases.map((purchase) => purchase.id),
  );
  const pendingPurchases = purchases.filter(
    (purchase) => purchase.status === 'pending',
  );
  const reminderPlans = purchases.flatMap((purchase) => {
    if (purchase.status === 'active') {
      return getReturnReminderPlans(purchase, now, {
        skipDueTodayLastDayReminder: dueTodayPurchaseIds.has(purchase.id),
      });
    }

    return [];
  });
  const dueTodayReminderPlan = getDueTodayReminderPlan(dueTodayPurchases, now);
  const pendingDigestReminderPlans = getPendingDigestReminderPlans(
    pendingPurchases,
    now,
  );

  if (dueTodayReminderPlan) {
    reminderPlans.push(dueTodayReminderPlan);
  }

  reminderPlans.push(...pendingDigestReminderPlans);

  return scheduleReminderPlans(reminderPlans);
}

function cancelScheduledReminder(identifier: string) {
  return Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {
    // A missing or unavailable scheduled notification should not block UI flow.
  });
}

function cancelAllScheduledAppReminders() {
  return Notifications.cancelAllScheduledNotificationsAsync().catch(() => {
    // Reconcile should keep working even if the native scheduler is unavailable.
  });
}

async function canScheduleNotifications() {
  const status = await getNotificationPermissionsStatus();

  return Boolean(status?.granted);
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

function getItemName(purchase: MockPurchase) {
  return purchase.itemName.trim() || 'this item';
}

function getReturnReminderPlans(
  purchase: MockPurchase,
  now: Date,
  options: ReturnReminderPlanOptions = {},
) {
  const returnDate = getPurchaseReturnDate(purchase);

  if (!returnDate) {
    return [];
  }

  const itemName = getItemName(purchase);
  const reminderPlans: ReminderPlan[] = [
    {
      body: `7 days left to return ${itemName}.`,
      date: getReturnReminderDate(returnDate, 7, FUTURE_RETURN_REMINDER_HOUR),
      identifier: getReminderIdentifier(purchase.id, 'return-seven-days'),
      kind: 'return-seven-days',
      title: 'Return reminder',
    },
    {
      body: `3 days left to return ${itemName}.`,
      date: getReturnReminderDate(returnDate, 3, FUTURE_RETURN_REMINDER_HOUR),
      identifier: getReminderIdentifier(purchase.id, 'return-three-days'),
      kind: 'return-three-days',
      title: 'Return window closing',
    },
  ];
  const lastDayReminderDate = getLastDayReminderDate(returnDate, now);

  if (
    lastDayReminderDate &&
    !(
      options.skipDueTodayLastDayReminder &&
      isSameLocalDate(returnDate, now)
    )
  ) {
    reminderPlans.push({
      body: `Today is the last day to return ${itemName}.`,
      date: lastDayReminderDate,
      identifier: getReminderIdentifier(purchase.id, 'return-last-day'),
      kind: 'return-last-day',
      title: 'Last day to return',
    });
  }

  return reminderPlans.filter((plan) => isFutureDate(plan.date, now));
}

function getPendingDigestReminderPlans(
  pendingPurchases: MockPurchase[],
  now: Date,
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
      date: getImmediatePendingReminderDate(now),
      identifier: getPendingDigestReminderIdentifier('initial'),
      kind: 'pending-digest-initial',
      title: 'Still pending',
    },
    {
      body: pendingDigestBody,
      date: getPendingFollowUpDate(now, 3),
      identifier: getPendingDigestReminderIdentifier('3d'),
      kind: 'pending-digest-three-days',
      title: 'Still pending',
    },
    {
      body: pendingDigestBody,
      date: getPendingFollowUpDate(now, 7),
      identifier: getPendingDigestReminderIdentifier('7d'),
      kind: 'pending-digest-seven-days',
      title: 'Still pending',
    },
  ];

  return reminderPlans.filter((plan) => isFutureDate(plan.date, now));
}

function getPendingDigestReminderBody(pendingCount: number) {
  if (pendingCount === 1) {
    return '1 purchase needs a decision.';
  }

  return `${pendingCount} purchases need a decision.`;
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
  if (isBeforeQuietHourEnd(now)) {
    return atReminderTime(now, QUIET_HOUR_END);
  }

  if (isAtOrAfterQuietHourStart(now)) {
    return atReminderTime(addDays(now, 1), QUIET_HOUR_END);
  }

  const nearFutureDate = new Date(
    now.getTime() + PENDING_SOON_DELAY_MS,
  );

  return isWithinReminderHours(nearFutureDate)
    ? nearFutureDate
    : atReminderTime(addDays(now, 1), QUIET_HOUR_END);
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

function isPurchaseDueToday(purchase: MockPurchase, now: Date) {
  const returnDate = getPurchaseReturnDate(purchase);

  return Boolean(returnDate && isSameLocalDate(returnDate, now));
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

function getDueTodayReminderPlan(
  dueTodayPurchases: MockPurchase[],
  now: Date,
): ReminderPlan | null {
  if (dueTodayPurchases.length === 0) {
    return null;
  }

  const reminderDate = getDueTodayReminderDate(now);

  if (!reminderDate) {
    return null;
  }

  return {
    body: getDueTodayReminderBody(dueTodayPurchases),
    date: reminderDate,
    identifier: getDueTodayReminderIdentifier(now),
    kind: 'due-today-group',
    title: 'Last day to return',
  };
}

function getDueTodayReminderBody(dueTodayPurchases: MockPurchase[]) {
  const itemNames = dueTodayPurchases.map(getItemName);

  if (itemNames.length === 1) {
    return `Today is the last day to return ${itemNames[0]}.`;
  }

  if (itemNames.length === 2) {
    return `${itemNames[0]} and ${itemNames[1]} are due today.`;
  }

  if (itemNames.length === 3) {
    return `${itemNames[0]}, ${itemNames[1]}, and ${itemNames[2]} are due today.`;
  }

  return `${itemNames.length} items are due today. Open RetTrack to review them.`;
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
          source: 'rettrack-local-reminder',
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
    identifier.startsWith('rettrack:pending-digest:')
  ) {
    return null;
  }

  const [, purchaseId] = identifier.match(/^rettrack:(.*):[^:]+$/) ?? [];

  return purchaseId ?? identifier;
}
