// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IStrategy} from "../interfaces/IStrategy.sol";

/// @title MockYieldStrategy
/// @notice Strategy with owner-controllable APY and risk score.
///         Holds deposited tokens on contract — no actual yield generated.
///         Used for Foundry tests and hackathon demo.
contract MockYieldStrategy is IStrategy, Ownable {
    using SafeERC20 for IERC20;

    address private immutable _asset;
    address public vaultManager;

    uint256 public mockAPY;       // basis points
    uint8   public mockRiskScore; // 0–100

    event MockAPYSet(uint256 apy);
    event MockRiskScoreSet(uint8 score);
    event VaultManagerSet(address indexed vm);

    modifier onlyVaultManager() {
        require(msg.sender == vaultManager, "Only vault manager");
        _;
    }

    constructor(
        address assetAddress,
        address _vaultManager,
        uint256 initialAPY,
        uint8   initialRiskScore,
        address initialOwner
    ) Ownable(initialOwner) {
        _asset       = assetAddress;
        vaultManager = _vaultManager;
        mockAPY      = initialAPY;
        mockRiskScore = initialRiskScore;
    }

    // ─── IStrategy ───────────────────────────────────────────────────────────

    function deposit(uint256 amount) external override onlyVaultManager {
        IERC20(_asset).safeTransferFrom(vaultManager, address(this), amount);
    }

    function withdraw(uint256 amount) external override onlyVaultManager returns (uint256 received) {
        uint256 balance = IERC20(_asset).balanceOf(address(this));
        received = amount > balance ? balance : amount;
        if (received > 0) {
            IERC20(_asset).safeTransfer(vaultManager, received);
        }
    }

    function getAPY() external view override returns (uint256) {
        return mockAPY;
    }

    function getTVL() external view override returns (uint256) {
        return IERC20(_asset).balanceOf(address(this));
    }

    function getRiskScore() external view override returns (uint8) {
        return mockRiskScore;
    }

    function asset() external view override returns (address) {
        return _asset;
    }

    // ─── Owner setters ───────────────────────────────────────────────────────

    function setMockAPY(uint256 apy) external onlyOwner {
        mockAPY = apy;
        emit MockAPYSet(apy);
    }

    function setMockRiskScore(uint8 score) external onlyOwner {
        mockRiskScore = score;
        emit MockRiskScoreSet(score);
    }

    function setVaultManager(address _vaultManager) external onlyOwner {
        vaultManager = _vaultManager;
        emit VaultManagerSet(_vaultManager);
    }
}
