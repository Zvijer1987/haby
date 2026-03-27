export function toLocalDateString(input?: Date | string | number | null) {
  const date = input == null ? new Date() : input instanceof Date ? new Date(input) : new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDate(value?: string | null) {
  if (!value) return null;
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
  if (!m) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function addDaysLocal(base: Date, days: number) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfWeekLocal(base: Date) {
  const next = new Date(base);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function startOfMonthLocal(base: Date) {
  const next = new Date(base.getFullYear(), base.getMonth(), 1);
  next.setHours(0, 0, 0, 0);
  return next;
}
