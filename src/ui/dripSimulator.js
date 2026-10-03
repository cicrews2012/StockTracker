import { esc, money, num, shares as fmtShares } from './format.js';
import { formatMonths, simulateDrip } from '../logic/drip.js';
import { frequencyLabel } from '../logic/dividends.js';

const field = (name, label, attrs = '', hint = '') => `
  <label class="block">
    <span class="text-xs text-slate-400">${label}</span>
    <input name="${name}" ${attrs}
      class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
    ${hint ? `<span class="text-[11px] text-slate-500">${hint}</span>` : ''}
  </label>`;

export function mountDripSimulator(el, actions) {
  el.innerHTML = `
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-white">DRIP simulator</h2>
      <p class="text-xs text-slate-400">Reinvest every dividend into fractional shares and see how long until payouts alone buy you extra shares.</p>
    </div>
    <form data-form class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <label class="block col-span-2 sm:col-span-1">
        <span class="text-xs text-slate-400">Stock</span>
        <select name="ticker" class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500"></select>
      </label>
      ${field('shares', 'Shares you own', 'type="number" min="0" step="any"')}
      ${field('years', 'Years', 'type="number" min="1" max="50" step="1"')}
      ${field('monthlyContribution', 'Add monthly ($)', 'type="number" min="0" step="any"')}
      ${field('price', 'Share price ($)', 'type="number" min="0" step="any"', 'From watchlist — editable')}
      ${field('annualDividend', 'Annual dividend / share ($)', 'type="number" min="0" step="any"')}
      ${field('priceGrowthPct', 'Price growth %/yr', 'type="number" step="any"')}
      ${field('dividendGrowthPct', 'Dividend growth %/yr', 'type="number" step="any"')}
      <label class="block">
        <span class="text-xs text-slate-400">Payout cycle</span>
        <select name="frequency" class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
          ${[12, 4, 2, 1].map((f) => `<option value="${f}">${frequencyLabel(f)}</option>`).join('')}
        </select>
      </label>
      <label class="col-span-2 sm:col-span-3 flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
        <input type="checkbox" name="reinvest" class="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500" />
        Reinvest dividends (DRIP). Untick to compare against taking dividends as cash.
      </label>
    </form>
    <div data-out class="mt-5"></div>`;

  const form = el.querySelector('[data-form]');
  const out = el.querySelector('[data-out]');
  let lastState = null;
  let lastTicker = null;

  form.addEventListener('input', (e) => {
    if (e.target.name === 'ticker') {
      prefillFromTicker(true);
    }
    render();
    actions.saveDrip(readInputs());
  });

  function readInputs() {
    const f = form.elements;
    return {
      ticker: f.ticker.value,
      shares: Number(f.shares.value),
      years: Number(f.years.value),
      monthlyContribution: Number(f.monthlyContribution.value),
      price: Number(f.price.value),
      annualDividend: Number(f.annualDividend.value),
      priceGrowthPct: Number(f.priceGrowthPct.value),
      dividendGrowthPct: Number(f.dividendGrowthPct.value),
      frequency: Number(f.frequency.value),
      reinvest: f.reinvest.checked,
    };
  }

  function prefillFromTicker(force) {
    const row = lastState?.data?.rows.find((r) => r.symbol === form.elements.ticker.value);
    if (!row) return;
    const f = form.elements;
    if (force || !f.price.value) f.price.value = row.quote.data.price.toFixed(2);
    if (force || !f.annualDividend.value) f.annualDividend.value = row.dividend.annual.toFixed(4).replace(/\.?0+$/, '');
    if (row.dividend.frequency) f.frequency.value = String(row.dividend.frequency);
    lastTicker = row.symbol;
  }

  function render() {
    const p = readInputs();
    if (!(p.price > 0) || !(p.shares > 0 || p.monthlyContribution > 0)) {
      out.innerHTML = '<p class="text-sm text-slate-400">Enter a share price and a share count (or monthly contribution) to run the simulation.</p>';
      return;
    }
    if (!(p.annualDividend > 0)) {
      out.innerHTML = '<p class="text-sm text-amber-300">This stock has no dividend set, so there is nothing to reinvest. Pick a dividend payer or enter an annual dividend.</p>';
      return;
    }
    const res = simulateDrip(p);
    out.innerHTML = renderResult(p, res);
  }

  return function update(state) {
    lastState = state;
    const rows = state.data?.rows || [];
    const sel = form.elements.ticker;
    const saved = state.settings.drip;
    const current = sel.value || saved.ticker;
    const options = rows.map((r) => `<option value="${esc(r.symbol)}">${esc(r.symbol)}</option>`).join('') || '<option value="">—</option>';
    if (sel.dataset.options !== options) {
      sel.innerHTML = options; // only rebuild when the watchlist changed, so focus isn't lost
      sel.dataset.options = options;
    }
    if (rows.some((r) => r.symbol === current)) sel.value = current;

    const f = form.elements;
    if (!f.shares.value) {
      f.shares.value = saved.shares;
      f.years.value = saved.years;
      f.monthlyContribution.value = saved.monthlyContribution;
      f.priceGrowthPct.value = saved.priceGrowthPct;
      f.dividendGrowthPct.value = saved.dividendGrowthPct;
      f.reinvest.checked = saved.reinvest !== false;
    }
    // Refresh price/dividend when data reloads or the selected ticker changed.
    prefillFromTicker(lastTicker !== sel.value || state.justLoaded);
    render();
  };
}

