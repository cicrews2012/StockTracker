import { test } from 'node:test';
import assert from 'node:assert/strict';

import { addMonths, daysBetween, previousBusinessDay } from '../src/logic/dates.js';
import { estimateNextExDate, exDividendWindow, inferFrequency } from '../src/logic/dividends.js';
import { evaluateSafeGrowth } from '../src/logic/safeGrowth.js';
import { simulateDrip } from '../src/logic/drip.js';
import { sizePosition } from '../src/logic/sizing.js';
import { mockDividendHistory, mockFundamentals, mockQuote } from '../src/api/mock.js';

// ---------- dates ----------
test('addMonths clamps to month end', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(addMonths('2026-11-15', 3), '2027-02-15');
});

test('previousBusinessDay skips weekends', () => {
  assert.equal(previousBusinessDay('2026-10-05'), '2026-10-02'); // Mon → Fri
  assert.equal(previousBusinessDay('2026-10-07'), '2026-10-06'); // Wed → Tue
});

// ---------- dividends ----------
test('inferFrequency recognises monthly, quarterly, semi-annual, annual', () => {
  assert.equal(inferFrequency(['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01']), 12);
  assert.equal(inferFrequency(['2025-03-14', '2025-06-13', '2025-09-15', '2025-12-01']), 4);
  assert.equal(inferFrequency(['2025-03-01', '2025-09-01', '2026-03-01']), 2);
  assert.equal(inferFrequency(['2024-05-01', '2025-05-01']), 1);
  assert.equal(inferFrequency([]), 0);
});

test('estimateNextExDate steps forward from the last ex-date', () => {
  assert.equal(estimateNextExDate('2026-06-15', 4, '2026-10-03'), '2026-12-15');
  // lands on a Saturday → rolls to Monday
  assert.equal(estimateNextExDate('2026-07-10', 4, '2026-10-03'), '2026-10-12');
  assert.equal(estimateNextExDate(null, 4, '2026-10-03'), null);
});

test('exDividendWindow: buy-by is the trading day before the ex-date', () => {
  // Today Sat 2026-10-03, ex-date Wed 2026-10-07 → buy by Tue 10-06, 3 days left
  const w = exDividendWindow('2026-10-07', '2026-10-03');
  assert.equal(w.buyBy, '2026-10-06');
  assert.equal(w.daysToBuy, 3);
  assert.equal(w.daysToEx, 4);
  assert.equal(w.status, 'urgent');

  // Ex-date on Monday → buy by previous Friday
  const mon = exDividendWindow('2026-10-12', '2026-10-03');
  assert.equal(mon.buyBy, '2026-10-09');
  assert.equal(mon.daysToBuy, 6);
  assert.equal(mon.status, 'soon');
  assert.equal(exDividendWindow('2026-10-30', '2026-10-03').status, 'upcoming');
});

test('exDividendWindow statuses at the edges', () => {
  assert.equal(exDividendWindow('2026-10-07', '2026-10-06').status, 'last-day');
  assert.equal(exDividendWindow('2026-10-07', '2026-10-07').status, 'missed');
  assert.equal(exDividendWindow('2026-10-07', '2026-10-08').status, 'passed');
  assert.equal(exDividendWindow('2026-10-14', '2026-10-06').status, 'soon');
});

// ---------- safe growth ----------
test('profitable, growing, fairly valued stock is Safe Growth', () => {
  const r = evaluateSafeGrowth({ netMargin: 20, epsGrowth5Y: 8, epsGrowthTTM: 5, pe: 18, payoutRatio: 50, beta: 0.7, dividendPerShare: 2 });
  assert.equal(r.rating, 'safe');
  assert.equal(r.score, 6);
});

test('unprofitable company can never be Safe Growth', () => {
  const r = evaluateSafeGrowth({ netMargin: -2, epsGrowth5Y: 8, epsGrowthTTM: 5, pe: 18, payoutRatio: 50, beta: 0.7, dividendPerShare: 2 });
  assert.notEqual(r.rating, 'safe');
});

