#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const submissionPath = path.join(__dirname, 'submission.json');
const contractsEnvPath = path.join(ROOT, 'contracts', '.env');
const contractsDeploymentsPath = path.join(ROOT, 'contracts', 'deployments.json');

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  const env = parseEnv(contractsEnvPath);
  const deployments = readJson(contractsDeploymentsPath) || {};

  if (!fs.existsSync(submissionPath)) {
    console.error('Missing .initia/submission.json');
    process.exit(1);
  }

  const submission = readJson(submissionPath);
  if (!submission) {
    console.error('Invalid .initia/submission.json');
    process.exit(1);
  }

  let commitSha = submission.commit_sha || '';
  try {
    commitSha = cp.execSync('git rev-parse HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {}

  submission.project_name = submission.project_name || 'Smart Yield Vaults';
  submission.repo_url = submission.repo_url || 'https://github.com/Dev-In-Crypt/initiaHack';
  submission.commit_sha = commitSha || 'REPLACE_WITH_COMMIT_SHA';
  submission.rollup_chain_id = submission.rollup_chain_id || 'local-rollup-1';
  submission.deployed_address = deployments.vaultManager || submission.deployed_address || 'REPLACE_WITH_DEPLOYED_ADDRESS';
  submission.vm = 'evm';
  submission.native_feature = 'interwoven-bridge';
  submission.core_logic_path = submission.core_logic_path || 'contracts/src/VaultManager.sol';
  submission.native_feature_frontend_path = submission.native_feature_frontend_path || 'frontend/components/InterwovenActions.tsx';
  submission.demo_video_url = submission.demo_video_url || 'https://youtu.be/REPLACE_WITH_YOUR_DEMO_VIDEO';

  fs.writeFileSync(submissionPath, `${JSON.stringify(submission, null, 2)}\n`);
  console.log(`Updated ${submissionPath}`);
}

main();
