#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONTRACTS_DIR = path.join(ROOT, 'contracts');
const DEPLOY_SCRIPTS = ['DeployLocal.s.sol', 'Deploy.s.sol'];

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function lower(addr) {
  return typeof addr === 'string' ? addr.toLowerCase() : addr;
}

function resolveRunFile(chainIdArg, scriptArg) {
  const env = parseEnv(path.join(CONTRACTS_DIR, '.env'));
  const chainId = chainIdArg || env.CHAIN_ID;

  const scripts = scriptArg ? [scriptArg] : DEPLOY_SCRIPTS;

  if (chainId) {
    for (const scriptName of scripts) {
      const candidate = path.join(
        CONTRACTS_DIR,
        'broadcast',
        scriptName,
        String(chainId),
        'run-latest.json'
      );
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } else {
    for (const scriptName of scripts) {
      const scriptDir = path.join(CONTRACTS_DIR, 'broadcast', scriptName);
      if (!fs.existsSync(scriptDir)) continue;
      const entries = fs.readdirSync(scriptDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const candidate = path.join(scriptDir, entry.name, 'run-latest.json');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }
  }
  throw new Error(`Broadcast file not found. Checked scripts: ${scripts.join(', ')}`);
}

function extractContracts(run) {
  const txs = Array.isArray(run.transactions) ? run.transactions : [];
  const creates = txs.filter((t) => String(t.transactionType).toUpperCase() === 'CREATE');

  const byName = new Map();
  for (const tx of creates) {
    if (!tx.contractName || !tx.contractAddress) continue;
    const arr = byName.get(tx.contractName) || [];
    arr.push(lower(tx.contractAddress));
    byName.set(tx.contractName, arr);
  }

  const strategies = byName.get('MockYieldStrategy') || [];

  const out = {
    mockUsdc: (byName.get('MockUSDC') || [])[0],
    strategyRegistry: (byName.get('StrategyRegistry') || [])[0],
    riskEngine: (byName.get('RiskEngine') || [])[0],
    vaultManager: (byName.get('VaultManager') || [])[0],
    keeperExecutor: (byName.get('KeeperExecutor') || [])[0],
  };

  if (strategies[0]) out.strategyA = strategies[0];
  if (strategies[1]) out.strategyB = strategies[1];
  if (strategies[2]) out.strategyC = strategies[2];

  return out;
}

function main() {
  const runFile = resolveRunFile(process.argv[2], process.argv[3]);
  const run = readJson(runFile);
  const deployments = extractContracts(run);

  const required = ['strategyRegistry', 'riskEngine', 'vaultManager', 'keeperExecutor'];
  const missing = required.filter((k) => !deployments[k]);
  if (missing.length) {
    throw new Error(`Could not extract required deployments: ${missing.join(', ')}`);
  }

  const outPath = path.join(CONTRACTS_DIR, 'deployments.json');
  fs.writeFileSync(outPath, `${JSON.stringify(deployments, null, 2)}\n`);

  console.log(`Wrote ${outPath}`);
  console.log(JSON.stringify(deployments, null, 2));
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}
