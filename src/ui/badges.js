import { esc, timeAgo } from './format.js';

const FRESH_MS = 15 * 60_000;

/**
 * Data freshness badge.
 *   Fresh  — real data fetched < 15 min ago
 *   Stale  — real data older than 15 min (e.g. API throttled, served from cache)
 *   Mock   — simulated data
 */
export function freshnessBadge(source, fetchedAt) {
  if (source === 'mock') {
    return pill('Mock', 'bg-slate-700/60 text-slate-300 ring-slate-500/40', 'Simulated data — add API keys in Settings for real quotes');
  }
  const age = Date.now() - fetchedAt;
  if (age < FRESH_MS) {
    return pill(`Fresh · ${timeAgo(fetchedAt)}`, 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30', 'Fetched within the last 15 minutes', true);
  }
  return pill(`Stale · ${timeAgo(fetchedAt)}`, 'bg-amber-500/15 text-amber-300 ring-amber-500/30', 'Older than 15 minutes — refresh, or the API may be throttled');
}

export function ratingBadge(result) {
  const styles = {
    safe: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
    watch: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
    risky: 'bg-rose-500/15 text-rose-300 ring-rose-500/30',
    unknown: 'bg-slate-700/60 text-slate-300 ring-slate-500/40',
  };
  const icon = { safe: '🛡️ ', watch: '👀 ', risky: '⚠️ ', unknown: '' }[result.rating];
  return pill(`${icon}${result.label}`, styles[result.rating], `${result.score}/${result.available} checks passed`);
}

export function dateQualityTag(q) {
  const map = {
    announced: ['Announced', 'text-emerald-300'],
    estimated: ['Estimated', 'text-amber-300'],
    sample: ['Sample', 'text-slate-400'],
    none: ['', ''],
  };
  const [label, cls] = map[q] || map.none;
  return label ? `<span class="ml-1 text-[10px] uppercase tracking-wide ${cls}">${label}</span>` : '';
}

export function pill(text, cls, title = '', dot = false) {
  return `<span class="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}" title="${esc(title)}">${
    dot ? '<span class="h-1.5 w-1.5 rounded-full bg-current animate-pulse"></span>' : ''
  }${esc(text)}</span>`;
}
