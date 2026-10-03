import { esc, num } from './format.js';
import { ratingBadge } from './badges.js';

export function mountSafeGrowth(el) {
  el.innerHTML = `
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-white">Safe Growth screen</h2>
      <p class="text-xs text-slate-400">
        A plain-English fundamentals checklist. <span class="text-emerald-300">Safe Growth</span> = profitable and passing at least 80% of the checks that have data.
        Missing data is skipped, never counted against a stock.
      </p>
    </div>
    <div data-grid class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"></div>`;
  const grid = el.querySelector('[data-grid]');

  return function update(state) {
    if (!state.data) {
      grid.innerHTML = '<div class="h-40 rounded-xl bg-slate-800/60 animate-pulse"></div>'.repeat(3);
      return;
    }
    grid.innerHTML = state.data.rows
      .map((r) => {
        const s = r.safe;
        const bar = s.available ? Math.round((s.score / s.available) * 100) : 0;
        const barColor = { safe: 'bg-emerald-400', watch: 'bg-amber-400', risky: 'bg-rose-400', unknown: 'bg-slate-500' }[s.rating];
        return `
        <article class="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <header class="flex items-start justify-between gap-2">
            <div>
              <div class="font-semibold text-white">${esc(r.symbol)}</div>
              <div class="text-xs text-slate-400 truncate max-w-[10rem]">${esc(r.name)}</div>
            </div>
            ${ratingBadge(s)}
          </header>
          <div class="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <div class="h-1.5 flex-1 rounded-full bg-slate-800"><div class="h-1.5 rounded-full ${barColor}" style="width:${bar}%"></div></div>
            <span>${s.score}/${s.available}</span>
          </div>
          <ul class="mt-3 space-y-1.5 text-xs">
            ${s.checks.map(checkRow).join('')}
          </ul>
          ${r.fundamentals.source === 'mock' ? '<p class="mt-3 text-[11px] text-slate-500">Using sample fundamentals.</p>' : ''}
        </article>`;
      })
      .join('');
  };
}

function checkRow(c) {
  const icon = c.pass === null ? '<span class="text-slate-500">–</span>' : c.pass ? '<span class="text-emerald-400">✓</span>' : '<span class="text-rose-400">✗</span>';
  const value = c.value === null || c.value === undefined ? 'n/a' : `${num(c.value, 1)}${c.unit}`;
  return `<li class="flex items-center justify-between gap-2">
    <span class="flex items-center gap-2 ${c.pass === null ? 'text-slate-500' : 'text-slate-300'}">${icon} ${esc(c.label)}</span>
    <span class="font-mono text-slate-400">${esc(value)}</span>
  </li>`;
}
