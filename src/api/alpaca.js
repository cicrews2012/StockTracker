// Alpaca Market Data client — used for the dividend calendar.
// Alpaca's free "Basic" plan includes the corporate-actions endpoint, which
// lists announced cash dividends with their ex-date, record date and pay date.
//
// Alpaca's data API doesn't support browser CORS, so requests go through the
// tiny proxy in server.js (/proxy/alpaca/...). Keys are forwarded as headers on
// each request and are never stored by the server.

import { ApiError, errorFromStatus } from './errors.js';
import { addDays, todayISO } from '../logic/dates.js';

const PROXY_BASE = '/proxy/alpaca';

/**
 * Cash dividends for the given symbols from ~13 months ago to ~4 months ahead.
 * @returns {Promise<Record<string, Array<{exDate, recordDate, payDate, rate, special}>>>}
 */
export async function fetchCashDividends(symbols, keyId, secret) {
  if (!keyId || !secret) throw new ApiError('No Alpaca keys configured', 'no-key');
  if (!symbols.length) return {};

  const today = todayISO();
  const params = new URLSearchParams({
    symbols: symbols.join(','),
    types: 'cash_dividend',
    start: addDays(today, -400),
    end: addDays(today, 120),
    limit: '1000',
    sort: 'asc',
  });

  const out = Object.fromEntries(symbols.map((s) => [s, []]));
  let pageToken = null;
  let pages = 0;
  do {
    if (pageToken) params.set('page_token', pageToken);
    let res;
    try {
      res = await fetch(`${PROXY_BASE}/v1/corporate-actions?${params}`, {
        headers: { 'APCA-API-KEY-ID': keyId, 'APCA-API-SECRET-KEY': secret },
      });
    } catch (e) {
      throw new ApiError(`Alpaca proxy unreachable: ${e.message}`, 'network');
    }
    if (res.status === 404) {
      throw new ApiError('Alpaca proxy not found — start the app with "node server.js" to enable Alpaca', 'not-found');
    }
    if (!res.ok) throw errorFromStatus('Alpaca', res.status);
    const body = await res.json();
    const rows = body?.corporate_actions?.cash_dividends ?? [];
    for (const r of rows) {
      if (!out[r.symbol]) out[r.symbol] = [];
      out[r.symbol].push({
        exDate: r.ex_date,
        recordDate: r.record_date ?? null,
        payDate: r.payable_date ?? null,
        rate: Number(r.rate) || 0,
        special: Boolean(r.special),
      });
    }
    pageToken = body?.next_page_token || null;
    pages++;
  } while (pageToken && pages < 10);

  return out;
}
