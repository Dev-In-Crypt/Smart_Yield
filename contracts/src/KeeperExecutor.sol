// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {VaultManager} from "./VaultManager.sol";

/// @title KeeperExecutor
/// @notice Trustless relay between the offchain AI agent and VaultManager.
///
/// The agent signs (strategies, newBps, chainId, nonce) with its private key.
/// This contract verifies the signature, increments the nonce to prevent replay,
/// then calls VaultManager.rebalance().
contract KeeperExecutor is Ownable {
    using ECDSA for bytes32;

    VaultManager public vaultManager;
    address public authorizedSigner;
    uint256 public nonce;

    // ─── Events & Errors ─────────────────────────────────────────────────────

    event Executed(uint256 indexed nonce, address[] strategies, uint256[] newBps, bytes32 msgHash);
    event AuthorizedSignerSet(address indexed oldSigner, address indexed newSigner);
    event VaultManagerSet(address indexed newVaultManager);

    error InvalidSignature();

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _vaultManager, address _authorizedSigner, address initialOwner)
        Ownable(initialOwner)
    {
        vaultManager = VaultManager(_vaultManager);
        authorizedSigner = _authorizedSigner;
    }

    // ─── Keeper entry point ──────────────────────────────────────────────────

    /// @notice Execute a rebalance signed by the authorised agent.
    /// @param strategies  Strategy addresses in the new allocation.
    /// @param newBps      Basis points per strategy (must sum to 10 000).
    /// @param signature   ECDSA signature over keccak256(abi.encode(strategies, newBps, chainid, nonce)).
    function execute(
        address[] calldata strategies,
        uint256[] calldata newBps,
        bytes calldata signature
    ) external {
        bytes32 messageHash = keccak256(abi.encode(strategies, newBps, block.chainid, nonce));
        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);

        address recovered = ECDSA.recover(ethSignedHash, signature);
        if (recovered != authorizedSigner) revert InvalidSignature();

        uint256 usedNonce = nonce;
        nonce++;

        vaultManager.rebalance(strategies, newBps);

        emit Executed(usedNonce, strategies, newBps, ethSignedHash);
    }

    // ─── Owner actions ───────────────────────────────────────────────────────

    function setAuthorizedSigner(address signer) external onlyOwner {
        require(signer != address(0), "Zero address");
        emit AuthorizedSignerSet(authorizedSigner, signer);
        authorizedSigner = signer;
    }

    function setVaultManager(address _vaultManager) external onlyOwner {
        require(_vaultManager != address(0), "Zero address");
        vaultManager = VaultManager(_vaultManager);
        emit VaultManagerSet(_vaultManager);
    }

    // ─── View helpers ────────────────────────────────────────────────────────

    /// @notice Compute the message hash the agent must sign for the next execution.
    function nextMessageHash(address[] calldata strategies, uint256[] calldata newBps)
        external
        view
        returns (bytes32 messageHash, bytes32 ethSignedHash)
    {
        messageHash = keccak256(abi.encode(strategies, newBps, block.chainid, nonce));
        ethSignedHash = MessageHashUtils.toEthSignedMessageHash(messageHash);
    }
}
