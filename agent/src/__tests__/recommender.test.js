'use strict';

// ── Mock Anthropic SDK ────────────────────────────────────────────────────────

const mockCreate = jest.fn();

jest.mock('@anthropic-ai/sdk', () => {
  return {
    default: class Anthropic {
      messages = { create: mockCreate };
    },
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const ADDR_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ADDR_B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

function makeStrategies(allocations = { [ADDR_A]: 5000, [ADDR_B]: 5000 }) {
  return Object.entries(allocations).map(([address, currentBps]) => ({
    address,
    apy:           500,
    tvl:           BigInt(100_000_000),
    riskScore:     20,
    currentBps,
    compositeScore: 0.75,
  }));
}

function mockResponse(allocations, explanation = 'Test explanation') {
  mockCreate.mockResolvedValueOnce({
    content: [{ text: JSON.stringify({ allocations, explanation }) }],
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('recommender', () => {
  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
  });

  test('returns parsed allocations and explanation', async () => {
    mockResponse({ [ADDR_A]: 6000, [ADDR_B]: 4000 });
    const { recommend } = require('../recommender');
    const result = await recommend(makeStrategies({ [ADDR_A]: 5000, [ADDR_B]: 5000 }));
    expect(result.allocations[ADDR_A]).toBe(6000);
    expect(result.explanation).toBe('Test explanation');
  });

  test('calls Claude with correct model', async () => {
    mockResponse({ [ADDR_A]: 5000, [ADDR_B]: 5000 });
    const { recommend } = require('../recommender');
    await recommend(makeStrategies());
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-sonnet-4-20250514' }),
    );
  });

  test('throws if allocations do not sum to 10000', async () => {
    mockResponse({ [ADDR_A]: 4000, [ADDR_B]: 4000 }); // sum = 8000
    const { recommend } = require('../recommender');
    await expect(recommend(makeStrategies())).rejects.toThrow(/sum to 8000/);
  });

  test('throws if response is not valid JSON', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ text: 'not json at all' }] });
    const { recommend } = require('../recommender');
    await expect(recommend(makeStrategies())).rejects.toThrow(/non-JSON/);
  });

  test('throws if response contains unknown strategy address', async () => {
    mockResponse({ '0xunknown': 5000, [ADDR_B]: 5000 });
    const { recommend } = require('../recommender');
    await expect(recommend(makeStrategies())).rejects.toThrow(/Unknown strategy/);
  });

  test('throws if allocations field is missing', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ text: JSON.stringify({ explanation: 'no allocations key' }) }],
    });
    const { recommend } = require('../recommender');
    await expect(recommend(makeStrategies())).rejects.toThrow(/allocations/);
  });
});
