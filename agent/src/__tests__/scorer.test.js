'use strict';

const { score } = require('../scorer');

// scorer is a pure function — no mocks needed

describe('scorer', () => {
  const makeStrategy = (overrides = {}) => ({
    address:    '0xabc',
    apy:        500,
    tvl:        100_000n,
    riskScore:  20,
    currentBps: 5000,
    ...overrides,
  });

  test('returns empty array for empty input', () => {
    expect(score([])).toEqual([]);
  });

  test('adds compositeScore field to each strategy', () => {
    const [s] = score([makeStrategy()]);
    expect(typeof s.compositeScore).toBe('number');
  });

  test('compositeScore is in [0, 1] range for a single strategy', () => {
    const [s] = score([makeStrategy()]);
    expect(s.compositeScore).toBeGreaterThanOrEqual(0);
    expect(s.compositeScore).toBeLessThanOrEqual(1);
  });

  test('highest APY strategy gets highest compositeScore when TVL and risk are equal', () => {
    const strategies = [
      makeStrategy({ address: '0x1', apy: 800 }),
      makeStrategy({ address: '0x2', apy: 400 }),
      makeStrategy({ address: '0x3', apy: 200 }),
    ];
    const scored = score(strategies);
    const byScore = [...scored].sort((a, b) => b.compositeScore - a.compositeScore);
    expect(byScore[0].address).toBe('0x1');
  });

  test('lower risk score produces higher compositeScore when APY and TVL are equal', () => {
    const strategies = [
      makeStrategy({ address: '0xSafe',   riskScore: 10 }),
      makeStrategy({ address: '0xRisky',  riskScore: 90 }),
    ];
    const scored = score(strategies);
    const safe  = scored.find((s) => s.address === '0xSafe');
    const risky = scored.find((s) => s.address === '0xRisky');
    expect(safe.compositeScore).toBeGreaterThan(risky.compositeScore);
  });

  test('higher TVL produces higher compositeScore when APY and risk are equal', () => {
    const strategies = [
      makeStrategy({ address: '0xBig',   tvl: 1_000_000n }),
      makeStrategy({ address: '0xSmall', tvl: 1_000n }),
    ];
    const scored = score(strategies);
    const big   = scored.find((s) => s.address === '0xBig');
    const small = scored.find((s) => s.address === '0xSmall');
    expect(big.compositeScore).toBeGreaterThan(small.compositeScore);
  });

  test('does not mutate input strategies', () => {
    const input = [makeStrategy()];
    const copy  = JSON.stringify(input, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    score(input);
    const after = JSON.stringify(input, (_, v) => (typeof v === 'bigint' ? v.toString() : v));
    expect(after).toBe(copy);
  });

  test('compositeScore weights: APY 50%, TVL 20%, invertedRisk 30%', () => {
    // Single strategy → all normalized to 1
    // compositeScore = 1*0.5 + 1*0.2 + 1*0.3 = 1.0
    const [s] = score([makeStrategy({ apy: 999, tvl: 999_999n, riskScore: 0 })]);
    expect(s.compositeScore).toBeCloseTo(1.0, 5);
  });

  test('worst possible strategy scores 0.5 when it has min risk among singletons', () => {
    // Single strategy: normalizedAPY=1, normalizedTVL=1, invertedRisk=1
    // All single-element sets normalize to 1 → score = 1
    const [s] = score([makeStrategy({ apy: 1, tvl: 1n, riskScore: 100 })]);
    // riskScore = 100, maxRisk = 100 → invertedRisk = 1 - 100/100 = 0
    // score = 1*0.5 + 1*0.2 + 0*0.3 = 0.7
    expect(s.compositeScore).toBeCloseTo(0.7, 5);
  });
});
