'use strict';

const { ethers } = require('ethers');

const KEEPER_EXECUTOR_ABI = [
  'function execute(address[] calldata strategies, uint256[] calldata newBps, bytes calldata signature) external',
  'function nonce() external view returns (uint256)',
  'function nextMessageHash(address[] calldata strategies, uint256[] calldata newBps) external view returns (bytes32 messageHash, bytes32 ethSignedHash)',
];

/**
 * Compare proposed allocations to current onchain allocations.
 * Returns the maximum delta in basis points across all strategies.
 *
 * @param {Record<string, number>} newAlloc    { address → bps }
 * @param {Record<string, number>} currentAlloc { address → bps }
 * @returns {number}
 */
function maxDelta(newAlloc, currentAlloc) {
  const allAddresses = new Set([
    ...Object.keys(newAlloc),
    ...Object.keys(currentAlloc),
  ]);

  let max = 0;
  for (const addr of allAddresses) {
    const delta = Math.abs((newAlloc[addr] ?? 0) - (currentAlloc[addr] ?? 0));
    if (delta > max) max = delta;
  }
  return max;
}

/**
 * Execute (or skip) the rebalance recommended by Claude.
 *
 * @param {{ allocations: Record<string,number>, explanation: string }} recommendation
 * @param {Record<string, number>} currentAllocations
 * @param {ethers.Provider} provider
 * @param {pg.Pool} db
 * @returns {Promise<void>}
 */
async function execute(recommendation, currentAllocations, provider, db) {
  const { allocations: newAlloc, explanation } = recommendation;
  const threshold = Number(process.env.MIN_REBALANCE_THRESHOLD_BPS ?? 50);

  const delta = maxDelta(newAlloc, currentAllocations);
  console.log(`[executor] Max delta: ${delta} bps (threshold: ${threshold} bps)`);

  const prevAllocJson = JSON.stringify(currentAllocations);
  const newAllocJson  = JSON.stringify(newAlloc);

  if (delta < threshold) {
    console.log('[executor] Delta below threshold — skipping rebalance');
    await db.query(
      `INSERT INTO rebalance_history (prev_alloc, new_alloc, explanation, triggered)
       VALUES ($1, $2, $3, $4)`,
      [prevAllocJson, newAllocJson, explanation, false],
    );
    return;
  }

  // Build sorted strategy / bps arrays
  const entries    = Object.entries(newAlloc);
  const strategies = entries.map(([addr]) => addr);
  const newBps     = entries.map(([, bps]) => bps);

  // Sign the message
  const signer      = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY, provider);
  const executor    = new ethers.Contract(process.env.KEEPER_EXECUTOR_ADDRESS, KEEPER_EXECUTOR_ABI, signer);
  const currentNonce = await executor.nonce();

  const messageHash = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['address[]', 'uint256[]', 'uint256', 'uint256'],
      [strategies, newBps, (await provider.getNetwork()).chainId, currentNonce],
    ),
  );
  const ethSignedHash = ethers.hashMessage(ethers.getBytes(messageHash));
  const signature     = await signer.signMessage(ethers.getBytes(messageHash));

  console.log('[executor] Submitting rebalance tx…');
  const tx = await executor.execute(strategies, newBps, signature);
  console.log(`[executor] TX submitted: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`[executor] TX confirmed in block ${receipt.blockNumber}`);

  await db.query(
    `INSERT INTO rebalance_history (tx_hash, prev_alloc, new_alloc, explanation, triggered)
     VALUES ($1, $2, $3, $4, $5)`,
    [tx.hash, prevAllocJson, newAllocJson, explanation, true],
  );

  console.log('[executor] Rebalance recorded in DB');
}

module.exports = { execute };
