// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {RiskEngine} from "../src/RiskEngine.sol";
import {StrategyRegistry} from "../src/StrategyRegistry.sol";
import {MockYieldStrategy} from "../src/strategies/MockYieldStrategy.sol";

contract MockToken is ERC20 {
    constructor() ERC20("T", "T") {}
}

contract RiskEngineTest is Test {
    StrategyRegistry  registry;
    RiskEngine        engine;

    MockYieldStrategy stratA; // APY 600 bps (6%)
    MockYieldStrategy stratB; // APY 500 bps (5%)
    MockYieldStrategy stratC; // APY 400 bps (4%)

    address admin = address(this);
    address vault = makeAddr("vault");

    function setUp() public {
        MockToken token = new MockToken();

        registry = new StrategyRegistry(admin);
        engine   = new RiskEngine(address(registry), admin);

        stratA = new MockYieldStrategy(address(token), vault, 600, 20, admin);
        stratB = new MockYieldStrategy(address(token), vault, 500, 30, admin);
        stratC = new MockYieldStrategy(address(token), vault, 400, 40, admin);

        registry.addStrategy(address(stratA), 5000);
        registry.addStrategy(address(stratB), 5000);
        registry.addStrategy(address(stratC), 5000);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _currentState() internal view returns (address[] memory strats, uint256[] memory bps) {
        strats = new address[](3);
        bps    = new uint256[](3);
        strats[0] = address(stratA); bps[0] = 3400;
        strats[1] = address(stratB); bps[1] = 3300;
        strats[2] = address(stratC); bps[2] = 3300;
        // currentWeightedAPY = (600*3400 + 500*3300 + 400*3300) / 10000 = 501 bps
    }

    // Builds new allocation that is strictly better than current (530 bps)
    function _goodAllocation() internal view returns (address[] memory strats, uint256[] memory bps) {
        strats = new address[](3);
        bps    = new uint256[](3);
        strats[0] = address(stratA); bps[0] = 5000;
        strats[1] = address(stratB); bps[1] = 3000;
        strats[2] = address(stratC); bps[2] = 2000;
        // newWeightedAPY = (600*5000 + 500*3000 + 400*2000) / 10000 = 530 bps
        // 530 >= 501 + 25 = 526 ✓
    }

    // ─── Passing case ────────────────────────────────────────────────────────

    function test_Validate_PassesValidAllocation() public view {
        (address[] memory cur, uint256[] memory curBps) = _currentState();
        (address[] memory strats, uint256[] memory bps) = _goodAllocation();
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── Sum check ───────────────────────────────────────────────────────────

    function test_Validate_RevertsOnSumMismatch() public {
        (address[] memory cur, uint256[] memory curBps) = _currentState();

        address[] memory strats = new address[](3);
        uint256[] memory bps    = new uint256[](3);
        strats[0] = address(stratA); bps[0] = 5000;
        strats[1] = address(stratB); bps[1] = 3000;
        strats[2] = address(stratC); bps[2] = 1000; // sum = 9000, not 10000

        vm.expectRevert(abi.encodeWithSelector(RiskEngine.InvalidAllocationSum.selector, 9000));
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── Cap check ───────────────────────────────────────────────────────────

    function test_Validate_RevertsOnExceededLimit() public {
        (address[] memory cur, uint256[] memory curBps) = _currentState();

        address[] memory strats = new address[](2);
        uint256[] memory bps    = new uint256[](2);
        strats[0] = address(stratA); bps[0] = 6000; // 60% > max 50%
        strats[1] = address(stratB); bps[1] = 4000;

        vm.expectRevert(
            abi.encodeWithSelector(
                RiskEngine.AllocationExceedsLimit.selector,
                address(stratA),
                6000,
                5000
            )
        );
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── APY improvement ─────────────────────────────────────────────────────

    function test_Validate_RevertsOnInsufficientImprovement() public {
        (address[] memory cur, uint256[] memory curBps) = _currentState();

        // Same allocation as current → same APY → delta = 0 < 25
        address[] memory strats = new address[](3);
        uint256[] memory bps    = new uint256[](3);
        strats[0] = address(stratA); bps[0] = 3400;
        strats[1] = address(stratB); bps[1] = 3300;
        strats[2] = address(stratC); bps[2] = 3300;

        vm.expectRevert(
            abi.encodeWithSelector(RiskEngine.ImprovementBelowThreshold.selector, 501, 501)
        );
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── Paused strategy ─────────────────────────────────────────────────────

    function test_Validate_RevertsOnPausedStrategy() public {
        (address[] memory cur, uint256[] memory curBps) = _currentState();

        registry.pauseStrategy(address(stratC), true);

        (address[] memory strats, uint256[] memory bps) = _goodAllocation();

        vm.expectRevert(
            abi.encodeWithSelector(RiskEngine.StrategyNotAllowed.selector, address(stratC))
        );
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── Not-whitelisted strategy ─────────────────────────────────────────────

    function test_Validate_RevertsOnUnknownStrategy() public {
        (address[] memory cur, uint256[] memory curBps) = _currentState();

        address unknown = makeAddr("unknown");
        address[] memory strats = new address[](2);
        uint256[] memory bps    = new uint256[](2);
        strats[0] = unknown;           bps[0] = 5000;
        strats[1] = address(stratB);   bps[1] = 5000;

        vm.expectRevert(
            abi.encodeWithSelector(RiskEngine.StrategyNotAllowed.selector, unknown)
        );
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── First-ever rebalance (empty current) ────────────────────────────────

    function test_Validate_PassesWithEmptyCurrentState() public view {
        address[] memory cur    = new address[](0);
        uint256[] memory curBps = new uint256[](0);
        (address[] memory strats, uint256[] memory bps) = _goodAllocation();
        // currentAPY = 0, newAPY = 530, 530 >= 0 + 25 ✓
        engine.validate(strats, bps, cur, curBps);
    }

    // ─── setMinImprovementBps ────────────────────────────────────────────────

    function test_SetMinImprovementBps() public {
        engine.setMinImprovementBps(100);
        assertEq(engine.minImprovementBps(), 100);
    }
}
