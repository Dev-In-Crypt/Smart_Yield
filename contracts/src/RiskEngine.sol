// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IStrategy} from "./interfaces/IStrategy.sol";
import {StrategyRegistry} from "./StrategyRegistry.sol";

/// @title RiskEngine
/// @notice Validates rebalance proposals before VaultManager executes them.
///
/// Rules enforced:
///   1. Sum of new allocations == 10 000 bps (100%).
///   2. Every proposed strategy is whitelisted and not paused.
///   3. No strategy exceeds its registered cap.
///   4. New weighted APY > current weighted APY + minImprovementBps.
contract RiskEngine is Ownable {
    StrategyRegistry public immutable registry;
    uint256 public minImprovementBps = 25; // 0.25%

    // ─── Custom errors ───────────────────────────────────────────────────────

    error EmptyAllocation();
    error LengthMismatch();
    error InvalidAllocationSum(uint256 got);
    error StrategyNotAllowed(address strategy);
    error AllocationExceedsLimit(address strategy, uint256 requested, uint256 max);
    error ImprovementBelowThreshold(uint256 currentAPY, uint256 projectedAPY);

    event MinImprovementBpsSet(uint256 newValue);

    constructor(address _registry, address initialOwner) Ownable(initialOwner) {
        registry = StrategyRegistry(_registry);
    }

    function setMinImprovementBps(uint256 value) external onlyOwner {
        minImprovementBps = value;
        emit MinImprovementBpsSet(value);
    }

    // ─── Core validation ─────────────────────────────────────────────────────

    /// @param newStrategies     Proposed strategy addresses.
    /// @param newBps            Proposed allocations in basis points.
    /// @param currentStrategies Active strategy addresses before rebalance.
    /// @param currentBps        Active allocations before rebalance.
    function validate(
        address[] calldata newStrategies,
        uint256[] calldata newBps,
        address[] memory currentStrategies,
        uint256[] memory currentBps
    ) external view {
        if (newStrategies.length == 0) revert EmptyAllocation();
        if (newStrategies.length != newBps.length) revert LengthMismatch();
        if (currentStrategies.length != currentBps.length) revert LengthMismatch();

        // Rule 1 — sum
        uint256 sum;
        for (uint256 i = 0; i < newBps.length; i++) {
            sum += newBps[i];
        }
        if (sum != 10_000) revert InvalidAllocationSum(sum);

        // Rule 2 & 3 — whitelist and caps
        for (uint256 i = 0; i < newStrategies.length; i++) {
            address strategy = newStrategies[i];
            if (!registry.isAllowed(strategy)) revert StrategyNotAllowed(strategy);
            uint256 cap = registry.maxAllocationBps(strategy);
            if (newBps[i] > cap) revert AllocationExceedsLimit(strategy, newBps[i], cap);
        }

        // Rule 4 — APY improvement
        uint256 currentWeightedAPY = _weightedAPY(currentStrategies, currentBps);
        uint256 newWeightedAPY = _weightedAPY_calldata(newStrategies, newBps);

        if (newWeightedAPY < currentWeightedAPY + minImprovementBps) {
            revert ImprovementBelowThreshold(currentWeightedAPY, newWeightedAPY);
        }
    }

    // ─── Internal helpers ────────────────────────────────────────────────────

    function _weightedAPY(address[] memory strategies, uint256[] memory bps)
        internal
        view
        returns (uint256)
    {
        if (strategies.length == 0) return 0;
        uint256 weighted;
        for (uint256 i = 0; i < strategies.length; i++) {
            weighted += IStrategy(strategies[i]).getAPY() * bps[i];
        }
        return weighted / 10_000;
    }

    function _weightedAPY_calldata(address[] calldata strategies, uint256[] calldata bps)
        internal
        view
        returns (uint256)
    {
        if (strategies.length == 0) return 0;
        uint256 weighted;
        for (uint256 i = 0; i < strategies.length; i++) {
            weighted += IStrategy(strategies[i]).getAPY() * bps[i];
        }
        return weighted / 10_000;
    }
}
