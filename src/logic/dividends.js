import {
  addMonths,
  daysBetween,
  nextBusinessDayOnOrAfter,
  previousBusinessDay,
  todayISO,
} from './dates.js';

export const FREQUENCY_LABELS = {
  12: 'Monthly',
  4: 'Quarterly',
  2: 'Semi-annual',
  1: 'Annual',
  0: 'None',
};

export function frequencyLabel(freq) {
  return FREQUENCY_LABELS[freq] ?? `${freq}× / year`;
}

/**
 * Infers how many times per year a company pays from a list of past ex-dates
 * (ISO strings). Looks at the median gap between payouts, which is robust to a
 * single special dividend.
 */
export function inferFrequency(exDates) {
  const sorted = [...new Set(exDates)].sort();
  if (sorted.length < 2) return sorted.length === 1 ? 4 : 0; // one data point: assume quarterly
  const gaps = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median <= 45) return 12;
  if (median <= 135) return 4;
  if (median <= 270) return 2;
  return 1;
}

/**
 * Projects the next ex-dividend date on or after `today` by stepping forward
 * from a known past ex-date at the payout interval. Weekend results roll to Monday.
 */
export function estimateNextExDate(lastExDate, frequency, today = todayISO()) {
  if (!lastExDate || !frequency) return null;
  const step = Math.round(12 / frequency);
  let n = 0;
  let candidate = lastExDate;
  while (candidate < today && n < 1200) {
    n += step;
    candidate = addMonths(lastExDate, n);
  }
  return nextBusinessDayOnOrAfter(candidate);
}

/**
 * Works out the buy deadline for an ex-dividend date.
 *
 * You must own the stock *before* the ex-date to receive the dividend. With
 * T+1 settlement, buying any time up to the close of the trading day before the
 * ex-date qualifies. Selling on or after the ex-date still keeps the payout.
 */
export function exDividendWindow(exDate, today = todayISO()) {
  if (!exDate) return null;
  const buyBy = previousBusinessDay(exDate);
  const daysToEx = daysBetween(today, exDate);
  const daysToBuy = daysBetween(today, buyBy);
  let status;
  if (daysToEx < 0) status = 'passed';
  else if (daysToBuy < 0) status = 'missed'; // ex-date is today: too late to buy, holders still qualify
  else if (daysToBuy === 0) status = 'last-day';
  else if (daysToBuy <= 3) status = 'urgent';
  else if (daysToBuy <= 10) status = 'soon';
  else status = 'upcoming';
  return { exDate, buyBy, daysToEx, daysToBuy, status };
}

/** Per-payout amount given an annual dividend and payout frequency. */
export function perPayout(annualDps, frequency) {
  return frequency > 0 ? annualDps / frequency : 0;
}

/** Dividend yield in percent. */
export function dividendYield(annualDps, price) {
  return price > 0 ? (annualDps / price) * 100 : 0;
}
