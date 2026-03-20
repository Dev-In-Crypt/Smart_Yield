'use strict';

/**
 * Score each strategy with a composite metric:
 *
 *   compositeScore = (normalizedAPY  × 0.5)
 *                  + (normalizedTVL  × 0.2)
 *                  + (invertedRisk   × 0.3)
 *
 * All inputs are normalised to [0, 1] relative to the current strategy set.
 * A score of 1.0 means "best across all three dimensions".
 *
 * @param {Array<{ address, apy, tvl, riskScore, currentBps }>} strategies
 * @returns {Array<{ address, apy, tvl, riskScore, currentBps, compositeScore }>}
 */
function score(strategies) {
  if (!strategies.length) return [];

  const apys       = strategies.map((s) => s.apy);
  const tvls       = strategies.map((s) => Number(s.tvl));
  const riskScores = strategies.map((s) => s.riskScore);

  const maxAPY  = Math.max(...apys)  || 1;
  const maxTVL  = Math.max(...tvls)  || 1;
  const maxRisk = Math.max(...riskScores) || 1;

  return strategies.map((s) => {
    const normalizedAPY  = s.apy         / maxAPY;
    const normalizedTVL  = Number(s.tvl) / maxTVL;
    const invertedRisk   = 1 - s.riskScore / maxRisk; // lower risk → higher score

    const compositeScore =
      normalizedAPY  * 0.5 +
      normalizedTVL  * 0.2 +
      invertedRisk   * 0.3;

    return { ...s, compositeScore: Math.round(compositeScore * 1e6) / 1e6 };
  });
}

module.exports = { score };
