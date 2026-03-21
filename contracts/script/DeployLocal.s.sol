// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StrategyRegistry} from "../src/StrategyRegistry.sol";
import {RiskEngine} from "../src/RiskEngine.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {KeeperExecutor} from "../src/KeeperExecutor.sol";
import {MockYieldStrategy} from "../src/strategies/MockYieldStrategy.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract DeployLocal is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(privateKey);
        address agentSigner = vm.envOr("AGENT_SIGNER_ADDRESS", deployer);

        vm.startBroadcast(privateKey);

        MockUSDC usdc = new MockUSDC(deployer);
        StrategyRegistry registry = new StrategyRegistry(deployer);
        RiskEngine riskEngine = new RiskEngine(address(registry), deployer);
        VaultManager vaultManager = new VaultManager(IERC20(address(usdc)), address(registry), address(riskEngine), deployer);
        KeeperExecutor keeperExecutor = new KeeperExecutor(address(vaultManager), agentSigner, deployer);

        vaultManager.grantRole(vaultManager.KEEPER_ROLE(), address(keeperExecutor));

        MockYieldStrategy strategyA = new MockYieldStrategy(address(usdc), address(vaultManager), 620, 22, deployer);
        MockYieldStrategy strategyB = new MockYieldStrategy(address(usdc), address(vaultManager), 480, 35, deployer);
        MockYieldStrategy strategyC = new MockYieldStrategy(address(usdc), address(vaultManager), 310, 15, deployer);

        registry.addStrategy(address(strategyA), 3500);
        registry.addStrategy(address(strategyB), 3500);
        registry.addStrategy(address(strategyC), 3500);

        vm.stopBroadcast();

        console2.log("MockUSDC         :", address(usdc));
        console2.log("StrategyRegistry :", address(registry));
        console2.log("RiskEngine       :", address(riskEngine));
        console2.log("VaultManager     :", address(vaultManager));
        console2.log("KeeperExecutor   :", address(keeperExecutor));
        console2.log("StrategyA        :", address(strategyA));
        console2.log("StrategyB        :", address(strategyB));
        console2.log("StrategyC        :", address(strategyC));
    }
}
