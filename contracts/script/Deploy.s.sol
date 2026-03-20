// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StrategyRegistry}    from "../src/StrategyRegistry.sol";
import {RiskEngine}          from "../src/RiskEngine.sol";
import {VaultManager}        from "../src/VaultManager.sol";
import {KeeperExecutor}      from "../src/KeeperExecutor.sol";
import {MockYieldStrategy}   from "../src/strategies/MockYieldStrategy.sol";

/// @notice Deployment order:
///   1. StrategyRegistry
///   2. RiskEngine(registry)
///   3. VaultManager(usdc, registry, riskEngine)
///   4. KeeperExecutor(vaultManager, agentSigner)
///   5. Grant KEEPER_ROLE → KeeperExecutor
///   6. Deploy 3 × MockYieldStrategy for demo
///   7. Register strategies
///
/// Required env vars:
///   PRIVATE_KEY            — deployer key
///   USDC_ADDRESS           — bridged USDC on the target chain
///   AGENT_SIGNER_ADDRESS   — public address of the AI-agent signing key
contract Deploy is Script {
    function run() external {
        address deployer    = vm.envAddress("DEPLOYER_ADDRESS");
        address usdcAddress = vm.envAddress("USDC_ADDRESS");
        address agentSigner = vm.envAddress("AGENT_SIGNER_ADDRESS");

        vm.startBroadcast();

        // ── 1. StrategyRegistry ──────────────────────────────────────────────
        StrategyRegistry registry = new StrategyRegistry(deployer);
        console2.log("StrategyRegistry :", address(registry));

        // ── 2. RiskEngine ────────────────────────────────────────────────────
        RiskEngine riskEngine = new RiskEngine(address(registry), deployer);
        console2.log("RiskEngine       :", address(riskEngine));

        // ── 3. VaultManager ──────────────────────────────────────────────────
        VaultManager vaultManager = new VaultManager(
            IERC20(usdcAddress),
            address(registry),
            address(riskEngine),
            deployer
        );
        console2.log("VaultManager     :", address(vaultManager));

        // ── 4. KeeperExecutor ────────────────────────────────────────────────
        KeeperExecutor keeperExecutor = new KeeperExecutor(
            address(vaultManager),
            agentSigner,
            deployer
        );
        console2.log("KeeperExecutor   :", address(keeperExecutor));

        // ── 5. Grant KEEPER_ROLE ─────────────────────────────────────────────
        vaultManager.grantRole(vaultManager.KEEPER_ROLE(), address(keeperExecutor));
        console2.log("KEEPER_ROLE granted to KeeperExecutor");

        // ── 6. Demo strategies ───────────────────────────────────────────────
        // APY / risk values are intentionally varied to make the dashboard interesting.
        MockYieldStrategy strategyA = new MockYieldStrategy(
            usdcAddress, address(vaultManager), 620, 22, deployer
        );
        MockYieldStrategy strategyB = new MockYieldStrategy(
            usdcAddress, address(vaultManager), 480, 35, deployer
        );
        MockYieldStrategy strategyC = new MockYieldStrategy(
            usdcAddress, address(vaultManager), 310, 15, deployer
        );
        console2.log("StrategyA (6.20%): ", address(strategyA));
        console2.log("StrategyB (4.80%): ", address(strategyB));
        console2.log("StrategyC (3.10%): ", address(strategyC));

        // ── 7. Register strategies (max 35% each) ────────────────────────────
        registry.addStrategy(address(strategyA), 3500);
        registry.addStrategy(address(strategyB), 3500);
        registry.addStrategy(address(strategyC), 3500);
        console2.log("All strategies registered");

        vm.stopBroadcast();

        // Print deployments.json compatible output
        console2.log("\n--- deployments.json ---");
        console2.log("{");
        console2.log('  "strategyRegistry" : "%s",', address(registry));
        console2.log('  "riskEngine"       : "%s",', address(riskEngine));
        console2.log('  "vaultManager"     : "%s",', address(vaultManager));
        console2.log('  "keeperExecutor"   : "%s",', address(keeperExecutor));
        console2.log('  "strategyA"        : "%s",', address(strategyA));
        console2.log('  "strategyB"        : "%s",', address(strategyB));
        console2.log('  "strategyC"        : "%s"',  address(strategyC));
        console2.log("}");
    }
}
