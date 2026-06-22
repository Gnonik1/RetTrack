import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOME_REMINDER_NUDGE_DAY_TARGET = 4;
export const HOME_REMINDER_NUDGE_STORAGE_KEY_PREFIX =
  'rettrack:homeReminderNudge:v1';

export type HomeReminderNudgeState = {
  eligibleDayCount: number;
  lastEligibleLocalDate: string | null;
  lastPresentedAt: string | null;
  schemaVersion: 1;
};

export const DEFAULT_HOME_REMINDER_NUDGE_STATE: HomeReminderNudgeState = {
  eligibleDayCount: 0,
  lastEligibleLocalDate: null,
  lastPresentedAt: null,
  schemaVersion: 1,
};

type HomeReminderNudgeAdvanceResult = {
  shouldPresent: boolean;
  state: HomeReminderNudgeState;
};

function createDefaultHomeReminderNudgeState(): HomeReminderNudgeState {
  return { ...DEFAULT_HOME_REMINDER_NUDGE_STATE };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidLocalDayKey(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsedDate = new Date(0);

  parsedDate.setUTCHours(0, 0, 0, 0);
  parsedDate.setUTCFullYear(year, month - 1, day);

  return (
    parsedDate.getUTCFullYear() === year &&
    parsedDate.getUTCMonth() === month - 1 &&
    parsedDate.getUTCDate() === day
  );
}

function isValidIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const parsedDate = new Date(value);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString() === value
  );
}

function clampEligibleDayCount(value: number) {
  return Math.min(
    HOME_REMINDER_NUDGE_DAY_TARGET - 1,
    Math.max(0, value),
  );
}

export function getHomeReminderNudgeStorageKey(scopeKey: string): string {
  return `${HOME_REMINDER_NUDGE_STORAGE_KEY_PREFIX}:${scopeKey}`;
}

export function getLocalHomeDayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getDelayUntilNextLocalHomeDay(now = new Date()): number {
  const nextLocalDay = new Date(now);

  nextLocalDay.setHours(24, 0, 0, 0);

  const delay = nextLocalDay.getTime() - now.getTime();

  return Number.isFinite(delay) ? Math.max(0, delay) : 0;
}

export function parseStoredHomeReminderNudgeState(
  raw: string | null,
): HomeReminderNudgeState {
  if (raw === null) {
    return createDefaultHomeReminderNudgeState();
  }

  try {
    const parsedState: unknown = JSON.parse(raw);

    if (
      !isObjectRecord(parsedState) ||
      parsedState.schemaVersion !== 1 ||
      typeof parsedState.eligibleDayCount !== 'number' ||
      !Number.isFinite(parsedState.eligibleDayCount) ||
      !Number.isInteger(parsedState.eligibleDayCount) ||
      !(
        parsedState.lastEligibleLocalDate === null ||
        isValidLocalDayKey(parsedState.lastEligibleLocalDate)
      ) ||
      !(
        parsedState.lastPresentedAt === null ||
        isValidIsoTimestamp(parsedState.lastPresentedAt)
      )
    ) {
      return createDefaultHomeReminderNudgeState();
    }

    return {
      eligibleDayCount: clampEligibleDayCount(parsedState.eligibleDayCount),
      lastEligibleLocalDate: parsedState.lastEligibleLocalDate,
      lastPresentedAt: parsedState.lastPresentedAt,
      schemaVersion: 1,
    };
  } catch {
    return createDefaultHomeReminderNudgeState();
  }
}

export async function loadHomeReminderNudgeState(
  scopeKey: string,
): Promise<HomeReminderNudgeState> {
  const storedState = await AsyncStorage.getItem(
    getHomeReminderNudgeStorageKey(scopeKey),
  );

  return parseStoredHomeReminderNudgeState(storedState);
}

export async function saveHomeReminderNudgeState(
  scopeKey: string,
  state: HomeReminderNudgeState,
): Promise<void> {
  await AsyncStorage.setItem(
    getHomeReminderNudgeStorageKey(scopeKey),
    JSON.stringify(state),
  );
}

export function createResetHomeReminderNudgeState(
  now = new Date(),
): HomeReminderNudgeState {
  return {
    eligibleDayCount: 0,
    lastEligibleLocalDate: null,
    lastPresentedAt: now.toISOString(),
    schemaVersion: 1,
  };
}

export function advanceHomeReminderNudgeForEligibleDay(
  currentState: HomeReminderNudgeState,
  todayKey?: string,
  now = new Date(),
): HomeReminderNudgeAdvanceResult {
  const resolvedTodayKey = todayKey ?? getLocalHomeDayKey(now);

  if (
    !isValidLocalDayKey(resolvedTodayKey) ||
    resolvedTodayKey === currentState.lastEligibleLocalDate ||
    (currentState.lastEligibleLocalDate !== null &&
      resolvedTodayKey < currentState.lastEligibleLocalDate)
  ) {
    return {
      shouldPresent: false,
      state: currentState,
    };
  }

  const nextEligibleDayCount =
    clampEligibleDayCount(currentState.eligibleDayCount) + 1;

  if (nextEligibleDayCount >= HOME_REMINDER_NUDGE_DAY_TARGET) {
    return {
      shouldPresent: true,
      state: {
        eligibleDayCount: 0,
        lastEligibleLocalDate: resolvedTodayKey,
        lastPresentedAt: now.toISOString(),
        schemaVersion: 1,
      },
    };
  }

  return {
    shouldPresent: false,
    state: {
      ...currentState,
      eligibleDayCount: nextEligibleDayCount,
      lastEligibleLocalDate: resolvedTodayKey,
    },
  };
}
