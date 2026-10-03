import { esc, money, plural, shortDate } from './format.js';
import { dateQualityTag } from './badges.js';
import { exDividendWindow } from '../logic/dividends.js';
import { addDays, parseISO, todayISO } from '../logic/dates.js';

const WINDOW_DAYS = 60;

/** Collects upcoming ex-dividend events, soonest first. */
export function upcomingEvents(rows, today = todayISO()) {
  return rows
    .filter((r) => r.dividend.next?.exDate)
    .map((r) => ({ row: r, w: exDividendWindow(r.dividend.next.exDate, today) }))
    .filter(({ w }) => w && w.daysToEx >= 0 && w.daysToEx <= WINDOW_DAYS)
    .sort((a, b) => a.w.exDate.localeCompare(b.w.exDate) || a.row.symbol.localeCompare(b.row.symbol));
}

const STATUS_STYLE = {
  'last-day': { ring: 'border-rose-500/60 bg-rose-500/10', chip: 'bg-rose-500 text-white', label: 'Last day to buy' },
  urgent: { ring: 'border-rose-500/40 bg-rose-500/5', chip: 'bg-rose-500/80 text-white', label: 'Urgent' },
  soon: { ring: 'border-amber-500/40 bg-amber-500/5', chip: 'bg-amber-500 text-slate-900', label: 'Soon' },
  upcoming: { ring: 'border-slate-700 bg-slate-900/60', chip: 'bg-slate-700 text-slate-200', label: 'Upcoming' },
  missed: { ring: 'border-slate-700 bg-slate-900/40', chip: 'bg-slate-600 text-slate-200', label: 'Too late to buy' },
};

function message({ row, w }) {
  const pay = money(row.dividend.next.rate || row.dividend.perPayout, true);
  const sym = `<strong class="text-white">${esc(row.symbol)}</strong>`;
  if (w.status === 'missed') {
    const when = w.daysToEx === 0 ? '<strong>today</strong>' : `on ${shortDate(w.exDate)}`;
    return `${sym} goes ex-dividend ${when}. The last day to buy was ${shortDate(w.buyBy)}, so it's too late for this ${pay} payout — but if you already own it, hold through the ex-date and you will receive it.`;
  }
  if (w.status === 'last-day') {
    return `<strong>Today is the last day</strong> to buy ${sym} and receive the ${pay}/share payout. Buy before the close today and hold until at least the ex-date (${shortDate(w.exDate)}).`;
  }
  return `Buy ${sym} by <strong class="text-white">${shortDate(w.buyBy)}</strong> — <strong>${plural(w.daysToBuy, 'day')} left</strong> — and hold through the ex-date ${shortDate(w.exDate)} to secure ${pay}/share.`;
}

