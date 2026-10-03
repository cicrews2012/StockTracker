import { changeClass, esc, money, pct } from './format.js';
import { freshnessBadge, ratingBadge } from './badges.js';

export function mountDashboard(el, actions) {
  el.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-lg font-semibold text-white">Watchlist</h2>
        <p class="text-xs text-slate-400">Price, daily change and data freshness. Badges turn amber once data is older than 15 minutes.</p>
      </div>
      <form data-add class="flex gap-2">
        <label class="sr-only" for="add-ticker">Add ticker</label>
        <input id="add-ticker" name="ticker" placeholder="Add ticker e.g. PEP" autocomplete="off"
          class="w-40 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm uppercase placeholder:normal-case placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
        <button class="rounded-lg bg-sky-600 hover:bg-sky-500 px-3 py-1.5 text-sm font-medium text-white">Add</button>
      </form>
    </div>
    <div class="relative overflow-x-auto -mx-4 sm:mx-0">
      <table class="min-w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
          <tr class="border-b border-slate-800">
            <th class="px-4 py-2 font-medium">Ticker</th>
            <th class="px-4 py-2 font-medium text-right">Price</th>
            <th class="px-4 py-2 font-medium text-right">Day change</th>
            <th class="px-4 py-2 font-medium text-right">Day %</th>
            <th class="px-4 py-2 font-medium text-right">Div. yield</th>
            <th class="px-4 py-2 font-medium">Screen</th>
            <th class="px-4 py-2 font-medium">Data</th>
            <th class="px-2 py-2"><span class="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody data-body></tbody>
      </table>
    </div>`;

  el.querySelector('[data-add]').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = e.target.elements.ticker;
    actions.addTicker(input.value);
    input.value = '';
  });
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) actions.removeTicker(btn.dataset.remove);
  });

  const body = el.querySelector('[data-body]');
  return function update(state) {
    if (!state.data) {
      body.innerHTML = skeletonRows(state.settings.watchlist.length || 3);
      return;
    }
    if (!state.data.rows.length) {
      body.innerHTML = `<tr><td colspan="8" class="px-4 py-8 text-center text-slate-400">Your watchlist is empty — add a ticker above.</td></tr>`;
      return;
    }
    body.innerHTML = state.data.rows
      .map((r) => {
        const q = r.quote.data;
        return `
        <tr class="border-b border-slate-800/70 hover:bg-slate-800/40">
          <td class="px-4 py-3">
            <div class="font-semibold text-white">${esc(r.symbol)}</div>
            <div class="text-xs text-slate-400 truncate max-w-[12rem]">${esc(r.name)}</div>
          </td>
          <td class="px-4 py-3 text-right font-mono text-white">${money(q.price)}</td>
          <td class="px-4 py-3 text-right font-mono ${changeClass(q.change)}">${q.change > 0 ? '+' : ''}${money(q.change)}</td>
          <td class="px-4 py-3 text-right font-mono ${changeClass(q.changePct)}">${q.changePct > 0 ? '▲' : q.changePct < 0 ? '▼' : ''} ${pct(q.changePct, { sign: true })}</td>
          <td class="px-4 py-3 text-right font-mono text-slate-200">${r.dividend.annual > 0 ? pct(r.dividend.yieldPct) : '<span class="text-slate-500">—</span>'}</td>
          <td class="px-4 py-3">${ratingBadge(r.safe)}</td>
          <td class="px-4 py-3">${freshnessBadge(r.quote.source, r.quote.fetchedAt)}</td>
          <td class="px-2 py-3 text-right">
            <button data-remove="${esc(r.symbol)}" class="rounded p-1 text-slate-500 hover:bg-slate-700 hover:text-rose-300" title="Remove ${esc(r.symbol)}" aria-label="Remove ${esc(r.symbol)}">✕</button>
          </td>
        </tr>`;
      })
      .join('');
  };
}

function skeletonRows(n) {
  return Array.from({ length: n }, () =>
    `<tr class="border-b border-slate-800/70">${'<td class="px-4 py-4"><div class="h-3 rounded bg-slate-800 animate-pulse"></div></td>'.repeat(8)}</tr>`,
  ).join('');
}
