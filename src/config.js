// User settings persisted in the browser's LocalStorage.
// Nothing here ever leaves the browser except the API keys, which are sent
// only to the provider they belong to (see src/api/*).

const STORAGE_KEY = 'stocktracker.settings.v1';

export const DEFAULT_SETTINGS = Object.freeze({
  finnhubKey: '',
  alpacaKeyId: '',
  alpacaSecret: '',
  forceMock: false,
  refreshMinutes: 15,
  watchlist: ['KO', 'JNJ', 'PG', 'MSFT', 'O', 'SCHD'],
  // Position sizer
  accountPool: 100,
  maxPositionPct: 20,
  riskPct: 2,
  stopLossPct: 10,
  // DRIP simulator defaults
  drip: {
    ticker: 'KO',
    shares: 10,
    years: 10,
    priceGrowthPct: 4,
    dividendGrowthPct: 4,
    monthlyContribution: 0,
    reinvest: true,
  },
  safeGrowth: {
    maxPE: 25,
    maxPayoutRatio: 75,
  },
});

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null; // private mode / blocked storage: app still works, just doesn't remember
  }
}

export function loadSettings() {
  const fallback = structuredClone(DEFAULT_SETTINGS);
  const raw = safeGet(STORAGE_KEY);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return sanitize({
      ...fallback,
      ...parsed,
      drip: { ...fallback.drip, ...(parsed.drip || {}) },
      safeGrowth: { ...fallback.safeGrowth, ...(parsed.safeGrowth || {}) },
    });
  } catch {
    return fallback;
  }
}

export function saveSettings(settings) {
  safeSet(STORAGE_KEY, JSON.stringify(sanitize(settings)));
}

export function clearAllData() {
  const s = storage();
  if (!s) return;
  Object.keys(s)
    .filter((k) => k.startsWith('stocktracker.'))
    .forEach((k) => s.removeItem(k));
}

export function hasFinnhub(settings) {
  return !settings.forceMock && settings.finnhubKey.trim().length > 0;
}

export function hasAlpaca(settings) {
  return !settings.forceMock && settings.alpacaKeyId.trim().length > 0 && settings.alpacaSecret.trim().length > 0;
}

export function normalizeTicker(t) {
  return String(t || '').trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 10);
}

function sanitize(s) {
  const watchlist = Array.isArray(s.watchlist) ? s.watchlist.map(normalizeTicker).filter(Boolean) : [];
  return {
    ...s,
    finnhubKey: String(s.finnhubKey || '').trim(),
    alpacaKeyId: String(s.alpacaKeyId || '').trim(),
    alpacaSecret: String(s.alpacaSecret || '').trim(),
    forceMock: Boolean(s.forceMock),
    refreshMinutes: clamp(Number(s.refreshMinutes) || 15, 1, 240),
    watchlist: [...new Set(watchlist)].slice(0, 30),
  };
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function safeGet(key) {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function safeSet(key, value) {
  try {
    storage()?.setItem(key, value);
  } catch {
    // quota exceeded or storage blocked — non-fatal
  }
}
