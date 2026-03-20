// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IStrategy} from "./interfaces/IStrategy.sol";
import {StrategyRegistry} from "./StrategyRegistry.sol";
import {RiskEngine} from "./RiskEngine.sol";

/// @title VaultManager
/// @notice ERC-4626 vault that aggregates yield across multiple strategies.
///         Only a whitelisted KEEPER (KeeperExecutor) can rebalance.
contract VaultManager is ERC4626, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Math for uint256;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    StrategyRegistry public immutable registry;
    RiskEngine public immutable riskEngine;

    mapping(address => uint256) public strategyAllocations; // strategy → bps
    address[] public activeStrategies;

    // ─── Events ──────────────────────────────────────────────────────────────

    event Rebalanced(address[] strategies, uint256[] newBps);
    event StrategyFunded(address indexed strategy, uint256 amount);
    event StrategyCollected(address indexed strategy, uint256 amount);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(IERC20 _asset, address _registry, address _riskEngine, address admin)
        ERC4626(_asset)
        ERC20("Smart Yield Vault", "SYV")
    {
        registry = StrategyRegistry(_registry);
        riskEngine = RiskEngine(_riskEngine);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ─── ERC-4626 overrides ──────────────────────────────────────────────────

    /// @notice Sum of idle balance + all strategy TVLs.
    function totalAssets() public view override returns (uint256 total) {
        total = IERC20(asset()).balanceOf(address(this));
        for (uint256 i = 0; i < activeStrategies.length; i++) {
            total += IStrategy(activeStrategies[i]).getTVL();
        }
    }

    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        shares = super.deposit(assets, receiver);
        _deployToStrategies();
    }

    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        assets = super.mint(shares, receiver);
        _deployToStrategies();
    }

    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 shares)
    {
        _collectFromStrategies(assets);
        shares = super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256 assets)
    {
        uint256 needed = previewRedeem(shares);
        _collectFromStrategies(needed);
        assets = super.redeem(shares, receiver, owner);
    }

    // ─── Keeper ──────────────────────────────────────────────────────────────

    /// @notice Rebalance vault allocations across strategies.
    ///         Validates via RiskEngine, withdraws all funds, redeploys.
    function rebalance(address[] calldata strategies, uint256[] calldata newBps)
        external
        onlyRole(KEEPER_ROLE)
    {
        // Build current state snapshot for RiskEngine
        uint256 len = activeStrategies.length;
        address[] memory currentStrats = new address[](len);
        uint256[] memory currentBps = new uint256[](len);
        for (uint256 i = 0; i < len; i++) {
            currentStrats[i] = activeStrategies[i];
            currentBps[i] = strategyAllocations[activeStrategies[i]];
        }

        riskEngine.validate(strategies, newBps, currentStrats, currentBps);

        // Withdraw everything from current strategies
        _withdrawAll();

        // Clear old allocations
        for (uint256 i = 0; i < len; i++) {
            strategyAllocations[activeStrategies[i]] = 0;
        }
        delete activeStrategies;

        // Apply new allocations
        for (uint256 i = 0; i < strategies.length; i++) {
            strategyAllocations[strategies[i]] = newBps[i];
            activeStrategies.push(strategies[i]);
        }

        _deployToStrategies();

        emit Rebalanced(strategies, newBps);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function getActiveStrategies() external view returns (address[] memory) {
        return activeStrategies;
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /// @dev Distribute idle balance to strategies according to their bps.
    function _deployToStrategies() internal {
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        if (balance == 0 || activeStrategies.length == 0) return;

        for (uint256 i = 0; i < activeStrategies.length; i++) {
            address strategy = activeStrategies[i];
            uint256 alloc = strategyAllocations[strategy];
            if (alloc == 0) continue;

            uint256 amount = balance.mulDiv(alloc, 10_000);
            if (amount == 0) continue;

            IERC20(asset()).forceApprove(strategy, amount);
            IStrategy(strategy).deposit(amount);
            emit StrategyFunded(strategy, amount);
        }
    }

    /// @dev Withdraw all assets from every active strategy back to this contract.
    function _withdrawAll() internal {
        for (uint256 i = 0; i < activeStrategies.length; i++) {
            address strategy = activeStrategies[i];
            uint256 tvl = IStrategy(strategy).getTVL();
            if (tvl == 0) continue;
            uint256 received = IStrategy(strategy).withdraw(tvl);
            emit StrategyCollected(strategy, received);
        }
    }

    /// @dev Pull `needed` assets from strategies proportionally to their TVL.
    ///      A top-up pass handles rounding remainder.
    function _collectFromStrategies(uint256 needed) internal {
        uint256 available = IERC20(asset()).balanceOf(address(this));
        if (available >= needed) return;

        uint256 deficit = needed - available;

        // Calculate total TVL across strategies
        uint256 totalTVL;
        for (uint256 i = 0; i < activeStrategies.length; i++) {
            totalTVL += IStrategy(activeStrategies[i]).getTVL();
        }
        if (totalTVL == 0) return;

        // Proportional withdrawal
        for (uint256 i = 0; i < activeStrategies.length; i++) {
            address strategy = activeStrategies[i];
            uint256 tvl = IStrategy(strategy).getTVL();
            if (tvl == 0) continue;

            uint256 toWithdraw = deficit.mulDiv(tvl, totalTVL);
            if (toWithdraw == 0) continue;

            uint256 received = IStrategy(strategy).withdraw(toWithdraw);
            emit StrategyCollected(strategy, received);
        }

        // Top-up pass: handle rounding so the vault always covers the withdrawal
        uint256 stillNeeded = needed > IERC20(asset()).balanceOf(address(this))
            ? needed - IERC20(asset()).balanceOf(address(this))
            : 0;

        if (stillNeeded > 0) {
            for (uint256 i = 0; i < activeStrategies.length; i++) {
                address strategy = activeStrategies[i];
                uint256 tvl = IStrategy(strategy).getTVL();
                if (tvl >= stillNeeded) {
                    uint256 received = IStrategy(strategy).withdraw(stillNeeded);
                    emit StrategyCollected(strategy, received);
                    break;
                }
            }
        }
    }

    // ─── Required overrides ──────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
