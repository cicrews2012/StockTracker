// Finnhub free tier client (https://finnhub.io/docs/api).
// Free plan: 60 calls/minute, US quotes, basic fundamentals (/stock/metric).
// Finnhub allows browser CORS, so calls go straight from the page.

import { ApiError, errorFromStatus } from './errors.js';

const BASE = 'https://finnhub.io/api/v1';
const WINDOW_MS = 60_000;
const MAX_CALLS_PER_WINDOW = 55; // stay just under the 60/min free limit

const callLog = [];
let throttledUntil = 0;
let rejectedKey = null; // after a 401/403, stop retrying the same key until it changes

async function request(path, params, apiKey) {
  if (!apiKey) throw new ApiError('No Finnhub API key configured', 'no-key');
  if (apiKey === rejectedKey) throw new ApiError('Finnhub rejected the API key', 'auth');
  const now = Date.now();
  if (now < throttledUntil) throw new ApiError('Finnhub rate limit cooling down', 'throttled');

  while (callLog.length && now - callLog[0] > WINDOW_MS) callLog.shift();
  if (callLog.length >= MAX_CALLS_PER_WINDOW) {
    throw new ApiError('Finnhub local rate budget used up for this minute', 'throttled');
  }
  callLog.push(now);

  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // Passed as a query parameter (not a custom header) so the browser sends a
  // simple CORS request with no preflight.
  url.searchParams.set('token', apiKey);

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new ApiError(`Finnhub unreachable: ${e.message}`, 'network');
  }
  if (res.status === 429) throttledUntil = Date.now() + WINDOW_MS;
  if (res.status === 401 || res.status === 403) rejectedKey = apiKey;
  if (!res.ok) throw errorFromStatus('Finnhub', res.status);
  return res.json();
}

/** Quote → { price, change, changePct, prevClose, high, low, open, marketTime } */
export async function fetchQuote(symbol, apiKey) {
  const q = await request('/quote', { symbol }, apiKey);
  // Unknown tickers come back as all zeros rather than a 404.
  if (!q || typeof q.c !== 'number' || (q.c === 0 && q.pc === 0)) {
    throw new ApiError(`Finnhub has no quote for ${symbol}`, 'not-found');
  }
  return {
    price: q.c,
    change: q.d ?? q.c - q.pc,
    changePct: q.dp ?? (q.pc ? ((q.c - q.pc) / q.pc) * 100 : 0),
    prevClose: q.pc,
    high: q.h,
    low: q.l,
    open: q.o,
    marketTime: q.t ? q.t * 1000 : null,
  };
}

/** Basic fundamentals mapped to the shape src/logic/safeGrowth.js expects. */
export async function fetchFundamentals(symbol, apiKey) {
  const data = await request('/stock/metric', { symbol, metric: 'all' }, apiKey);
  const m = data?.metric;
  if (!m || Object.keys(m).length === 0) throw new ApiError(`Finnhub has no fundamentals for ${symbol}`, 'not-found');
  const pick = (...keys) => {
    for (const k of keys) if (typeof m[k] === 'number' && Number.isFinite(m[k])) return m[k];
    return null;
  };
  return {
    netMargin: pick('netProfitMarginTTM', 'netProfitMarginAnnual', 'netProfitMargin5Y'),
    epsGrowth5Y: pick('epsGrowth5Y'),
    epsGrowthTTM: pick('epsGrowthTTMYoy', 'epsGrowthQuarterlyYoy'),
    pe: pick('peTTM', 'peBasicExclExtraTTM', 'peExclExtraTTM', 'peAnnual'),
    payoutRatio: pick('payoutRatioTTM', 'payoutRatioAnnual'),
    beta: pick('beta'),
    dividendPerShare: pick('dividendPerShareAnnual', 'dividendPerShareTTM', 'dividendsPerShareTTM'),
    dividendYield: pick('dividendYieldIndicatedAnnual', 'currentDividendYieldTTM'),
    dividendGrowth5Y: pick('dividendGrowthRate5Y'),
    week52High: pick('52WeekHigh'),
    week52Low: pick('52WeekLow'),
  };
}

/** Company name (optional nicety; failures are ignored by the caller). */
export async function fetchProfile(symbol, apiKey) {
  const p = await request('/stock/profile2', { symbol }, apiKey);
  return { name: p?.name || symbol, industry: p?.finnhubIndustry || '' };
}