function renderResult(p, res) {
  const s = res.summary;
  const m = res.milestones;
  const kpi = (label, value, sub = '') => `
    <div class="rounded-lg bg-slate-800/60 p-3">
      <div class="text-[11px] uppercase tracking-wide text-slate-400">${label}</div>
      <div class="mt-1 text-lg font-semibold text-white font-mono">${value}</div>
      ${sub ? `<div class="text-[11px] text-slate-500">${sub}</div>` : ''}
    </div>`;

  const first = res.firstPayout;
  const milestoneRows = p.reinvest
    ? `
      <ul class="space-y-1.5 text-sm">
        <li class="flex justify-between gap-2"><span class="text-slate-400">First payout</span><span class="text-white">${first ? `${formatMonths(first.month)} → ${money(first.cash, true)} buys <strong>${fmtShares(first.sharesBought)}</strong> shares` : '—'}</span></li>
        <li class="flex justify-between gap-2"><span class="text-slate-400">+0.1 share from dividends</span><span class="text-white">${formatMonths(m.tenthShare)}</span></li>
        <li class="flex justify-between gap-2"><span class="text-slate-400">+1 full share from dividends</span><span class="font-semibold text-emerald-300">${formatMonths(m.fullShare)}</span></li>
        ${p.shares > 0 ? `<li class="flex justify-between gap-2"><span class="text-slate-400">Dividends double your original ${fmtShares(p.shares)} shares</span><span class="text-white">${formatMonths(m.doubled)}</span></li>` : ''}
      </ul>`
    : `<p class="text-sm text-slate-400">DRIP is off — dividends are taken as cash (${money(s.cashDividends)} over ${s.years} years). Tick “Reinvest” to see share-growth milestones.</p>`;

  return `
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      ${kpi('Shares after ' + s.years + 'y', fmtShares(s.endShares), `${fmtShares(s.dripShares)} from DRIP${s.contributedShares ? ` · ${fmtShares(s.contributedShares)} bought` : ''}`)}
      ${kpi('Position value', money(s.endValue), `started at ${money(s.startValue)}${s.totalContributed ? ` + ${money(s.totalContributed)} added` : ''}`)}
      ${kpi('Total dividends', money(s.totalDividends), p.reinvest ? 'all reinvested' : 'taken as cash')}
      ${kpi('Yearly income at end', money(s.annualIncomeEnd), `${money(s.annualIncomeEnd / 12)}/month`)}
    </div>
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <div class="rounded-lg border border-slate-800 p-3">
        <h3 class="mb-2 text-sm font-semibold text-slate-200">Milestones</h3>
        ${milestoneRows}
      </div>
      <div class="rounded-lg border border-slate-800 p-3">
        <h3 class="mb-2 text-sm font-semibold text-slate-200">Share count over time</h3>
        ${chart(res.timeline)}
      </div>
    </div>
    <details class="mt-3 rounded-lg border border-slate-800 p-3 text-sm">
      <summary class="cursor-pointer text-slate-300">Year-by-year table</summary>
      <div class="relative mt-2 overflow-x-auto">
        <table class="min-w-full text-xs">
          <thead class="text-left text-slate-400"><tr>
            <th class="px-2 py-1">Year</th><th class="px-2 py-1 text-right">Shares</th><th class="px-2 py-1 text-right">From DRIP</th>
            <th class="px-2 py-1 text-right">Price</th><th class="px-2 py-1 text-right">Value</th><th class="px-2 py-1 text-right">Dividends to date</th>
          </tr></thead>
          <tbody>
            ${res.timeline.map((t) => `<tr class="border-t border-slate-800">
              <td class="px-2 py-1">${num(t.month / 12, 1)}</td>
              <td class="px-2 py-1 text-right font-mono">${fmtShares(t.shares)}</td>
              <td class="px-2 py-1 text-right font-mono text-emerald-300">${fmtShares(t.dripShares)}</td>
              <td class="px-2 py-1 text-right font-mono">${money(t.price)}</td>
              <td class="px-2 py-1 text-right font-mono">${money(t.value)}</td>
              <td class="px-2 py-1 text-right font-mono">${money(t.dividends)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </details>
    <p class="mt-2 text-[11px] text-slate-500">Assumes constant growth rates, no taxes or fees, and reinvestment at the payout-month price. Real results will differ.</p>`;
}

function chart(timeline) {
  const W = 320;
  const H = 140;
  const pad = { l: 36, r: 8, t: 8, b: 20 };
  const maxX = timeline[timeline.length - 1].month || 1;
  const values = timeline.map((t) => t.shares);
  const minY = Math.min(...values);
  const maxY = Math.max(...values);
  const span = maxY - minY || 1;
  const x = (m) => pad.l + (m / maxX) * (W - pad.l - pad.r);
  const y = (v) => H - pad.b - ((v - minY) / span) * (H - pad.t - pad.b);
  const pts = timeline.map((t) => `${x(t.month).toFixed(1)},${y(t.shares).toFixed(1)}`).join(' ');
  const area = `${x(0)},${H - pad.b} ${pts} ${x(maxX)},${H - pad.b}`;
  return `
    <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Share count grows from ${fmtShares(minY)} to ${fmtShares(maxY)}">
      <defs><linearGradient id="dripFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#34d399" stop-opacity="0.35"/><stop offset="1" stop-color="#34d399" stop-opacity="0"/></linearGradient></defs>
      <line x1="${pad.l}" x2="${W - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" stroke="#334155"/>
      <text x="${pad.l - 4}" y="${y(maxY) + 4}" text-anchor="end" fill="#94a3b8" font-size="9">${num(maxY, 2)}</text>
      <text x="${pad.l - 4}" y="${y(minY) + 3}" text-anchor="end" fill="#94a3b8" font-size="9">${num(minY, 2)}</text>
      <text x="${pad.l}" y="${H - 6}" fill="#94a3b8" font-size="9">now</text>
      <text x="${W - pad.r}" y="${H - 6}" text-anchor="end" fill="#94a3b8" font-size="9">${num(maxX / 12, 0)}y</text>
      <polygon points="${area}" fill="url(#dripFill)"/>
      <polyline points="${pts}" fill="none" stroke="#34d399" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
}
