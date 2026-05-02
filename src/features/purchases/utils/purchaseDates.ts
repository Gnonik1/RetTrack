const dayInMilliseconds = 24 * 60 * 60 * 1000;

const monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

type PurchaseReturnDateSource = {
  returnBy?: string;
  returnByDetail?: string;
  returnDateISO?: string;
};

type PurchaseDateSource = {
  dateISO?: string;
  displayDate?: string;
};

export type ReturnDateUrgency = {
  daysUntil: number | null;
  label: string;
  state: 'expired' | 'future' | 'today' | 'tomorrow' | 'unknown';
};

function getDateStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function parseLocalDateISO(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return null;
  }

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));

  return isValidDate(date) ? date : null;
}

function parseDisplayDate(value?: string) {
  const match = value?.match(/^([A-Z][a-z]{2})\s+(\d{1,2})(?:,\s+(\d{4}))?$/);

  if (!match) {
    return null;
  }

  const monthIndex = monthLabels.findIndex((month) => month === match[1]);
  const year = match[3] ? Number(match[3]) : new Date().getFullYear();
  const date = new Date(year, monthIndex, Number(match[2]));

  return monthIndex >= 0 && isValidDate(date) ? date : null;
}

export function toLocalDateISO(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatCompactDate(date: Date) {
  return `${monthLabels[date.getMonth()]} ${date.getDate()}`;
}

export function formatFullDate(date: Date) {
  return `${formatCompactDate(date)}, ${date.getFullYear()}`;
}

export function parsePurchaseDate({
  dateISO,
  displayDate,
}: PurchaseDateSource) {
  return parseLocalDateISO(dateISO) ?? parseDisplayDate(displayDate);
}

export function getPurchaseReturnDate(source: PurchaseReturnDateSource) {
  return (
    parseLocalDateISO(source.returnDateISO) ??
    parseDisplayDate(source.returnByDetail) ??
    parseDisplayDate(source.returnBy)
  );
}

export function getPurchaseReturnDateISO(source: PurchaseReturnDateSource) {
  const returnDate = getPurchaseReturnDate(source);

  return returnDate ? toLocalDateISO(returnDate) : undefined;
}

export function getCompactReturnDate(source: PurchaseReturnDateSource) {
  const returnDate = getPurchaseReturnDate(source);

  if (returnDate) {
    return formatCompactDate(returnDate);
  }

  return (source.returnBy ?? source.returnByDetail ?? '').split(',')[0].trim();
}

export function getFullReturnDate(source: PurchaseReturnDateSource) {
  const returnDate = getPurchaseReturnDate(source);

  if (returnDate) {
    return formatFullDate(returnDate);
  }

  return source.returnByDetail ?? source.returnBy ?? '';
}

export function getReturnDateUrgency(
  source: PurchaseReturnDateSource,
  today = new Date(),
): ReturnDateUrgency {
  const returnDate = getPurchaseReturnDate(source);

  if (!returnDate) {
    return {
      daysUntil: null,
      label: 'Due later',
      state: 'unknown',
    };
  }

  const daysUntil = Math.round(
    (getDateStart(returnDate).getTime() - getDateStart(today).getTime()) /
      dayInMilliseconds,
  );

  if (daysUntil < 0) {
    return {
      daysUntil,
      label: 'Return date passed',
      state: 'expired',
    };
  }

  if (daysUntil === 0) {
    return {
      daysUntil,
      label: 'Today',
      state: 'today',
    };
  }

  if (daysUntil === 1) {
    return {
      daysUntil,
      label: 'Tomorrow',
      state: 'tomorrow',
    };
  }

  return {
    daysUntil,
    label: `${daysUntil} days left`,
    state: 'future',
  };
}

export function getDateSortValue(source: PurchaseReturnDateSource) {
  return getPurchaseReturnDate(source)?.getTime() ?? Number.MAX_SAFE_INTEGER;
}
