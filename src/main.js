import { clearAllData, hasAlpaca, hasFinnhub, loadSettings, normalizeTicker, saveSettings } from './config.js';
import { clearCache, loadWatchlist } from './api/provider.js';
import { evaluateSafeGrowth } from './logic/safeGrowth.js';
import { mountDashboard } from './ui/dashboard.js';
import { mountSafeGrowth } from './ui/safeGrowthCard.js';
import { mountDividendTable } from './ui/dividendTable.js';
import { mountExDivAlerts } from './ui/exDivAlerts.js';
import { mountDripSimulator } from './ui/dripSimulator.js';
import { mountPositionSizer } from './ui/positionSizer.js';
import { mountSettings } from './ui/settings.js';
import { toast } from './ui/toast.js';
import { timeAgo } from './ui/format.js';

const state = {
  settings: loadSettings(),
  data: null,
  loading: false,
  justLoaded: false,
};

const $ = (id) => document.getElementById(id);

function persist(patch) {
  state.settings = { ...state.settings, ...patch };
  saveSettings(state.settings);
}

const actions = {
  addTicker(raw) {
    const t = normalizeTicker(raw);
    if (!t) return;
    if (state.settings.watchlist.includes(t)) {
      toast(`${t} is already on your watchlist`, 'info', 3000);
      return;
    }
    persist({ watchlist: [...state.settings.watchlist, t] });
    refresh();
  },
  removeTicker(t) {
    persist({ watchlist: state.settings.watchlist.filter((s) => s !== t) });
    if (state.data) state.data.rows = state.data.rows.filter((r) => r.symbol !== t);
    renderAll();
  },
  saveDrip: debounce((drip) => {
    const { price, annualDividend, frequency, ...keep } = drip; // price/dividend come from live data
    persist({ drip: { ...state.settings.drip, ...keep } });
  }, 400),
  saveSizer: debounce((v) => persist(v), 400),
  saveSettings(patch) {
    const keysChanged =
      patch.finnhubKey !== state.settings.finnhubKey ||
      patch.alpacaKeyId !== state.settings.alpacaKeyId ||
      patch.alpacaSecret !== state.settings.alpacaSecret ||
      patch.forceMock !== state.settings.forceMock;
    persist(patch);
    toast('Settings saved', 'success', 2500);
    scheduleRefresh();
    refresh({ force: keysChanged });
  },
  clearAll() {
    clearAllData();
    clearCache();
    state.settings = loadSettings();
    toast('All saved data cleared', 'success', 3000);
    refresh({ force: true });
  },
};

const views = [];

function renderAll() {
  views.forEach((update) => update(state));
  renderStatus();
  state.justLoaded = false;
}

function renderStatus() {
  const s = state.settings;
  const mode = state.data?.mode;
  const pill = $('mode-pill');
  if (s.forceMock || (!hasFinnhub(s) && !hasAlpaca(s)) || mode === 'mock') {
    pill.textContent = 'Mock data';
    pill.className = 'rounded-full bg-slate-700/70 px-2.5 py-0.5 text-xs font-medium text-slate-200';
  } else if (mode === 'partial') {
    pill.textContent = 'Live + mock';
    pill.className = 'rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-medium text-amber-200';
  } else {
    pill.textContent = 'Live data';
    pill.className = 'rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-medium text-emerald-200';
  }
  $('updated-at').textContent = state.loading ? 'Refreshing…' : state.data ? `Updated ${timeAgo(state.data.loadedAt)}` : '';
  $('refresh-btn').disabled = state.loading;
  $('setup-hint').hidden = hasFinnhub(s) || s.forceMock;
}

async function refresh({ force = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  renderStatus();
  try {
    const data = await loadWatchlist(state.settings, { force });
    data.rows.forEach((r) => (r.safe = evaluateSafeGrowth(r.fundamentals.data, state.settings.safeGrowth)));
    state.data = data;
    state.justLoaded = true;
    data.warnings.forEach((w) => toast(`${w} — showing cached or mock data instead.`, 'warn'));
  } catch (e) {
    console.error(e);
    toast(`Could not load data: ${e.message}`, 'error');
  } finally {
    state.loading = false;
    renderAll();
  }
}

let refreshTimer;
function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => refresh(), state.settings.refreshMinutes * 60_000);
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function init() {
  views.push(
    mountExDivAlerts($('exdiv-banner'), $('exdiv-calendar')),
    mountDashboard($('dashboard'), actions),
    mountSafeGrowth($('safe-growth')),
    mountDividendTable($('dividends')),
    mountDripSimulator($('drip'), actions),
    mountPositionSizer($('sizer'), actions),
  );
  const openSettings = mountSettings($('settings-dialog'), actions);
  $('settings-btn').addEventListener('click', () => openSettings(state.settings));
  $('setup-link').addEventListener('click', () => openSettings(state.settings));
  $('refresh-btn').addEventListener('click', () => refresh({ force: true }));

  renderAll();
  refresh();
  scheduleRefresh();
  // Keep "x minutes ago" and the freshness badges honest between refreshes.
  setInterval(() => !state.loading && renderAll(), 60_000);
}

init();
