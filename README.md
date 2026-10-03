# 📈 StockTracker

A local, single-page stock tracker for **small-capital, long-term investors** who want to grow a position by compounding: buying good businesses, collecting dividends and reinvesting them one fractional share at a time.

It runs entirely on your own computer. There's no account, no build step and no database. Your settings and API keys stay in your browser.

> ⚠️ **Not financial advice.** This is an educational tool. Data can be delayed, estimated or simulated. Always confirm prices and ex-dividend dates with your broker before trading.

---

## Contents

1. [Features](#features)
2. [Quick start (2 minutes, no keys needed)](#quick-start)
3. [Getting your free API keys (step by step)](#getting-your-free-api-keys)
4. [Entering your keys in the app](#entering-your-keys-in-the-app)
5. [How each section works](#how-each-section-works)
6. [Where your data is stored (security)](#where-your-data-is-stored)
7. [Rate limits & mock-data fallback](#rate-limits--mock-data-fallback)
8. [Troubleshooting](#troubleshooting)
9. [Project structure](#project-structure)
10. [Running the tests](#running-the-tests)

---

## Features

| Section | What it does |
|---|---|
| **Live dashboard** | Watchlist with price, daily $ change and % change, dividend yield, Safe Growth rating, and a **data freshness badge** (*Fresh* < 15 min, *Stale* ≥ 15 min, *Mock* = simulated). Add or remove tickers. Auto-refreshes every 15 minutes (configurable). |
| **Safe Growth screen** | A transparent checklist on each stock: profitable, long-term EPS growth, stable recent EPS, reasonable P/E, sustainable payout ratio and low beta. Each stock is flagged 🛡️ **Safe Growth**, 👀 **Watch** or ⚠️ **Higher Risk**. |
| **Dividend tracker** | Annual dividend per share, yield %, payout cycle (monthly/quarterly/…), amount per payout, next ex-dividend date, pay date, and yearly income per $100 invested. |
| **Ex-dividend alerts** | A prominent banner plus a chronological calendar that tells you exactly **how many days are left to buy** and the date you must hold through to secure the next payout. |
| **DRIP simulator** | Enter your share count and see how dividends reinvested into fractional shares grow your position: how long until payouts alone buy **+0.1 share** and **+1 full share**, and when they double your holding. Includes a chart and a year-by-year table. |
| **Small-capital risk helper** | Position sizer for small accounts (default **$100**). It caps each stock by a diversification % *and* by how much you're willing to lose at your stop-loss, then shows whole and fractional shares for every watchlist ticker. |

---

## Quick start

**Requirements:** a modern browser (Chrome, Edge, Firefox, Safari) and [Node.js 18+](https://nodejs.org/) (recommended). You don't need `npm install`, because the app has no dependencies.

```bash
git clone https://github.com/cicrews2012/StockTracker.git
cd StockTracker
node server.js
```

Then open **http://localhost:8080** in your browser.

Want a different port? Run `PORT=3000 node server.js` (macOS/Linux) or `set PORT=3000 && node server.js` (Windows cmd).

The app starts in **mock-data mode**, so every section works straight away with realistic sample data. Add free API keys (next section) to switch to real data.

<details>
<summary>No Node.js? Use Python instead (Finnhub only)</summary>

```bash
python3 -m http.server 8080
```

This serves the app fine, but the Alpaca dividend calendar needs the small proxy in `server.js` (see [why](#why-is-there-a-server-at-all)). Without it, ex-dividend dates use sample data. Opening `index.html` directly with `file://` will **not** work, because browsers block ES modules from `file://` URLs.
</details>

> The page loads Tailwind CSS from `cdn.tailwindcss.com`, so you need an internet connection for styling. That's true for the data APIs anyway.

---

## Getting your free API keys

You can use one provider, both, or neither.

| Provider | Used for | Free tier | Required? |
|---|---|---|---|
| **Finnhub** | Quotes, daily change, fundamentals (P/E, margins, EPS growth, dividend per share, yield) | 60 calls/minute | Recommended |
| **Alpaca** | Real **ex-dividend / record / pay dates** (corporate actions) | Free "Basic" market-data plan with a paper-trading account | Optional |

### Step 1: Finnhub (quotes & fundamentals)

1. Go to **https://finnhub.io/register**.
2. Sign up with your email (or Google/GitHub). The free plan doesn't need a credit card.
3. Confirm your email if asked, then log in.
4. You'll land on the **Dashboard**. Your key is shown under **API Keys** and looks like `c1a2b3c4d5e6f7g8h9i0`.
5. Click the copy icon next to it.

That single key is all Finnhub needs.

### Step 2 (optional): Alpaca (real dividend calendar)

Finnhub's free plan doesn't include a dividend calendar. Without Alpaca, StockTracker shows **sample** ex-dates (clearly labelled *Sample*). To get real, announced dates:

1. Go to **https://app.alpaca.markets/signup** and create a free account. You don't need to fund it or open a live brokerage account.
2. After logging in, make sure you're in the **Paper Trading** account (switch it at the top left of the dashboard if needed). Paper keys are free and can't touch real money.
3. On the paper-trading **Home** page, find the **API Keys** panel on the right and click **Generate New Keys** (or **Regenerate**).
4. Copy both values right away. **The Secret Key is shown only once.**
   - **API Key ID**, which looks like `PK1A2B3C4D5E6F7G8H9I`
   - **Secret Key**, a long string
5. If you lose the secret, just regenerate. The old pair stops working.

> Use **paper-trading** keys only. StockTracker only *reads* market data and never places orders, but there's no reason to give a read-only tool a live-trading key.

---

## Entering your keys in the app

1. Start the app (`node server.js`) and open http://localhost:8080.
2. Click **⚙ Settings** in the top-right corner (or the **Settings** link in the blue "mock data" notice).
3. Paste your **Finnhub API key**.
4. *(Optional)* Paste your **Alpaca API Key ID** and **Secret Key**.
5. Click **Test keys**. You should see:
   - `✓ Finnhub OK (AAPL 230.12)`
   - `✓ Alpaca OK (n KO dividends found)`
6. Click **Save**. The app refreshes immediately. The header pill changes from **Mock data** to **Live data** (or **Live + mock** if only some providers are set up), and the dashboard badges turn green: **Fresh · just now**.

Other settings in the same dialog:

- **Auto-refresh every (minutes):** defaults to 15, the window used by the freshness badge.
- **Use mock data only:** ignores your keys temporarily (handy for demos, or when you're over a rate limit).
- **Clear all saved data:** removes your keys, watchlist, preferences and cached data from this browser.

Your watchlist, DRIP inputs and position-sizer inputs are saved automatically as you type.

---

## How each section works

### Live dashboard & freshness badge

- **Price / Day change / Day %** come from Finnhub's `/quote` endpoint (for US stocks on the free plan this is usually real-time or close to it).
- **Freshness badge:**
  - 🟢 **Fresh · 3m ago** means real data fetched in the last 15 minutes.
  - 🟠 **Stale · 42m ago** means real data older than 15 minutes, usually because the API was throttled and the last good value came from cache.
  - ⚪ **Mock** means simulated data (no key, or the provider failed and there was nothing cached).
- Click **↻ Refresh** to force a new fetch at any time.

### Safe Growth screen

Each stock is checked against six rules (thresholds live in `src/logic/safeGrowth.js`):

| Check | Passes when | Why it matters |
|---|---|---|
| Profitable | Net margin > 0% | Unprofitable companies can't fund growth or dividends from earnings. **This one is required.** |
| Long-term EPS growth | 5-year EPS growth > 0% | Earnings that compound over time drive long-term returns. |
| Stable recent EPS | TTM EPS change > −10% | Screens out a sharp recent earnings collapse. |
| Reasonable valuation | 0 < P/E < 25 | Avoids overpaying; a negative P/E means losses. |
| Sustainable dividend | Payout ratio < 75% (payers only) | Leaves room to keep raising the dividend. |
| Lower volatility | Beta < 1.2 | Smaller swings are easier to hold through. |

**Rating:** 🛡️ *Safe Growth* = profitable **and** at least 80% of the available checks pass. 👀 *Watch* = at least 50% pass. ⚠️ *Higher Risk* = fewer than that. If Finnhub doesn't provide a metric (common for ETFs like SCHD), that check is **skipped**, not failed. With fewer than three usable checks the stock shows *Not enough data*.

> REITs (like **O**) usually fail the payout-ratio and P/E checks because those are earnings-based. REITs are judged on FFO instead, which the free APIs don't provide. Treat their rating with that in mind.

### Dividend tracker

- **Annual / share** comes from Finnhub's `dividendPerShareAnnual`. If that's missing, it's computed from the latest Alpaca payout × payouts per year.
- **Payout cycle** is inferred from the spacing between past ex-dates (monthly, quarterly, semi-annual, annual).
- **Next ex-date** labels:
  - **Announced** is a real date from Alpaca.
  - **Estimated** means no date is announced yet, so it's projected from the last ex-date and the payout cycle.
  - **Sample** is mock data. Add Alpaca keys for real dates.
- **$/yr per $100** is how many dollars of yearly dividends $100 invested would earn at today's yield.

### Ex-dividend alerts: how "days left to buy" is calculated

To receive a dividend you must **own the shares before the ex-dividend date**. US stocks settle T+1, so the **last day to buy is the trading day before the ex-date**. Selling *on or after* the ex-date still gets you the payout.

Example: the ex-date is **Wednesday, Oct 7**.
- Last day to buy: **Tuesday, Oct 6** (before the close).
- Hold through: **Wednesday, Oct 7** (don't sell before the market opens that day).
- If today is Saturday, Oct 3, the banner says **"Buy KO by Tue, Oct 6 — 3 days left"**.

Colour coding: 🔴 last day or ≤ 3 days left · 🟠 ≤ 10 days · ⚪ later. *Too late* means the buy window has closed, but current holders still get paid. The calendar widget marks ex-dates in green and the last day to buy with an amber dot.

> Market holidays aren't modelled. If the day before an ex-date is a holiday, the real deadline is a day earlier, so leave yourself a day of margin.

### DRIP simulator

- Pick a stock (price and dividend fill in automatically and can be edited), then enter **shares you own**, years, and optional monthly contributions.
- The model runs month by month. The price compounds at your *price growth %*, and the dividend per share rises once a year by your *dividend growth %*. On each payout month, `dividend = shares × (annual dividend ÷ payouts per year)`, which buys `dividend ÷ price` fractional shares.
- **Milestones** show what the first payout buys, how long until reinvested dividends alone add **0.1 share** and **1 full share**, and how long until they double your original share count.
- Untick **Reinvest** to compare against taking dividends as cash.
- Taxes, fees and changes in yield aren't modelled. It's a planning aid, not a forecast.

### Small-capital risk helper

Two caps decide the most you should put into one stock; the **smaller** one wins:

1. **Max per stock (%)**: a diversification cap. With $100 and 20%, that's $20 per stock.
2. **Risk cap**: `pool × max loss % ÷ stop-loss %`. With $100, 2% max loss and a 10% stop, that's also $20, so a 10% drop costs you at most $2.

The table shows, for every watchlist stock, how many **fractional** shares that budget buys (needs a broker that supports fractional shares, e.g. Fidelity, Schwab, Robinhood, M1, Public) and how many **whole** shares it buys, plus the cash left over.

---

## Where your data is stored

- All settings (API keys, watchlist, calculator inputs) are saved in your **browser's LocalStorage**, under keys starting with `stocktracker.`, for `http://localhost:8080` only.
- API responses are cached in LocalStorage too (`stocktracker.cache.v1`) to save rate-limit budget.
- Keys are only ever sent to:
  - **finnhub.io**, directly from your browser over HTTPS.
  - **Alpaca**, through `server.js` running on your machine. It forwards your keys as request headers to `https://data.alpaca.markets` and doesn't log or store them. The server listens on `127.0.0.1` only, so other devices on your network can't use it, and it only forwards the corporate-actions endpoint.
- **Be aware:** LocalStorage is **not encrypted**. Anyone with access to your computer account or browser profile could read it. So:
  - only use free/paper-trading keys,
  - don't use this on a shared or public computer,
  - use **Settings → Clear all saved data** when you're done on a machine you don't own.
- The repo's `.gitignore` excludes `.env` files. Your keys never live in the project folder, so they can't be committed by accident.

### Why is there a server at all?

Browsers block web pages from calling APIs on other domains unless the API allows it (CORS). Finnhub allows it, but Alpaca's market-data API doesn't. `server.js` (about 100 lines, no dependencies) serves the app and forwards only the Alpaca dividend request.

---

## Rate limits & mock-data fallback

- **Finnhub free:** 60 calls/minute. StockTracker keeps itself under 55/minute, caches fundamentals for 12 hours and company names for 7 days, and re-fetches quotes only once per refresh interval. A watchlist of about 15 tickers fits easily.
- **Alpaca:** one request covers the whole watchlist, cached for 6 hours.
- **When something goes wrong** (no key, wrong key, HTTP 429 throttling, network down), the app:
  1. shows a toast explaining what happened, e.g. *"Finnhub rate limit reached — showing cached or mock data instead."*,
  2. uses the **last good real data** from cache if there is any (badge: *Stale*),
  3. otherwise falls back to **mock data** for that ticker (badge: *Mock*).

  The page never goes blank.
- After a `429`, Finnhub calls pause for 60 seconds. After a rejected key, the app stops calling with that key until you change it.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Blank, unstyled page | You opened `index.html` with `file://`. Run `node server.js` and open http://localhost:8080. If the page is unstyled but works, the Tailwind CDN is blocked; check your internet connection or ad-blocker. |
| "Finnhub rejected the API key" | Copy the key again from the Finnhub dashboard (no spaces), paste it in Settings, then Save. |
| "Finnhub rate limit reached" | Wait a minute, or trim your watchlist. Cached or mock data is shown in the meantime. |
| "Alpaca proxy not found" | You're using `python -m http.server` or another static server. Use `node server.js`. |
| "Alpaca rejected the API key" | Make sure you copied **paper** keys, both the Key ID **and** the Secret, and that you didn't regenerate them afterwards. |
| Ticker shows "(simulated)" | Finnhub has no data for that symbol (typo, or not a US listing). Remove it, or check the symbol. |
| ETF shows "Not enough data" | Normal. Finnhub's free fundamentals don't cover most ETFs. |
| Port 8080 already in use | `PORT=3000 node server.js` |

---

## Project structure

```
StockTracker/
├── index.html              # Page layout (Tailwind via CDN, dark theme)
├── server.js               # Zero-dependency static server + Alpaca proxy (127.0.0.1 only)
├── package.json            # npm start / npm test (no dependencies)
├── src/
│   ├── main.js             # App bootstrap, state, refresh timer, wiring
│   ├── config.js           # LocalStorage settings (keys, watchlist, inputs)
│   ├── api/
│   │   ├── provider.js     # real → cache → mock fallback; freshness metadata
│   │   ├── finnhub.js      # quotes, fundamentals, profile + rate limiting
│   │   ├── alpaca.js       # cash-dividend corporate actions (via proxy)
│   │   ├── mock.js         # deterministic sample data
│   │   └── errors.js
│   ├── logic/              # Pure functions with no DOM, unit-tested
│   │   ├── safeGrowth.js   # screening rules & rating
│   │   ├── dividends.js    # payout cycle, ex-date estimate, buy-by window
│   │   ├── drip.js         # DRIP simulation & milestones
│   │   ├── sizing.js       # small-account position sizer
│   │   └── dates.js        # timezone-safe date maths
│   └── ui/                 # One module per section
│       ├── dashboard.js  safeGrowthCard.js  dividendTable.js  exDivAlerts.js
│       ├── dripSimulator.js  positionSizer.js  settings.js
│       └── badges.js  format.js  toast.js
└── tests/
    └── logic.test.js       # node:test suite for the logic layer
```

To change the default watchlist or calculator defaults, edit `DEFAULT_SETTINGS` in `src/config.js`. To tweak the screening thresholds, edit `DEFAULT_THRESHOLDS` in `src/logic/safeGrowth.js`.

---

## Running the tests

```bash
npm test
```

This uses Node's built-in test runner, so there's nothing to install. It covers the screening rules, ex-dividend buy-by maths (including weekends), payout-cycle detection, DRIP milestones and position sizing.

---

## License

MIT. Use it, fork it, and compound responsibly.
