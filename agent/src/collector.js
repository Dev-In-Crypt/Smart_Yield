'use strict';

const { ethers } = require('ethers');

// Minimal ABIs — only the functions we read from onchain
const STRATEGY_REGISTRY_ABI = [
  'function getStrategies() external view returns (address[])',
  'function isAllowed(address strategy) external view returns (bool)',
];

const STRATEGY_ABI = [
  'function getAPY() external view returns (uint256)',
  'function getTVL() external view returns (uint256)',
  'function getRiskScore() external view returns (uint8)',
];

const VAULT_MANAGER_ABI = [
  'function strategyAllocations(address) external view returns (uint256)',
  'function getActiveStrategies() external view returns (address[])',
];

/**
 * Collect raw metrics from every whitelisted strategy.
 *
 * @param {ethers.Provider} provider
 * @returns {Promise<{
 *   strategies: Array<{ address, apy, tvl, riskScore, currentBps }>,
 *   currentAllocations: Record<string, number>
 * }>}
 */
async function collect(provider) {
  const registryAddress  = process.env.STRATEGY_REGISTRY_ADDRESS;
  const vaultAddress     = process.env.VAULT_MANAGER_ADDRESS;

  if (!registryAddress || !vaultAddress) {
    throw new Error('Missing STRATEGY_REGISTRY_ADDRESS or VAULT_MANAGER_ADDRESS env var');
  }

  const registry = new ethers.Contract(registryAddress, STRATEGY_REGISTRY_ABI, provider);
  const vault    = new ethers.Contract(vaultAddress,    VAULT_MANAGER_ABI,     provider);

  // Fetch all whitelisted strategy addresses
  const [allStrategies, activeStrategies] = await Promise.all([
    registry.getStrategies(),
    vault.getActiveStrategies(),
  ]);

  // Build current allocation map: { address → bps }
  const currentAllocations = {};
  for (const addr of activeStrategies) {
    const bps = await vault.strategyAllocations(addr);
    currentAllocations[addr.toLowerCase()] = Number(bps);
  }

  // Fetch per-strategy metrics in parallel
  const strategies = await Promise.all(
    allStrategies.map(async (addr) => {
      const strategy = new ethers.Contract(addr, STRATEGY_ABI, provider);

      const [apyBps, tvlRaw, riskScore] = await Promise.all([
        strategy.getAPY(),
        strategy.getTVL(),
        strategy.getRiskScore(),
      ]);

      return {
        address:    addr.toLowerCase(),
        apy:        Number(apyBps),        // basis points, e.g. 500 = 5%
        tvl:        BigInt(tvlRaw),         // in USDC base units (6 decimals)
        riskScore:  Number(riskScore),      // 0–100
        currentBps: currentAllocations[addr.toLowerCase()] ?? 0,
      };
    }),
  );

  console.log(`[collector] Fetched ${strategies.length} strategies, ${activeStrategies.length} active`);
  return { strategies, currentAllocations };
}

module.exports = { collect };
