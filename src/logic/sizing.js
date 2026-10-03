// Position sizer for small accounts.
//
// Two independent caps decide how much cash goes into one position:
//   1. Allocation cap — never put more than `maxPositionPct` of the pool in a single stock.
//   2. Risk cap — if the price falls by `stopLossPct`, lose at most `riskPct` of the pool.
//      (position = pool × risk% ÷ stop%)
// The smaller cap wins. Whole and fractional share counts are both reported,
// because many small-account brokers support fractional shares and some don't.

const round = (n, dp) => Math.floor(n * 10 ** dp + 1e-9) / 10 ** dp;

/**
 * @param {object} p
 * @param {number} p.pool            total account cash, $
 * @param {number} p.price           share price, $
 * @param {number} [p.maxPositionPct=20]
 * @param {number} [p.riskPct=2]     max loss as % of pool
 * @param {number} [p.stopLossPct=10] planned stop-loss / tolerated drawdown, %
 * @param {number} [p.fractionDecimals=4] broker precision for fractional shares
 */
export function sizePosition(p) {
  const pool = Math.max(0, Number(p.pool) || 0);
  const price = Math.max(0, Number(p.price) || 0);
  const maxPositionPct = clampPct(p.maxPositionPct ?? 20);
  const riskPct = clampPct(p.riskPct ?? 2);
  const stopLossPct = clampPct(p.stopLossPct ?? 10);
  const decimals = Math.max(0, Math.min(8, Math.round(p.fractionDecimals ?? 4)));

  const allocationCap = pool * (maxPositionPct / 100);
  const riskCap = stopLossPct > 0 ? (pool * (riskPct / 100)) / (stopLossPct / 100) : allocationCap;
  const budget = Math.min(allocationCap, riskCap, pool);
  const limitedBy = riskCap < allocationCap ? 'risk' : 'allocation';

  if (price <= 0 || budget <= 0) {
    return {
      budget, allocationCap, riskCap, limitedBy,
      fractional: { shares: 0, cost: 0, leftover: budget },
      whole: { shares: 0, cost: 0, leftover: budget },
      maxLossAtStop: 0,
      canAffordWhole: false,
      poolLeftAfterFractional: pool,
    };
  }

  const fractionalShares = round(budget / price, decimals);
  const fractionalCost = round(fractionalShares * price, 2);
  const wholeShares = Math.floor(budget / price + 1e-9);
  const wholeCost = round(wholeShares * price, 2);

  return {
    budget,
    allocationCap,
    riskCap,
    limitedBy,
    fractional: { shares: fractionalShares, cost: fractionalCost, leftover: round(budget - fractionalCost, 2) },
    whole: { shares: wholeShares, cost: wholeCost, leftover: round(budget - wholeCost, 2) },
    maxLossAtStop: round(fractionalCost * (stopLossPct / 100), 2),
    canAffordWhole: wholeShares >= 1,
    poolLeftAfterFractional: round(pool - fractionalCost, 2),
  };
}

function clampPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}
