'use strict';

// ── Mock ethers (v6) ──────────────────────────────────────────────────────────
// executor.js uses: const { ethers } = require('ethers')
// All classes are accessed as ethers.Wallet, ethers.Contract, etc.

const mockNonce     = jest.fn().mockResolvedValue(BigInt(0));
const mockExecuteFn = jest.fn().mockResolvedValue({
  hash: '0xdeadbeef',
  wait: jest.fn().mockResolvedValue({ blockNumber: 42 }),
});
const mockSign      = jest.fn().mockResolvedValue('0xsignature');
const mockGetNetwork = jest.fn().mockResolvedValue({ chainId: BigInt(1337) });

jest.mock('ethers', () => {
  const actual = jest.requireActual('ethers');
  return {
    ethers: {
      // Keep pure utility functions from real ethers
      keccak256:   actual.ethers.keccak256,
      hashMessage: actual.ethers.hashMessage,
      getBytes:    actual.ethers.getBytes,
      AbiCoder:    actual.ethers.AbiCoder,
      // Mock constructors
      Wallet: jest.fn().mockImplementation(() => ({
        signMessage: mockSign,
      })),
      Contract: jest.fn().mockImplementation(() => ({
        nonce:   mockNonce,
        execute: mockExecuteFn,
      })),
      JsonRpcProvider: jest.fn().mockImplementation(() => ({
        getNetwork: mockGetNetwork,
      })),
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

// All-lowercase 42-char addresses — always pass ethers v6 checksum validation
const ADDR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ADDR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function makeDb(queryMock = jest.fn().mockResolvedValue({})) {
  return { query: queryMock };
}

function makeProvider() {
  const { ethers } = require('ethers');
  return new ethers.JsonRpcProvider();
}

const currentAllocations = { [ADDR_A]: 5000, [ADDR_B]: 5000 };
const recommendation = {
  allocations: { [ADDR_A]: 7000, [ADDR_B]: 3000 }, // max delta = 2000 bps
  explanation: 'Rebalanced for better yield',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('executor', () => {
  beforeEach(() => {
    process.env.KEEPER_PRIVATE_KEY          = '0x' + 'a'.repeat(64);
    process.env.KEEPER_EXECUTOR_ADDRESS     = '0xExecutor';
    process.env.MIN_REBALANCE_THRESHOLD_BPS = '50';
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.KEEPER_PRIVATE_KEY;
    delete process.env.KEEPER_EXECUTOR_ADDRESS;
    delete process.env.MIN_REBALANCE_THRESHOLD_BPS;
  });

  test('submits tx when delta exceeds threshold', async () => {
    const { execute } = require('../executor');
    await execute(recommendation, currentAllocations, makeProvider(), makeDb());
    expect(mockExecuteFn).toHaveBeenCalledTimes(1);
  });

  test('writes triggered=true to DB on successful execution', async () => {
    const dbQuery = jest.fn().mockResolvedValue({});
    const { execute } = require('../executor');
    await execute(recommendation, currentAllocations, makeProvider(), makeDb(dbQuery));
    const [sql, params] = dbQuery.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO rebalance_history/);
    expect(params).toContain('0xdeadbeef'); // tx_hash
    expect(params).toContain(true);         // triggered
  });

  test('skips tx when delta is below threshold', async () => {
    process.env.MIN_REBALANCE_THRESHOLD_BPS = '5000'; // higher than 2000
    const { execute } = require('../executor');
    await execute(recommendation, currentAllocations, makeProvider(), makeDb());
    expect(mockExecuteFn).not.toHaveBeenCalled();
  });

  test('writes triggered=false to DB when skipped', async () => {
    process.env.MIN_REBALANCE_THRESHOLD_BPS = '5000';
    const dbQuery = jest.fn().mockResolvedValue({});
    const { execute } = require('../executor');
    await execute(recommendation, currentAllocations, makeProvider(), makeDb(dbQuery));
    const [, params] = dbQuery.mock.calls[0];
    expect(params).toContain(false); // triggered = false
  });

  test('skips tx when allocations are identical (delta = 0)', async () => {
    const sameRec = { allocations: { ...currentAllocations }, explanation: 'No change' };
    const { execute } = require('../executor');
    await execute(sameRec, currentAllocations, makeProvider(), makeDb());
    expect(mockExecuteFn).not.toHaveBeenCalled();
  });
});
