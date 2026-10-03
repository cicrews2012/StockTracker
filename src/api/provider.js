// Data provider facade.
//
// For each piece of data: try the real API → on failure, reuse the last good
// real response from cache (even if stale) → otherwise fall back to mock data.
// Every result carries `source` ('live' | 'cache' | 'mock') and `fetchedAt`,
// which drive the freshness badges in the UI.

import * as finnhub from './finnhub.js';
import * as alpaca from './alpaca.js';
import * as mock from './mock.js';
import { hasAlpaca, hasFinnhub, safeGet, safeSet } from '../config.js';
import { estimateNextExDate, inferFrequency } from '../logic/dividends.js';
import { todayISO } from '../logic/dates.js';

const CACHE_KEY = 'stocktracker.cache.v1';
const HOUR = 3_600_000;
const TTL = {
  fundamentals: 12 * HOUR,
  profile: 7 * 24 * HOUR,
  dividends: 6 * HOUR,
};

let cache = readCache();

function readCache() {
  try {
    return JSON.parse(safeGet(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}
function writeCache() {
  safeSet(CACHE_KEY, JSON.stringify(cache));
}
export function clearCache() {
  cache = {};
  writeCache();
}

/**
 * Generic "real → cache → mock" resolver.
 * @param {string} key cache key
 * @param {number} ttl ms a cached real value counts as fresh
 * @param {boolean} enabled whether the real provider is configured
 * @param {() => Promise<any>} fetchReal
 * @param {() => any} fetchMock
 * @param {Set<string>} warnings collects user-facing fallback messages
 * @param {boolean} force skip a fresh cache hit
 */
async function resolve({ key, ttl, enabled, fetchReal, fetchMock, warnings, force }) {
  const hit = cache[key];
  if (enabled && hit && !force && Date.now() - hit.at < ttl) {
    return { data: hit.data, source: 'live', fetchedAt: hit.at };
  }
  if (enabled) {
    try {
      const data = await fetchReal();
      cache[key] = { at: Date.now(), data };
      writeCache();
      return { data, source: 'live', fetchedAt: cache[key].at };
    } catch (e) {
      if (e.kind !== 'not-found') warnings.add(e.message);
      if (hit) return { data: hit.data, source: 'cache', fetchedAt: hit.at, error: e.message };
      return { data: fetchMock(), source: 'mock', fetchedAt: Date.now(), error: e.message };
    }
  }
  return { data: fetchMock(), source: 'mock', fetchedAt: Date.now() };
}

/**
 * Loads everything the UI needs for the whole watchlist.
 * @returns {Promise<{ rows: object[], warnings: string[], mode: 'live'|'partial'|'mock' }>}
 */
export async function loadWatchlist(settings, { force = false } = {}) {
  const warnings = new Set();
  const symbols = settings.watchlist;
  const useFinnhub = hasFinnhub(settings);
  const useAlpaca = hasAlpaca(settings);

  const calendar = await loadDividendCalendar(symbols, settings, useAlpaca, warnings, force);

  const rows = [];
  // Sequential on purpose: keeps us comfortably inside Finnhub's per-minute budget.
  for (const symbol of symbols) {
    const key = settings.finnhubKey;
    const quote = await resolve({
      key: `quote:${symbol}`,
      ttl: settings.refreshMinutes * 60_000,
      enabled: useFinnhub,
      fetchReal: () => finnhub.fetchQuote(symbol, key),
      fetchMock: () => mock.mockQuote(symbol),
      warnings,
      force,
    });
    const fundamentals = await resolve({
      key: `fund:${symbol}`,
      ttl: TTL.fundamentals,
      enabled: useFinnhub,
      fetchReal: () => finnhub.fetchFundamentals(symbol, key),
      fetchMock: () => mock.mockFundamentals(symbol),
      warnings,
      force: false,
    });
    const profile = await resolve({
      key: `profile:${symbol}`,
      ttl: TTL.profile,
      enabled: useFinnhub,
      fetchReal: () => finnhub.fetchProfile(symbol, key),
      fetchMock: () => mock.mockProfile(symbol),
      warnings: new Set(), // a missing company name is not worth a toast
      force: false,
    });

    rows.push({
      symbol,
      name: profile.data.name,
      quote,
      fundamentals,
      dividend: buildDividendInfo(symbol, quote.data, fundamentals.data, calendar[symbol]),
    });
  }

  const sources = rows.flatMap((r) => [r.quote.source, r.fundamentals.source, r.dividend.source]);
  const mode = sources.every((s) => s === 'mock') ? 'mock' : sources.some((s) => s === 'mock') ? 'partial' : 'live';
  return { rows, warnings: [...warnings], mode, loadedAt: Date.now() };
}

async function loadDividendCalendar(symbols, settings, useAlpaca, warnings, force) {
  const result = {};
  let remote = null;
  if (useAlpaca && symbols.length) {
    const key = `divs:${[...symbols].sort().join(',')}`;
    remote = await resolve({
      key,
      ttl: TTL.dividends,
      enabled: true,
      fetchReal: () => alpaca.fetchCashDividends(symbols, settings.alpacaKeyId, settings.alpacaSecret),
      fetchMock: () => null,
      warnings,
      force,
    });
  }
  for (const s of symbols) {
    if (remote && remote.data) {
      result[s] = { history: remote.data[s] || [], source: remote.source, fetchedAt: remote.fetchedAt };
    } else {
      result[s] = { history: mock.mockDividendHistory(s), source: 'mock', fetchedAt: Date.now() };
    }
  }
  return result;
}

function buildDividendInfo(symbol, quote, fundamentals, cal) {
  const today = todayISO();
  const history = [...(cal?.history || [])].sort((a, b) => a.exDate.localeCompare(b.exDate));
  const regular = history.filter((h) => !h.special);

  let frequency = inferFrequency(regular.map((h) => h.exDate));
  if (!regular.length) frequency = cal?.source === 'mock' ? mock.mockFrequency(symbol) : 0;

  const lastRegular = regular[regular.length - 1];
  let annual = fundamentals?.dividendPerShare;
  if (!(annual > 0) && lastRegular && frequency) annual = lastRegular.rate * frequency;
  annual = annual > 0 ? annual : 0;

  const upcoming = history.find((h) => h.exDate >= today);
  const past = regular.filter((h) => h.exDate < today);
  let next = null;
  let dateQuality = 'none';
  if (upcoming) {
    next = upcoming;
    dateQuality = cal.source === 'mock' ? 'sample' : 'announced';
  } else if (past.length && frequency) {
    const last = past[past.length - 1];
    next = { exDate: estimateNextExDate(last.exDate, frequency, today), rate: last.rate, payDate: null, special: false };
    dateQuality = cal.source === 'mock' ? 'sample' : 'estimated';
  }

  const price = quote?.price || 0;
  return {
    annual,
    perPayout: frequency ? annual / frequency : 0,
    frequency: annual > 0 ? frequency || 4 : 0,
    yieldPct: price > 0 ? (annual / price) * 100 : 0,
    next,
    dateQuality, // 'announced' | 'estimated' | 'sample' | 'none'
    history,
    source: cal?.source || 'mock',
    fetchedAt: cal?.fetchedAt || Date.now(),
  };
}