test('missing data is skipped, and too little data is "unknown"', () => {
  const r = evaluateSafeGrowth({ netMargin: 10, pe: 15 });
  assert.equal(r.rating, 'unknown');
  const nonPayer = evaluateSafeGrowth({ netMargin: 10, epsGrowth5Y: 5, epsGrowthTTM: 1, pe: 20, beta: 1, payoutRatio: 0, dividendPerShare: 0 });
  assert.equal(nonPayer.checks.find((c) => c.id === 'payoutRatio').pass, null);
  assert.equal(nonPayer.rating, 'safe');
});

test('weak fundamentals rate as higher risk', () => {
  const r = evaluateSafeGrowth({ netMargin: 5, epsGrowth5Y: -5, epsGrowthTTM: -30, pe: 60, payoutRatio: 150, beta: 1.5, dividendPerShare: 1 });
  assert.equal(r.rating, 'risky');
});

// ---------- DRIP ----------
test('DRIP with flat price: first payout buys shares × dps/freq ÷ price', () => {
  const r = simulateDrip({ shares: 10, price: 50, annualDividend: 2, frequency: 4, years: 1 });
  // quarterly payout = 10 × 0.5 = $5 → 0.1 share at $50
  assert.equal(r.firstPayout.month, 3);
  assert.ok(Math.abs(r.firstPayout.sharesBought - 0.1) < 1e-9);
  assert.equal(r.milestones.tenthShare, 3);
  assert.ok(r.summary.endShares > 10.4 && r.summary.endShares < 10.42);
});

test('DRIP full-share milestone matches a hand calculation', () => {
  // 4% yield paid monthly on 100 shares at $25: ~0.333 share/month → 1 share after month 3
  const r = simulateDrip({ shares: 100, price: 25, annualDividend: 1, frequency: 12, years: 5 });
  assert.equal(r.milestones.fullShare, 3);
});

test('DRIP off: shares stay flat, dividends counted as cash', () => {
  const r = simulateDrip({ shares: 10, price: 50, annualDividend: 2, frequency: 4, years: 2, reinvest: false });
  assert.equal(r.summary.endShares, 10);
  assert.equal(r.summary.cashDividends, 40);
});

test('DRIP handles zero inputs without crashing', () => {
  const r = simulateDrip({ shares: 0, price: 0, annualDividend: 0, frequency: 4, years: 5 });
  assert.equal(r.summary.endShares, 0);
  assert.equal(r.milestones.fullShare, null);
});

// ---------- position sizing ----------
test('$100 pool, 20% cap → $20 budget, fractional shares of a $70 stock', () => {
  const s = sizePosition({ pool: 100, price: 70, maxPositionPct: 20, riskPct: 2, stopLossPct: 10 });
  assert.equal(s.budget, 20);
  assert.equal(s.limitedBy, 'allocation');
  assert.equal(s.whole.shares, 0);
  assert.equal(s.canAffordWhole, false);
  assert.equal(s.fractional.shares, 0.2857);
});

test('risk cap wins when the stop-loss is wide', () => {
  // risk 2% of $100 = $2; at a 20% stop → $10 position max
  const s = sizePosition({ pool: 100, price: 5, maxPositionPct: 50, riskPct: 2, stopLossPct: 20 });
  assert.equal(s.budget, 10);
  assert.equal(s.limitedBy, 'risk');
  assert.equal(s.whole.shares, 2);
  assert.equal(s.whole.leftover, 0);
});

// ---------- mock data ----------
test('mock data is well-formed for known and unknown tickers', () => {
  for (const sym of ['KO', 'ZZZZ']) {
    const q = mockQuote(sym);
    assert.ok(q.price > 0);
    assert.ok(Number.isFinite(q.changePct));
    const f = mockFundamentals(sym);
    assert.ok('netMargin' in f);
  }
  const hist = mockDividendHistory('KO', '2026-10-03');
  assert.ok(hist.length >= 4);
  assert.ok(hist.at(-1).exDate >= '2026-10-03');
  assert.equal(inferFrequency(hist.map((h) => h.exDate)), 4);
  assert.equal(daysBetween('2026-10-03', hist.at(-1).exDate) >= 4, true);
});
