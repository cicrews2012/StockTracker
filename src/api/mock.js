// Mock market data — used when no API keys are set, when a provider is
// throttled, or when "Use mock data" is switched on in Settings.
//
// Values are illustrative approximations, NOT live data. Prices wiggle
// deterministically every 15 minutes and ex-dividend dates are placed relative
// to today so the alert banner always has something to show.

import { addDays, addMonths, nextBusinessDayOnOrAfter, todayISO } from '../logic/dates.js';

const MOCK = {
  KO:   { name: 'Coca-Cola Co',            price: 70.5,  dps: 2.04, freq: 4,  exOffset: 4,  f: { netMargin: 23.0, epsGrowth5Y: 6.1,  epsGrowthTTM: 8.0,   pe: 24.1, payoutRatio: 68, beta: 0.60 } },
  JNJ:  { name: 'Johnson & Johnson',       price: 160.2, dps: 5.08, freq: 4,  exOffset: 18, f: { netMargin: 18.2, epsGrowth5Y: 3.4,  epsGrowthTTM: 5.1,   pe: 17.3, payoutRatio: 55, beta: 0.50 } },
  PG:   { name: 'Procter & Gamble',        price: 165.8, dps: 4.13, freq: 4,  exOffset: 9,  f: { netMargin: 18.4, epsGrowth5Y: 6.0,  epsGrowthTTM: 4.2,   pe: 26.2, payoutRatio: 64, beta: 0.45 } },
  MSFT: { name: 'Microsoft Corp',          price: 430.1, dps: 3.32, freq: 4,  exOffset: 33, f: { netMargin: 36.1, epsGrowth5Y: 15.2, epsGrowthTTM: 12.4,  pe: 34.0, payoutRatio: 25, beta: 0.90 } },
  O:    { name: 'Realty Income Corp',      price: 58.3,  dps: 3.18, freq: 12, exOffset: 2,  f: { netMargin: 12.0, epsGrowth5Y: -3.0, epsGrowthTTM: -12.0, pe: 55.0, payoutRatio: 290, beta: 0.85 } },
  SCHD: { name: 'Schwab US Dividend ETF',  price: 28.1,  dps: 1.00, freq: 4,  exOffset: 55, f: { netMargin: null, epsGrowth5Y: null, epsGrowthTTM: null,  pe: 16.0, payoutRatio: null, beta: 0.80 } },
  PEP:  { name: 'PepsiCo Inc',             price: 155.4, dps: 5.69, freq: 4,  exOffset: 25, f: { netMargin: 10.1, epsGrowth5Y: 5.2,  epsGrowthTTM: -2.0,  pe: 22.0, payoutRatio: 75, beta: 0.55 } },
  VZ:   { name: 'Verizon Communications',  price: 42.0,  dps: 2.71, freq: 4,  exOffset: 12, f: { netMargin: 7.0,  epsGrowth5Y: -1.0, epsGrowthTTM: -20.0, pe: 10.0, payoutRatio: 97, beta: 0.40 } },
  T:    { name: 'AT&T Inc',                price: 22.0,  dps: 1.11, freq: 4,  exOffset: 40, f: { netMargin: 5.0,  epsGrowth5Y: -5.0, epsGrowthTTM: 3.0,   pe: 17.0, payoutRatio: 70, beta: 0.60 } },
  AAPL: { name: 'Apple Inc',               price: 230.0, dps: 1.04, freq: 4,  exOffset: 60, f: { netMargin: 24.0, epsGrowth5Y: 15.0, epsGrowthTTM: 10.0,  pe: 35.0, payoutRatio: 15, beta: 1.20 } },
};

export const MOCK_TICKERS = Object.keys(MOCK);

/** Small deterministic hash → [0, 1). */
function rand(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** Unknown tickers get a plausible, stable synthetic profile so the UI still works. */
function synth(symbol) {
  if (MOCK[symbol]) return MOCK[symbol];
  const r = (k) => rand(symbol + k);
  const price = Math.round((15 + r('p') * 285) * 100) / 100;
  const pays = r('d') > 0.35;
  const dps = pays ? Math.round(price * (0.01 + r('y') * 0.04) * 100) / 100 : 0;
  return {
    name: `${symbol} (simulated)`,
    price,
    dps,
    freq: pays ? (r('m') > 0.9 ? 12 : 4) : 0,
    exOffset: Math.floor(r('x') * 80) + 1,
    f: {
      netMargin: Math.round((r('nm') * 40 - 8) * 10) / 10,
      epsGrowth5Y: Math.round((r('e5') * 30 - 8) * 10) / 10,
      epsGrowthTTM: Math.round((r('et') * 50 - 20) * 10) / 10,
      pe: Math.round((8 + r('pe') * 40) * 10) / 10,
      payoutRatio: pays ? Math.round(r('pr') * 110) : null,
      beta: Math.round((0.3 + r('b') * 1.4) * 100) / 100,
    },
  };
}

export function mockQuote(symbol, now = Date.now()) {
  const m = synth(symbol);
  const bucket = Math.floor(now / (15 * 60_000));
  const day = todayISO();
  const prevClose = round2(m.price * (1 + (rand(`${symbol}|pc|${day}`) - 0.5) * 0.02));
  const price = round2(prevClose * (1 + (rand(`${symbol}|q|${bucket}`) - 0.5) * 0.03));
  return {
    price,
    change: round2(price - prevClose),
    changePct: ((price - prevClose) / prevClose) * 100,
    prevClose,
    high: round2(Math.max(price, prevClose) * 1.004),
    low: round2(Math.min(price, prevClose) * 0.996),
    open: prevClose,
    marketTime: now,
  };
}

export function mockFundamentals(symbol) {
  const m = synth(symbol);
  return {
    ...m.f,
    dividendPerShare: m.dps,
    dividendYield: m.price ? (m.dps / m.price) * 100 : 0,
    dividendGrowth5Y: null,
    week52High: round2(m.price * 1.15),
    week52Low: round2(m.price * 0.82),
  };
}

export function mockProfile(symbol) {
  return { name: synth(symbol).name, industry: '' };
}

/** Same shape as alpaca.fetchCashDividends() for one symbol. */
export function mockDividendHistory(symbol, today = todayISO()) {
  const m = synth(symbol);
  if (!m.freq || !m.dps) return [];
  const interval = Math.round(12 / m.freq);
  const next = nextBusinessDayOnOrAfter(addDays(today, m.exOffset));
  const rate = round4(m.dps / m.freq);
  const rows = [];
  for (let k = -Math.ceil(12 / interval); k <= 0; k++) {
    const ex = k === 0 ? next : nextBusinessDayOnOrAfter(addMonths(next, k * interval));
    rows.push({ exDate: ex, recordDate: addDays(ex, 0), payDate: addDays(ex, 21), rate, special: false });
  }
  return rows;
}

export function mockFrequency(symbol) {
  return synth(symbol).freq;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
function round4(n) {
  return Math.round(n * 10000) / 10000;
}
