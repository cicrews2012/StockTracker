// Date helpers that work on plain 'YYYY-MM-DD' strings.
// Everything is computed at UTC midnight so daylight-saving shifts never
// turn "3 days left" into "2.96 days left".

const DAY_MS = 86_400_000;

export function toISODate(date) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return toISODate(new Date());
}

export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUTC(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso, days) {
  return fromUTC(new Date(parseISO(iso).getTime() + days * DAY_MS));
}

/** Adds whole months, clamping to the last day of shorter months (Jan 31 + 1m → Feb 28/29). */
export function addMonths(iso, months) {
  const d = parseISO(iso);
  const targetMonth = d.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return fromUTC(new Date(Date.UTC(d.getUTCFullYear(), targetMonth, day)));
}

/** Calendar days from `fromIso` to `toIso` (negative when `toIso` is in the past). */
export function daysBetween(fromIso, toIso) {
  return Math.round((parseISO(toIso) - parseISO(fromIso)) / DAY_MS);
}

export function isWeekend(iso) {
  const dow = parseISO(iso).getUTCDay();
  return dow === 0 || dow === 6;
}

/** The trading day before `iso` (skips weekends; exchange holidays are not modelled). */
export function previousBusinessDay(iso) {
  let d = addDays(iso, -1);
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

/** Rolls a weekend date forward to Monday. */
export function nextBusinessDayOnOrAfter(iso) {
  let d = iso;
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
}