export function mountExDivAlerts(bannerEl, calendarEl) {
  calendarEl.innerHTML = `
    <div class="mb-4">
      <h2 class="text-lg font-semibold text-white">Ex-dividend calendar</h2>
      <p class="text-xs text-slate-400">Next ${WINDOW_DAYS} days, soonest first. You must <em>own</em> shares before the ex-date; with T+1 settlement that means buying by the close of the previous trading day. Exchange holidays are not accounted for, so leave a day of margin.</p>
    </div>
    <div data-strip class="mb-4"></div>
    <ol data-list class="space-y-2"></ol>`;
  const strip = calendarEl.querySelector('[data-strip]');
  const list = calendarEl.querySelector('[data-list]');

  return function update(state) {
    if (!state.data) {
      bannerEl.innerHTML = '';
      list.innerHTML = '<li class="h-14 rounded-lg bg-slate-800/60 animate-pulse"></li>'.repeat(2);
      return;
    }
    const today = todayISO();
    const events = upcomingEvents(state.data.rows, today);
    const sample = events.some((e) => e.row.dividend.dateQuality === 'sample');

    // Prominent banner: everything with ≤ 10 days left to buy.
    const hot = events.filter((e) => ['last-day', 'urgent', 'soon', 'missed'].includes(e.w.status));
    if (hot.length) {
      const worst = hot.some((e) => e.w.status === 'last-day' || e.w.status === 'urgent');
      bannerEl.innerHTML = `
        <div role="alert" class="rounded-xl border ${worst ? 'border-rose-500/50 bg-gradient-to-r from-rose-950/80 to-slate-900' : 'border-amber-500/40 bg-gradient-to-r from-amber-950/60 to-slate-900'} p-4">
          <div class="flex items-center gap-2 font-semibold ${worst ? 'text-rose-200' : 'text-amber-200'}">
            <span aria-hidden="true">⏰</span> Ex-dividend alert — ${plural(hot.length, 'stock')} in your watchlist ${hot.length === 1 ? 'goes' : 'go'} ex-dividend soon
            ${sample ? '<span class="ml-auto text-[11px] font-normal text-slate-400">Sample dates — add Alpaca keys for real dates</span>' : ''}
          </div>
          <ul class="mt-2 space-y-1 text-sm text-slate-200">
            ${hot.map((e) => `<li class="flex gap-2"><span class="mt-1 inline-block h-2 w-2 shrink-0 rounded-full ${e.w.status === 'soon' ? 'bg-amber-400' : e.w.status === 'missed' ? 'bg-slate-400' : 'bg-rose-400'}"></span><span>${message(e)}</span></li>`).join('')}
          </ul>
        </div>`;
    } else {
      bannerEl.innerHTML = '';
    }

    strip.innerHTML = renderStrip(events, today);

    if (!events.length) {
      list.innerHTML = '<li class="rounded-lg border border-slate-800 p-4 text-sm text-slate-400">No ex-dividend dates in the next 60 days for your watchlist.</li>';
      return;
    }
    list.innerHTML = events
      .map((e) => {
        const st = STATUS_STYLE[e.w.status] || STATUS_STYLE.upcoming;
        const countdown = e.w.status === 'missed' ? (e.w.daysToEx === 0 ? 'Ex today' : 'Too late') : e.w.daysToBuy === 0 ? 'Buy today' : `${e.w.daysToBuy}d to buy`;
        return `
        <li class="flex items-start gap-3 rounded-lg border ${st.ring} p-3">
          <div class="w-20 shrink-0 text-center">
            <div class="rounded-md px-1.5 py-1 text-xs font-bold ${st.chip}">${countdown}</div>
            <div class="mt-1 text-[10px] uppercase tracking-wide text-slate-400">${st.label}</div>
          </div>
          <div class="text-sm text-slate-300">
            <div>${message(e)}</div>
            <div class="mt-1 text-xs text-slate-500">Ex-date ${shortDate(e.w.exDate)}${dateQualityTag(e.row.dividend.dateQuality)}${e.row.dividend.next.payDate ? ` · Paid ${shortDate(e.row.dividend.next.payDate)}` : ''}</div>
          </div>
        </li>`;
      })
      .join('');
  };
}

/** Five-week calendar strip starting this week; dots mark ex-dates. */
function renderStrip(events, today) {
  const start = addDays(today, -parseISO(today).getUTCDay()); // Sunday of this week
  const byDate = {};
  events.forEach((e) => (byDate[e.w.exDate] ||= []).push(e.row.symbol));
  const buyBy = new Set(events.filter((e) => e.w.daysToBuy >= 0).map((e) => e.w.buyBy));
  const heads = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d) => `<div class="text-center text-[10px] text-slate-500">${d}</div>`).join('');
  const cells = [];
  for (let i = 0; i < 35; i++) {
    const iso = addDays(start, i);
    const d = parseISO(iso).getUTCDate();
    const syms = byDate[iso] || [];
    const isToday = iso === today;
    const past = iso < today;
    cells.push(`
      <div class="min-h-[3rem] rounded-md p-1 text-[10px] ${isToday ? 'ring-1 ring-sky-500 bg-sky-500/10' : past ? 'opacity-40' : 'bg-slate-800/40'}" title="${syms.length ? 'Ex-dividend: ' + esc(syms.join(', ')) : ''}">
        <div class="flex items-center justify-between text-slate-400"><span>${d}</span>${buyBy.has(iso) ? '<span class="text-amber-300" title="Last day to buy for an upcoming ex-date">●</span>' : ''}</div>
        ${syms.slice(0, 2).map((s) => `<div class="mt-0.5 truncate rounded bg-emerald-500/20 px-1 text-emerald-200">${esc(s)}</div>`).join('')}
        ${syms.length > 2 ? `<div class="text-slate-400">+${syms.length - 2}</div>` : ''}
      </div>`);
  }
  return `
    <div class="grid grid-cols-7 gap-1">${heads}${cells.join('')}</div>
    <div class="mt-2 flex gap-4 text-[11px] text-slate-500">
      <span><span class="rounded bg-emerald-500/20 px-1 text-emerald-200">KO</span> ex-dividend date</span>
      <span><span class="text-amber-300">●</span> last day to buy</span>
    </div>`;
}
