import { esc } from './format.js';
import { fetchQuote } from '../api/finnhub.js';
import { fetchCashDividends } from '../api/alpaca.js';

const keyInput = (name, label, placeholder) => `
  <label class="block">
    <span class="text-xs text-slate-400">${label}</span>
    <div class="mt-1 flex gap-2">
      <input name="${name}" type="password" autocomplete="off" spellcheck="false" placeholder="${placeholder}"
        class="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 font-mono text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
      <button type="button" data-reveal="${name}" class="rounded-lg border border-slate-700 px-2 text-xs text-slate-300 hover:bg-slate-800">Show</button>
    </div>
  </label>`;

export function mountSettings(dialog, actions) {
  dialog.innerHTML = `
    <form method="dialog" data-form class="w-[min(92vw,34rem)] space-y-5 p-6">
      <header class="flex items-center justify-between">
        <h2 class="text-lg font-semibold text-white">Settings</h2>
        <button type="button" data-close class="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white" aria-label="Close">✕</button>
      </header>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-200">Finnhub <span class="font-normal text-slate-400">— quotes &amp; fundamentals</span></h3>
        ${keyInput('finnhubKey', 'API key', 'e.g. c1a2b3c4d5e6f7g8h9i0')}
        <p class="text-[11px] text-slate-500">Free key at <a class="text-sky-400 underline" href="https://finnhub.io/register" target="_blank" rel="noopener">finnhub.io/register</a> → Dashboard → API Keys.</p>
      </section>

      <section class="space-y-3">
        <h3 class="text-sm font-semibold text-slate-200">Alpaca <span class="font-normal text-slate-400">— dividend calendar (optional)</span></h3>
        ${keyInput('alpacaKeyId', 'API Key ID', 'e.g. PK1A2B3C4D5E6F7G8H9I')}
        ${keyInput('alpacaSecret', 'Secret Key', '••••••••••••••••••••')}
        <p class="text-[11px] text-slate-500">Free paper-trading account at <a class="text-sky-400 underline" href="https://app.alpaca.markets/signup" target="_blank" rel="noopener">alpaca.markets</a>. Needs the app started with <code class="text-slate-300">node server.js</code>.</p>
      </section>

      <section class="grid grid-cols-2 gap-3">
        <label class="block">
          <span class="text-xs text-slate-400">Auto-refresh every (minutes)</span>
          <input name="refreshMinutes" type="number" min="1" max="240" step="1"
            class="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-sky-500" />
        </label>
        <label class="flex items-center gap-2 self-end pb-2 text-sm text-slate-300">
          <input name="forceMock" type="checkbox" class="h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-sky-500" />
          Use mock data only
        </label>
      </section>

      <div data-test-out class="min-h-[1.25rem] text-xs"></div>

      <p class="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-[11px] leading-relaxed text-slate-400">
        🔒 Keys are saved only in this browser's LocalStorage and sent only to Finnhub and (via your local server) Alpaca.
        LocalStorage is not encrypted, so don't use this on a shared computer, and only use free/paper keys.
      </p>

      <footer class="flex flex-wrap items-center justify-between gap-2">
        <button type="button" data-clear class="rounded-lg border border-rose-500/40 px-3 py-1.5 text-sm text-rose-300 hover:bg-rose-500/10">Clear all saved data</button>
        <div class="flex gap-2">
          <button type="button" data-test class="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">Test keys</button>
          <button type="submit" class="rounded-lg bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-500">Save</button>
        </div>
      </footer>
    </form>`;

  const form = dialog.querySelector('[data-form]');
  const testOut = dialog.querySelector('[data-test-out]');

  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('[data-close]')) dialog.close();
    const reveal = e.target.closest('[data-reveal]');
    if (reveal) {
      const inp = form.elements[reveal.dataset.reveal];
      inp.type = inp.type === 'password' ? 'text' : 'password';
      reveal.textContent = inp.type === 'password' ? 'Show' : 'Hide';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    actions.saveSettings(read());
    dialog.close();
  });

  dialog.querySelector('[data-clear]').addEventListener('click', () => {
    if (confirm('Remove your API keys, watchlist and all cached data from this browser?')) {
      actions.clearAll();
      dialog.close();
    }
  });

  dialog.querySelector('[data-test]').addEventListener('click', async () => {
    const v = read();
    testOut.innerHTML = '<span class="text-slate-400">Testing…</span>';
    const lines = [];
    if (v.finnhubKey) {
      try {
        const q = await fetchQuote('AAPL', v.finnhubKey);
        lines.push(`<span class="text-emerald-300">✓ Finnhub OK (AAPL ${q.price})</span>`);
      } catch (err) {
        lines.push(`<span class="text-rose-300">✗ Finnhub: ${esc(err.message)}</span>`);
      }
    } else {
      lines.push('<span class="text-slate-500">– Finnhub key not set</span>');
    }
    if (v.alpacaKeyId && v.alpacaSecret) {
      try {
        const d = await fetchCashDividends(['KO'], v.alpacaKeyId, v.alpacaSecret);
        lines.push(`<span class="text-emerald-300">✓ Alpaca OK (${d.KO?.length ?? 0} KO dividends found)</span>`);
      } catch (err) {
        lines.push(`<span class="text-rose-300">✗ Alpaca: ${esc(err.message)}</span>`);
      }
    } else {
      lines.push('<span class="text-slate-500">– Alpaca keys not set</span>');
    }
    testOut.innerHTML = lines.join('<br>');
  });

  function read() {
    const f = form.elements;
    return {
      finnhubKey: f.finnhubKey.value.trim(),
      alpacaKeyId: f.alpacaKeyId.value.trim(),
      alpacaSecret: f.alpacaSecret.value.trim(),
      refreshMinutes: Number(f.refreshMinutes.value) || 15,
      forceMock: f.forceMock.checked,
    };
  }

  return function open(settings) {
    const f = form.elements;
    f.finnhubKey.value = settings.finnhubKey;
    f.alpacaKeyId.value = settings.alpacaKeyId;
    f.alpacaSecret.value = settings.alpacaSecret;
    f.refreshMinutes.value = settings.refreshMinutes;
    f.forceMock.checked = settings.forceMock;
    testOut.innerHTML = '';
    dialog.showModal();
  };
}
