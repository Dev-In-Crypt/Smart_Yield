# Smart Yield Vaults on Initia

AI-assisted ERC-4626 vault on Initia EVM with signed keeper execution, risk-checked rebalancing, and dashboard analytics.

## Quick Start

```bash
# 1. Start local Initia rollup (requires weave CLI + Docker)
weave rollup start -d

# 2. Deploy contracts
cd contracts && cp .env.example .env
# set PRIVATE_KEY in .env, then:
forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://localhost:8545 --broadcast

# 3. Configure frontend
cd frontend && cp .env.local.example .env.local
# set NEXT_PUBLIC_VAULT_MANAGER_ADDRESS from deployments.json

# 4. Run
cd frontend && npm install && npm run dev
# Open http://localhost:3000
```

> **Live on testnet**: Connect MetaMask to **Initia EVM testnet** (Chain ID `2124225178762456`, RPC `https://jsonrpc-evm-1.anvil.asia-southeast.initia.xyz`). Contracts already deployed — see `contracts/deployments.json`.

---

## Initia Hackathon Submission

- **Project Name**: Smart Yield Vaults
- **Demo video**: https://youtu.be/cd49jNYWVvo
- **Vault contract**: `0x9Cea0FAb316bBcc54aAc9D7C08B901E936c62a48` (Initia EVM testnet, chain `2124225178762456`)
- **Native feature**: Interwoven Bridge via InterwovenKit

### Project Overview

Smart Yield Vaults is an AI-assisted DeFi vault that allocates user deposits across multiple onchain strategies and rebalances when risk-adjusted yield improves. The app targets users who want passive yield with transparent risk controls and visible rebalance history.

### Implementation Detail

- **The Custom Implementation**: We built an ERC-4626 vault stack with StrategyRegistry + RiskEngine + KeeperExecutor signature flow, then connected it to an offchain scoring/recommendation agent that proposes allocations and executes signed rebalances.
- **The Native Feature**: We integrated `interwoven-bridge` through InterwovenKit so users can bridge assets from L1 into the rollup directly from the app before interacting with the vault.

### How to Run Locally

1. Launch your appchain and bots with `weave init`, then verify RPC at `http://localhost:26657` and EVM JSON-RPC at `http://localhost:8545`.
2. Deploy contracts locally with `cd contracts && PRIVATE_KEY=<key> forge script script/DeployLocal.s.sol:DeployLocal --rpc-url http://localhost:8545 --broadcast`.
3. Start services: `cd agent && npm install && npm start`, then `cd frontend && npm install && npm run dev`.
4. Open the frontend, connect via InterwovenKit, bridge funds, and run the vault flow on `/vault` and `/dashboard`.

## Hackathon Requirements Status

- [x] Own Minitia setup documented with manual `weave init` flow
- [x] InterwovenKit integrated in frontend
- [x] Interwoven Bridge feature exposed in UI
- [x] `.initia/submission.json` added
- [x] Project README present

## Repo Structure

- `contracts/` Foundry contracts and tests
- `agent/` Node.js AI keeper + Postgres logging
- `frontend/` Next.js app with vault and dashboard
- `docker-compose.yml` local postgres + agent + frontend

## 1) Run your own Minitia (manual weave init)

Hackathon baseline network values (from Initia docs):

- L1 network: `initiation-2` (testnet)
- Rollup type: local Interwoven rollup
- VM: `EVM (minievm)`
- Current rollup chain ID: `local-rollup-1` (or your unique `<name>-1`)
- Local endpoints: `http://localhost:26657` (RPC), `http://localhost:1317` (REST), `http://localhost:8545` (EVM JSON-RPC)

Run this manually in a terminal:

```bash
weave init
```

Recommended choices:

- VM: `evm`
- Data availability: `INITIA`
- Keyring backend: `test`

Then start the rollup:

```bash
weave rollup start -d
```

Verify runtime:

```bash
curl -s "http://localhost:26657/status" | jq -r '.result.node_info.network'
curl -s "http://localhost:8545" -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}'
```

## 2) Contracts

```bash
cd contracts
cp .env.example .env
forge install
forge test
```

Deploy:

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

## 3) Agent

```bash
cd agent
cp .env.example .env
npm install
npm test
npm start
```

## 4) Frontend (InterwovenKit + Bridge)

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev
```

The top navigation has:

- `Connect Initia` (InterwovenKit)
- `Bridge` (opens Interwoven Bridge)

Vault page also includes an `Open Bridge` panel for funding before deposit.

## 5) Local full stack with Docker

```bash
docker compose up --build
```

Services:

- frontend: `http://localhost:3000`
- postgres: `localhost:5432`

## Demo Flow

1. Open `/` and show protocol landing.
2. Use `Bridge` to fund wallet (Interwoven).
3. Go to `/vault` and deposit USDC.
4. Open `/dashboard` and show allocations/history.
5. Wait for cron cycle and show new rebalance entry.

## Submission JSON (auto-fill after deploy)

After contract deployment, create `contracts/deployments.json`.

Option A (automatic from Foundry broadcast):

```bash
node .initia/extract-deployments-from-broadcast.js
```

Option B (manual template):

```bash
cp contracts/deployments.json.example contracts/deployments.json
```

Then fill addresses:

```json
{
  "strategyRegistry": "0x...",
  "riskEngine": "0x...",
  "vaultManager": "0x...",
  "keeperExecutor": "0x..."
}
```

Then run:

```bash
node .initia/generate-submission.js
```

Or use one command for both steps:

```bash
npm run submission:refresh
```

This updates `.initia/submission.json` using:

- `contracts/.env` for `chain_id` and `rpc_url`
- `contracts/deployments.json` for deployed contract addresses
