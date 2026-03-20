// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title StrategyRegistry
/// @notice Whitelist of yield strategies with per-strategy allocation caps and pause control.
contract StrategyRegistry is Ownable {
    uint256 public constant DEFAULT_MAX_ALLOCATION_BPS = 3500; // 35%

    mapping(address => bool) public whitelisted;
    mapping(address => uint256) public maxAllocationBps;
    mapping(address => bool) public paused;

    address[] private _strategies;

    // ─── Events ──────────────────────────────────────────────────────────────

    event StrategyAdded(address indexed strategy, uint256 maxBps);
    event StrategyRemoved(address indexed strategy);
    event MaxAllocationSet(address indexed strategy, uint256 maxBps);
    event StrategyPaused(address indexed strategy, bool isPaused);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address initialOwner) Ownable(initialOwner) {}

    // ─── Owner actions ───────────────────────────────────────────────────────

    /// @param strategy Address of the strategy contract.
    /// @param maxBps   Maximum allocation in basis points; 0 defaults to 35%.
    function addStrategy(address strategy, uint256 maxBps) external onlyOwner {
        require(strategy != address(0), "Zero address");
        require(maxBps <= 10000, "maxBps > 100%");
        require(!whitelisted[strategy], "Already whitelisted");

        whitelisted[strategy] = true;
        maxAllocationBps[strategy] = maxBps == 0 ? DEFAULT_MAX_ALLOCATION_BPS : maxBps;
        _strategies.push(strategy);

        emit StrategyAdded(strategy, maxAllocationBps[strategy]);
    }

    function removeStrategy(address strategy) external onlyOwner {
        require(whitelisted[strategy], "Not whitelisted");

        whitelisted[strategy] = false;
        maxAllocationBps[strategy] = 0;

        uint256 len = _strategies.length;
        for (uint256 i = 0; i < len; i++) {
            if (_strategies[i] == strategy) {
                _strategies[i] = _strategies[len - 1];
                _strategies.pop();
                break;
            }
        }

        emit StrategyRemoved(strategy);
    }

    function setMaxAllocation(address strategy, uint256 maxBps) external onlyOwner {
        require(whitelisted[strategy], "Not whitelisted");
        require(maxBps <= 10000, "maxBps > 100%");

        maxAllocationBps[strategy] = maxBps;
        emit MaxAllocationSet(strategy, maxBps);
    }

    function pauseStrategy(address strategy, bool isPaused) external onlyOwner {
        require(whitelisted[strategy], "Not whitelisted");
        paused[strategy] = isPaused;
        emit StrategyPaused(strategy, isPaused);
    }

    // ─── Queries ─────────────────────────────────────────────────────────────

    /// @return True if the strategy is whitelisted and not paused.
    function isAllowed(address strategy) external view returns (bool) {
        return whitelisted[strategy] && !paused[strategy];
    }

    function getStrategies() external view returns (address[] memory) {
        return _strategies;
    }

    function strategyCount() external view returns (uint256) {
        return _strategies.length;
    }
}
