// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IStrategy
/// @notice Interface that every yield strategy must implement.
///         VaultManager calls deposit/withdraw; the agent reads APY/TVL/risk.
interface IStrategy {
    /// @notice Deposit `amount` of underlying asset into the strategy.
    ///         Caller must have approved this contract for `amount` before calling.
    function deposit(uint256 amount) external;

    /// @notice Withdraw up to `amount` of underlying asset from the strategy.
    /// @return received The actual amount of underlying asset returned to the caller.
    function withdraw(uint256 amount) external returns (uint256 received);

    /// @notice Current annualised yield in basis points (e.g. 500 = 5.00%).
    function getAPY() external view returns (uint256);

    /// @notice Total value locked in this strategy, denominated in the underlying asset.
    function getTVL() external view returns (uint256);

    /// @notice Risk score: 0 = safest, 100 = riskiest.
    function getRiskScore() external view returns (uint8);

    /// @notice The ERC-20 token this strategy accepts and returns.
    function asset() external view returns (address);
}
