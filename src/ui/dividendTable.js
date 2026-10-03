import { esc, money, pct, shortDate } from './format.js';
import { dateQualityTag, freshnessBadge } from './badges.js';
import { frequencyLabel } from '../logic/dividends.js';

export function mountDividendTable(el) {
  el.innerHTML = `
    <div class="mb-4 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-lg font-semibold text-white">Dividend tracker</h2>
        <p class="text-xs text-slate-400">Annual dividend, yield, payout cycle and the next ex-dividend date. The last column shows yearly income per $100 invested.</p>
      </div>
      <div data-source></div>
    </div>
    <div class="relative overflow-x-auto -mx-4 sm:mx-0">
      <table class="min-w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr class="border-b border-slate-800">
            <th class="px-4 py-2 font-medium">Ticker</th>
            <th class="px-4 py-2 font-medium text-right">Annual / share</th>
            <th class="px-4 py-2 font-medium text-right">Yield</th>
            <th class="px-4 py-2 font-medium">Payout cycle</th>
            <th class="px-4 py-2 font-medium text-right">Per payout</th>
            <th class="px-4 py-2 font-medium">Next ex-date</th>
            <th class="px-4 py-2 font-medium">Pay date</th>
            <th class="px-4 py-2 font-medium text-right">$/yr per $100</th>
          </tr>
        </thead>
        <tbody data-body></tbody>
      </table>
    </div>`;
  const body = el.querySelector('[data-body]');
  const source = el.querySelector('[data-source]');

  return function update(state) {
    if (!state.data) {
      body.innerHTML = '';
      return;
    }
    const first = state.data.rows[0];
    source.innerHTML = first ? `<span class="text-xs text-slate-400 mr-1">Calendar:</span>${freshnessBadge(first.dividend.source, first.dividend.fetchedAt)}` : '';
    body.innerHTML = state.data.rows
      .map((r) => {
        const d = r.dividend;
        if (!(d.annual > 0)) {
          return `<tr class="border-b border-slate-800/70">
            <td class="px-4 py-3 font-semibold text-white">${esc(r.symbol)}</td>
            <td colspan="7" class="px-4 py-3 text-slate-500">No regular dividend</td></tr>`;
        }
        return `
        <tr class="border-b border-slate-800/70 hover:bg-slate-800/40">
          <td class="px-4 py-3 font-semibold text-white">${esc(r.symbol)}</td>
          <td class="px-4 py-3 text-right font-mono">${money(d.annual)}</td>
          <td class="px-4 py-3 text-right font-mono text-emerald-300">${pct(d.yieldPct)}</td>
          <td class="px-4 py-3">${esc(frequencyLabel(d.frequency))}</td>
          <td class="px-4 py-3 text-right font-mono">${money(d.next?.rate || d.perPayout, true)}</td>
          <td class="px-4 py-3 whitespace-nowrap">${shortDate(d.next?.exDate)}${dateQualityTag(d.dateQuality)}</td>
          <td class="px-4 py-3 whitespace-nowrap text-slate-300">${shortDate(d.next?.payDate)}</td>
          <td class="px-4 py-3 text-right font-mono">${money(d.yieldPct)}</td>
        </tr>`;
      })
      .join('');
  };
}
