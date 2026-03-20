'use strict';

// ── Mock ethers (v6) ──────────────────────────────────────────────────────────
// collector.js uses: const { ethers } = require('ethers'); new ethers.Contract(...)
// So the mock must expose Contract nested under the `ethers` namespace object.

const mockGetStrategies       = jest.fn();
const mockGetActiveStrategies = jest.fn();
const mockStrategyAllocations = jest.fn();
const mockGetAPY              = jest.fn();
const mockGetTVL              = jest.fn();
const mockGetRiskScore        = jest.fn();

jest.mock('ethers', () => {
  const makeInstance = (_addr, abi) => {
    if (abi.some((f) => f.includes('getStrategies'))) {
      return { getStrategies: mockGetStrategies };
    }
    if (abi.some((f) => f.includes('getActiveStrategies'))) {
      return {
        getActiveStrategies:  mockGetActiveStrategies,
        strategyAllocations:  mockStrategyAllocations,
      };
    }
    // Per-strategy contract
    return { getAPY: mockGetAPY, getTVL: mockGetTVL, getRiskScore: mockGetRiskScore };
  };

  return {
    ethers: {
      Contract: jest.fn().mockImplementation(makeInstance),
    },
  };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('collector', () => {
  const ADDR_A = '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const ADDR_B = '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';

  beforeEach(() => {
    process.env.STRATEGY_REGISTRY_ADDRESS = '0xRegistry';
    process.env.VAULT_MANAGER_ADDRESS     = '0xVault';

    mockGetStrategies.mockResolvedValue([ADDR_A, ADDR_B]);
    mockGetActiveStrategies.mockResolvedValue([ADDR_A]);
    mockStrategyAllocations.mockResolvedValue(BigInt(6000));
    mockGetAPY.mockResolvedValue(BigInt(500));
    mockGetTVL.mockResolvedValue(BigInt(100_000_000));
    mockGetRiskScore.mockResolvedValue(25);
  });

  afterEach(() => {
    delete process.env.STRATEGY_REGISTRY_ADDRESS;
    delete process.env.VAULT_MANAGER_ADDRESS;
    jest.clearAllMocks();
  });

  test('returns one entry per whitelisted strategy', async () => {
    jest.resetModules();
    const { collect } = require('../collector');
    const { strategies } = await collect({});
    expect(strategies).toHaveLength(2);
  });

  test('maps onchain values correctly', async () => {
    jest.resetModules();
    const { collect } = require('../collector');
    const { strategies } = await collect({});
    const [s] = strategies;
    expect(s.apy).toBe(500);
    expect(s.tvl).toBe(BigInt(100_000_000));
    expect(s.riskScore).toBe(25);
  });

  test('currentBps is set for active strategies', async () => {
    jest.resetModules();
    const { collect } = require('../collector');
    const { strategies } = await collect({});
    const active = strategies.find((s) => s.address === ADDR_A.toLowerCase());
    expect(active.currentBps).toBe(6000);
  });

  test('currentBps defaults to 0 for non-active strategies', async () => {
    jest.resetModules();
    const { collect } = require('../collector');
    const { strategies } = await collect({});
    const inactive = strategies.find((s) => s.address === ADDR_B.toLowerCase());
    expect(inactive.currentBps).toBe(0);
  });

  test('throws if VAULT_MANAGER_ADDRESS is missing', async () => {
    delete process.env.VAULT_MANAGER_ADDRESS;
    jest.resetModules();
    const { collect } = require('../collector');
    await expect(collect({})).rejects.toThrow(/VAULT_MANAGER_ADDRESS/);
  });
});
