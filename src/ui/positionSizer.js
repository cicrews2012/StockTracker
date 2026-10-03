import { esc, money, pct, shares as fmtShares } from './format.js';
import { sizePosition } from '../logic/sizing.js';

const input = (name, label, attrs, hint) => `
  <label class="block">
    <span class="text-xs text-slate-400">${label}</span>
    <input name="${name}" ${attrs}
      class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
    <span class="text-[11px] text-slate-500">${hint}</span>
  </label>`;

export function mountPositionSizer(el, actions) {
  el.innerHTML = `
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-white">Small-capital risk helper</h2>
      <p class="text-xs text-slate-400">How much of a small account to put in one stock, and how many whole or fractional shares that buys.</p>
    </div>
    <form data-form class="grid grid-cols-2 gap-3">
      ${input('accountPool', 'Account pool ($)', 'type="number" min="0" step="any"', 'Cash you can invest')}
      ${input('maxPositionPct', 'Max per stock (%)', 'type="number" min="1" max="100" step="any"', 'Diversification cap')}
      ${input('riskPct', 'Max loss (% of pool)', 'type="number" min="0" max="100" step="any"', 'If the stop is hit')}
      ${input('stopLossPct', 'Stop-loss / drawdown (%)', 'type="number" min="1" max="100" step="any"', 'Drop you plan to tolerate')}
    </form>
    <div data-out class="mt-4"></div>`;

  const form = el.querySelector('[data-form]');
  const out = el.querySelector('[data-out]');
  let lastState = null;

  form.addEventListener('input', () => {
    const v = read();
    actions.saveSizer(v);
    render(v);
  });

  function read() {
    const f = form.elements;
    return {
      accountPool: Number(f.accountPool.value),
      maxPositionPct: Number(f.maxPositionPct.value),
      riskPct: Number(f.riskPct.value),
      stopLossPct: Number(f.stopLossPct.value),
    };
  }

  function render(v) {
    const rows = lastState?.data?.rows || [];
    if (!rows.length) {
      out.innerHTML = '';
      return;
    }
    const base = sizePosition({ pool: v.accountPool, price: 1, maxPositionPct: v.maxPositionPct, riskPct: v.riskPct, stopLossPct: v.stopLossPct });
    const why =
      base.limitedBy === 'risk'
        ? `Limited by risk: losing ${pct(v.stopLossPct, { dp: 0 })} on ${money(base.budget)} costs ${money(v.accountPool * v.riskPct / 100)} (${pct(v.riskPct, { dp: 1 })} of the pool).`
        : `Limited by your ${pct(v.maxPositionPct, { dp: 0 })} per-stock cap.`;

    out.innerHTML = `
      <div class="rounded-lg bg-slate-800/60 p-3">
        <div class="text-[11px] uppercase tracking-wide text-slate-400">Safe budget per stock</div>
        <div class="text-2xl font-semibold font-mono text-white">${money(base.budget)}</div>
        <div class="text-xs text-slate-400">${why}</div>
      </div>
      <div class="relative mt-3 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr class="border-b border-slate-800">
              <th class="px-2 py-2 font-medium">Ticker</th>
              <th class="px-2 py-2 font-medium text-right">Price</th>
              <th class="px-2 py-2 font-medium text-right">Fractional</th>
              <th class="px-2 py-2 font-medium text-right">Whole</th>
              <th class="px-2 py-2 font-medium text-right">Left over</th>
            </tr>
          </thead>
          <tbody>
            ${rows
              .map((r) => {
                const s = sizePosition({ pool: v.accountPool, price: r.quote.data.price, maxPositionPct: v.maxPositionPct, riskPct: v.riskPct, stopLossPct: v.stopLossPct });
                return `<tr class="border-b border-slate-800/70">
                  <td class="px-2 py-2 font-semibold text-white">${esc(r.symbol)}</td>
                  <td class="px-2 py-2 text-right font-mono">${money(r.quote.data.price)}</td>
                  <td class="px-2 py-2 text-right font-mono text-emerald-300" title="Costs ${money(s.fractional.cost)}">${fmtShares(s.fractional.shares)}</td>
                  <td class="px-2 py-2 text-right font-mono ${s.canAffordWhole ? 'text-white' : 'text-slate-500'}" title="${s.canAffordWhole ? '' : 'Budget is below one share — fractional only'}">${s.whole.shares}</td>
                  <td class="px-2 py-2 text-right font-mono text-slate-400">${money(s.whole.leftover)}</td>
                </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-[11px] text-slate-500">A grey 0 means the budget can't cover one whole share, so only a fractional buy works. “Left over” is the unspent part of the per-stock budget if you buy whole shares only. Fractional shares need a broker that supports them.</p>`;
  }

  return function update(state) {
    lastState = state;
    const f = form.elements;
    if (!f.accountPool.value) {
      f.accountPool.value = state.settings.accountPool;
      f.maxPositionPct.value = state.settings.maxPositionPct;
      f.riskPct.value = state.settings.riskPct;
      f.stopLossPct.value = state.settings.stopLossPct;
    }
    render(read());
  };
}
