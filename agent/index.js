'use strict';

require('dotenv').config();

const cron    = require('node-cron');
const { ethers } = require('ethers');
const { Pool }   = require('pg');

const { collect }   = require('./src/collector');
const { score }     = require('./src/scorer');
const { recommend } = require('./src/recommender');
const { execute }   = require('./src/executor');

// ─── Validate required env vars ──────────────────────────────────────────────

const REQUIRED_ENV = [
  'RPC_URL',
  'VAULT_MANAGER_ADDRESS',
  'STRATEGY_REGISTRY_ADDRESS',
  'KEEPER_EXECUTOR_ADDRESS',
  'KEEPER_PRIVATE_KEY',
  'ANTHROPIC_API_KEY',
  'DATABASE_URL',
];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required env var: ${key}`);
    process.exit(1);
  }
}

// ─── Shared singletons ───────────────────────────────────────────────────────

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const db       = new Pool({ connectionString: process.env.DATABASE_URL });

const INTERVAL_MINUTES = Number(process.env.CRON_INTERVAL_MINUTES ?? 30);
const CRON_EXPRESSION  = `*/${INTERVAL_MINUTES} * * * *`;

// ─── Main loop ───────────────────────────────────────────────────────────────

async function runCycle() {
  console.log(`\n[${new Date().toISOString()}] ── Starting rebalance cycle ──`);

  try {
    const { strategies, currentAllocations } = await collect(provider);

    if (!strategies.length) {
      console.log('[cycle] No strategies found — skipping');
      return;
    }

    const scored         = score(strategies);
    const recommendation = await recommend(scored);
    await execute(recommendation, currentAllocations, provider, db);
  } catch (err) {
    // Never crash the process — log and continue
    console.error('[cycle] ERROR:', err.message ?? err);
  }

  console.log(`[${new Date().toISOString()}] ── Cycle complete ──`);
}

// ─── Start ───────────────────────────────────────────────────────────────────

console.log(`[startup] Agent starting — cron: every ${INTERVAL_MINUTES} min`);

// Run immediately on startup, then on schedule
runCycle();

cron.schedule(CRON_EXPRESSION, runCycle);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM received — closing DB pool');
  await db.end();
  process.exit(0);
});
