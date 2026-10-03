// Dividend Reinvestment Plan simulator.
//
// Month-by-month model: the share price compounds monthly at `priceGrowthPct`,
// the dividend per share steps up once a year by `dividendGrowthPct`, and on
// each payout month every dividend dollar buys fractional shares at that
// month's price. Optional monthly contributions buy shares too, but are tracked
// separately so the "shares gained from dividends alone" figure stays honest.

const MAX_MONTHS = 600; // 50 years — upper bound for milestone searches

/**
 * @param {object} p
 * @param {number} p.shares             starting share count
 * @param {number} p.price              current share price
 * @param {number} p.annualDividend     current annual dividend per share
 * @param {number} p.frequency          payouts per year (12, 4, 2, 1)
 * @param {number} [p.years=10]         horizon for the timeline
 * @param {number} [p.priceGrowthPct=0] expected annual price growth, %
 * @param {number} [p.dividendGrowthPct=0] expected annual dividend growth, %
 * @param {number} [p.monthlyContribution=0] extra cash invested each month, $
 * @param {boolean} [p.reinvest=true]   false = dividends are taken as cash
 */
export function simulateDrip(p) {
  const shares0 = Math.max(0, Number(p.shares) || 0);
  const price0 = Math.max(0, Number(p.price) || 0);
  const dps0 = Math.max(0, Number(p.annualDividend) || 0);
  const frequency = Number(p.frequency) || 0;
  const years = Math.min(50, Math.max(1, Math.round(Number(p.years) || 10)));
  const priceGrowth = (Number(p.priceGrowthPct) || 0) / 100;
  const dividendGrowth = (Number(p.dividendGrowthPct) || 0) / 100;
  const contribution = Math.max(0, Number(p.monthlyContribution) || 0);
  const reinvest = p.reinvest !== false;

  const horizon = years * 12;
  const monthlyPriceFactor = Math.pow(1 + priceGrowth, 1 / 12);
  const interval = frequency > 0 ? Math.round(12 / frequency) : 0;

  let shares = shares0;
  let price = price0;
  let dps = dps0;
  let dripShares = 0;
  let contributedShares = 0;
  let totalDividends = 0;
  let cashDividends = 0;
  let totalContributed = 0;
  let firstPayout = null;
  let summary = null;

  const milestones = { tenthShare: null, fullShare: null, doubled: null };
  const timeline = [{ month: 0, shares, price, value: shares * price, dripShares: 0, dividends: 0 }];

  const canRun = price0 > 0 && (shares0 > 0 || contribution > 0);
  const lastMonth = canRun ? MAX_MONTHS : 0;

  for (let m = 1; m <= lastMonth; m++) {
    price *= monthlyPriceFactor;
    if (m > 1 && (m - 1) % 12 === 0) dps *= 1 + dividendGrowth;

    if (contribution > 0) {
      const bought = contribution / price;
      shares += bought;
      contributedShares += bought;
      totalContributed += contribution;
    }

    let paid = 0;
    if (interval > 0 && m % interval === 0) {
      paid = shares * (dps / frequency);
      totalDividends += paid;
      if (reinvest) {
        const bought = paid / price;
        shares += bought;
        dripShares += bought;
        if (!firstPayout) firstPayout = { month: m, cash: paid, sharesBought: bought };
      } else {
        cashDividends += paid;
        if (!firstPayout) firstPayout = { month: m, cash: paid, sharesBought: 0 };
      }
    }

    if (reinvest) {
      if (milestones.tenthShare === null && dripShares >= 0.1) milestones.tenthShare = m;
      if (milestones.fullShare === null && dripShares >= 1) milestones.fullShare = m;
      if (milestones.doubled === null && shares0 > 0 && dripShares >= shares0) milestones.doubled = m;
    }

    if (m <= horizon) {
      if (m % 12 === 0 || m === horizon) {
        timeline.push({ month: m, shares, price, value: shares * price, dripShares, dividends: totalDividends });
      }
      if (m === horizon) {
        summary = {
          years,
          endShares: shares,
          dripShares,
          contributedShares,
          endPrice: price,
          endValue: shares * price + cashDividends,
          totalDividends,
          cashDividends,
          totalContributed,
          startValue: shares0 * price0,
          annualIncomeEnd: shares * dps,
        };
      }
    }

    const done =
      m >= horizon &&
      (!reinvest ||
        interval === 0 ||
        (milestones.tenthShare !== null && milestones.fullShare !== null && (shares0 === 0 || milestones.doubled !== null)));
    if (done) break;
  }

  return {
    summary: summary ?? {
      years,
      endShares: shares0,
      dripShares: 0,
      contributedShares: 0,
      endPrice: price0,
      endValue: shares0 * price0,
      totalDividends: 0,
      cashDividends: 0,
      totalContributed: 0,
      startValue: shares0 * price0,
      annualIncomeEnd: shares0 * dps0,
    },
    timeline,
    milestones,
    firstPayout,
  };
}

/** Human readable "2 yrs 3 mos" for a month count. */
export function formatMonths(months) {
  if (months === null || months === undefined) return `More than ${MAX_MONTHS / 12} years`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} yr${y === 1 ? '' : 's'}`);
  if (m || !y) parts.push(`${m} mo${m === 1 ? '' : 's'}`);
  return parts.join(' ');
}
