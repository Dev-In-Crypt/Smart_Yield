// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {VaultManager} from "../src/VaultManager.sol";
import {StrategyRegistry} from "../src/StrategyRegistry.sol";
import {RiskEngine} from "../src/RiskEngine.sol";
import {MockYieldStrategy} from "../src/strategies/MockYieldStrategy.sol";

/// @dev Minimal ERC-20 used in tests.
contract MockERC20 is ERC20 {
    uint8 private _dec;

    constructor(string memory name, string memory symbol, uint8 dec) ERC20(name, symbol) {
        _dec = dec;
    }

    function decimals() public view override returns (uint8) {
        return _dec;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VaultManagerTest is Test {
    MockERC20         usdc;
    StrategyRegistry  registry;
    RiskEngine        riskEngine;
    VaultManager      vault;
    MockYieldStrategy strategyA; // 6.00% APY, risk 20
    MockYieldStrategy strategyB; // 5.00% APY, risk 30
    MockYieldStrategy strategyC; // 4.00% APY, risk 40

    address admin  = address(this);
    address keeper = makeAddr("keeper");
    address alice  = makeAddr("alice");

    function setUp() public {
        usdc       = new MockERC20("USD Coin", "USDC", 6);
        registry   = new StrategyRegistry(admin);
        riskEngine = new RiskEngine(address(registry), admin);
        vault      = new VaultManager(IERC20(address(usdc)), address(registry), address(riskEngine), admin);

        strategyA = new MockYieldStrategy(address(usdc), address(vault), 600, 20, admin);
        strategyB = new MockYieldStrategy(address(usdc), address(vault), 500, 30, admin);
        strategyC = new MockYieldStrategy(address(usdc), address(vault), 400, 40, admin);

        // Max cap 50% each so we can test allocations up to 50%
        registry.addStrategy(address(strategyA), 5000);
        registry.addStrategy(address(strategyB), 5000);
        registry.addStrategy(address(strategyC), 5000);

        vault.grantRole(vault.KEEPER_ROLE(), keeper);

        // Initial rebalance: 34/33/33
        // New weighted APY = 600*3400 + 500*3300 + 400*3300 = 2_040_000+1_650_000+1_320_000 = 5_010_000 / 10000 = 501 bps
        // Current weighted APY = 0 (no active strategies yet)
        // 501 >= 0 + 25 ✓
        address[] memory strats = new address[](3);
        strats[0] = address(strategyA);
        strats[1] = address(strategyB);
        strats[2] = address(strategyC);

        uint256[] memory bps = new uint256[](3);
        bps[0] = 3400;
        bps[1] = 3300;
        bps[2] = 3300;

        vm.prank(keeper);
        vault.rebalance(strats, bps);
    }

    // ─── Deposit ─────────────────────────────────────────────────────────────

    function test_Deposit_MintsCorrectShares() public {
        uint256 amount = 3_000e6;
        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        vm.stopPrank();

        // First depositor: shares == assets (1:1 before any yield)
        assertEq(shares, amount, "shares != assets on first deposit");
        assertEq(vault.balanceOf(alice), shares, "share balance mismatch");
    }

    function test_Deposit_DeploysToStrategies() public {
        uint256 amount = 3_000e6;
        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);
        vm.stopPrank();

        // Strategies should now hold the deposited funds
        uint256 tvlA = strategyA.getTVL();
        uint256 tvlB = strategyB.getTVL();
        uint256 tvlC = strategyC.getTVL();

        // Allocations: 34/33/33 of 3000e6
        assertApproxEqAbs(tvlA, 1020e6, 2, "strategyA TVL mismatch");
        assertApproxEqAbs(tvlB,  990e6, 2, "strategyB TVL mismatch");
        assertApproxEqAbs(tvlC,  990e6, 2, "strategyC TVL mismatch");
    }

    // ─── TotalAssets ─────────────────────────────────────────────────────────

    function test_TotalAssets_SumsAllStrategies() public {
        uint256 amount = 3_000e6;
        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);
        vm.stopPrank();

        // totalAssets ≈ deposited amount (no yield simulated)
        assertApproxEqAbs(vault.totalAssets(), amount, 3, "totalAssets mismatch");
    }

    // ─── Withdraw ────────────────────────────────────────────────────────────

    function test_Withdraw_BurnsCorrectShares() public {
        uint256 amount = 3_000e6;
        usdc.mint(alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);

        uint256 sharesBefore = vault.balanceOf(alice);
        vault.redeem(sharesBefore, alice, alice);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 0, "shares not zero after full redeem");
        // Alice should get back ≈ deposited amount
        assertApproxEqAbs(usdc.balanceOf(alice), amount, 3, "USDC returned mismatch");
    }

    // ─── Rebalance ───────────────────────────────────────────────────────────

    function test_Rebalance_UpdatesAllocations() public {
        uint256 amount = 3_000e6;
        usdc.mint(alice, amount);
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);
        vm.stopPrank();

        // New allocation: 50/30/20
        // New weighted APY = 600*5000 + 500*3000 + 400*2000 = 3_000_000+1_500_000+800_000 = 5_300_000 / 10000 = 530 bps
        // Current: 501 bps  →  530 >= 501 + 25 = 526 ✓
        address[] memory strats = new address[](3);
        strats[0] = address(strategyA);
        strats[1] = address(strategyB);
        strats[2] = address(strategyC);

        uint256[] memory bps = new uint256[](3);
        bps[0] = 5000;
        bps[1] = 3000;
        bps[2] = 2000;

        vm.prank(keeper);
        vault.rebalance(strats, bps);

        assertEq(vault.strategyAllocations(address(strategyA)), 5000);
        assertEq(vault.strategyAllocations(address(strategyB)), 3000);
        assertEq(vault.strategyAllocations(address(strategyC)), 2000);
    }

    function test_Rebalance_RevertsIfNotKeeper() public {
        address[] memory strats = new address[](1);
        strats[0] = address(strategyA);
        uint256[] memory bps = new uint256[](1);
        bps[0] = 10000;

        vm.prank(alice);
        vm.expectRevert();
        vault.rebalance(strats, bps);
    }

    function test_Rebalance_PreservesTotalAssets() public {
        uint256 amount = 3_000e6;
        usdc.mint(alice, amount);
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);
        vm.stopPrank();

        uint256 totalBefore = vault.totalAssets();

        address[] memory strats = new address[](3);
        strats[0] = address(strategyA);
        strats[1] = address(strategyB);
        strats[2] = address(strategyC);
        uint256[] memory bps = new uint256[](3);
        bps[0] = 5000;
        bps[1] = 3000;
        bps[2] = 2000;

        vm.prank(keeper);
        vault.rebalance(strats, bps);

        // totalAssets should be unchanged (MockYieldStrategy has no slippage)
        assertApproxEqAbs(vault.totalAssets(), totalBefore, 3, "totalAssets changed after rebalance");
    }
}
