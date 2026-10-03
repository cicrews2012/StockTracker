// "Safe Growth" screen: a deliberately simple, explainable checklist for
// long-term compounders. Each rule passes, fails, or is skipped when data is
// missing, so a gap in free-tier data never silently counts against a stock.

export const DEFAULT_THRESHOLDS = {
  maxPE: 25,
  maxPayoutRatio: 75,
  minEpsGrowth5Y: 0,
  minEpsGrowthTTM: -10,
  maxBeta: 1.2,
};

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

/**
 * @param {object} f fundamentals: { netMargin, epsGrowth5Y, epsGrowthTTM, pe, payoutRatio, beta, dividendPerShare }
 *   (percent values are whole percents, e.g. 23.4 for 23.4 %)
 * @returns {{ rating: 'safe'|'watch'|'risky'|'unknown', label: string, score: number, available: number, checks: Array }}
 */
export function evaluateSafeGrowth(f = {}, thresholds = DEFAULT_THRESHOLDS) {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const paysDividend = isNum(f.dividendPerShare) && f.dividendPerShare > 0;

  const checks = [
    {
      id: 'netMargin',
      label: 'Profitable (net margin > 0%)',
      value: f.netMargin,
      unit: '%',
      pass: isNum(f.netMargin) ? f.netMargin > 0 : null,
      required: true,
    },
    {
      id: 'epsGrowth5Y',
      label: `Long-term EPS growth (5y > ${t.minEpsGrowth5Y}%)`,
      value: f.epsGrowth5Y,
      unit: '%',
      pass: isNum(f.epsGrowth5Y) ? f.epsGrowth5Y > t.minEpsGrowth5Y : null,
    },
    {
      id: 'epsGrowthTTM',
      label: `Stable recent EPS (TTM YoY > ${t.minEpsGrowthTTM}%)`,
      value: f.epsGrowthTTM,
      unit: '%',
      pass: isNum(f.epsGrowthTTM) ? f.epsGrowthTTM > t.minEpsGrowthTTM : null,
    },
    {
      id: 'pe',
      label: `Reasonable valuation (0 < P/E < ${t.maxPE})`,
      value: f.pe,
      unit: '×',
      pass: isNum(f.pe) ? f.pe > 0 && f.pe < t.maxPE : null,
    },
    {
      id: 'payoutRatio',
      label: `Sustainable dividend (payout < ${t.maxPayoutRatio}%)`,
      value: f.payoutRatio,
      unit: '%',
      // Non-payers have nothing to sustain, so the rule doesn't apply.
      pass: paysDividend && isNum(f.payoutRatio) ? f.payoutRatio >= 0 && f.payoutRatio < t.maxPayoutRatio : null,
    },
    {
      id: 'beta',
      label: `Lower volatility (beta < ${t.maxBeta})`,
      value: f.beta,
      unit: '',
      pass: isNum(f.beta) ? f.beta < t.maxBeta : null,
    },
  ];

  const evaluated = checks.filter((c) => c.pass !== null);
  const score = evaluated.filter((c) => c.pass).length;
  const available = evaluated.length;

  if (available < 3) {
    return { rating: 'unknown', label: 'Not enough data', score, available, checks };
  }

  const requiredFailed = checks.some((c) => c.required && c.pass === false);
  const ratio = score / available;
  let rating;
  if (!requiredFailed && ratio >= 0.8) rating = 'safe';
  else if (ratio >= 0.5) rating = 'watch';
  else rating = 'risky';

  const label = { safe: 'Safe Growth', watch: 'Watch', risky: 'Higher Risk' }[rating];
  return { rating, label, score, available, checks };
}
