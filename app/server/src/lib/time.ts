function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function nowIso() {
  return new Date().toISOString();
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseLocalDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDays(days: number, base = new Date()) {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

export function addDaysLocalIso(days: number, baseIso = todayIso()) {
  const next = parseLocalDate(baseIso);
  next.setDate(next.getDate() + days);
  return localDate(next);
}

export function todayIso() {
  return localDate(new Date());
}

export function startOfWeekIso(baseIso = todayIso()) {
  const base = parseLocalDate(baseIso);
  const day = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - day);
  return localDate(base);
}

export function startOfMonthIso(baseIso = todayIso()) {
  const base = parseLocalDate(baseIso);
  return localDate(new Date(base.getFullYear(), base.getMonth(), 1));
}
