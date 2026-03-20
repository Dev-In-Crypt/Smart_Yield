// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {KeeperExecutor} from "../src/KeeperExecutor.sol";
import {VaultManager} from "../src/VaultManager.sol";
import {StrategyRegistry} from "../src/StrategyRegistry.sol";
import {RiskEngine} from "../src/RiskEngine.sol";
import {MockYieldStrategy} from "../src/strategies/MockYieldStrategy.sol";

contract MockToken2 is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract KeeperExecutorTest is Test {
    MockToken2        usdc;
    StrategyRegistry  registry;
    RiskEngine        riskEngine;
    VaultManager      vault;
    KeeperExecutor    executor;

    MockYieldStrategy stratA;
    MockYieldStrategy stratB;
    MockYieldStrategy stratC;

    uint256 signerPk  = 0xBEEFCAFE1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234ABCD;
    address signerAddr;

    address admin = address(this);
    address alice = makeAddr("alice");

    function setUp() public {
        signerAddr = vm.addr(signerPk);

        usdc      = new MockToken2();
        registry  = new StrategyRegistry(admin);
        riskEngine = new RiskEngine(address(registry), admin);
        vault      = new VaultManager(IERC20(address(usdc)), address(registry), address(riskEngine), admin);

        stratA = new MockYieldStrategy(address(usdc), address(vault), 600, 20, admin);
        stratB = new MockYieldStrategy(address(usdc), address(vault), 500, 30, admin);
        stratC = new MockYieldStrategy(address(usdc), address(vault), 400, 40, admin);

        registry.addStrategy(address(stratA), 5000);
        registry.addStrategy(address(stratB), 5000);
        registry.addStrategy(address(stratC), 5000);

        executor = new KeeperExecutor(address(vault), signerAddr, admin);
        vault.grantRole(vault.KEEPER_ROLE(), address(executor));
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    function _buildAllocation()
        internal
        view
        returns (address[] memory strategies, uint256[] memory bps)
    {
        strategies = new address[](3);
        bps        = new uint256[](3);
        strategies[0] = address(stratA); bps[0] = 5000;
        strategies[1] = address(stratB); bps[1] = 3000;
        strategies[2] = address(stratC); bps[2] = 2000;
        // weightedAPY = 530 bps > 0 + 25 ✓
    }

    function _sign(
        address[] memory strategies,
        uint256[] memory bps,
        uint256 nonce
    ) internal view returns (bytes memory sig) {
        bytes32 msgHash = keccak256(abi.encode(strategies, bps, block.chainid, nonce));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(msgHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPk, ethHash);
        sig = abi.encodePacked(r, s, v);
    }

    // ─── Valid signature ──────────────────────────────────────────────────────

    function test_Execute_ValidSignature() public {
        (address[] memory strats, uint256[] memory bps) = _buildAllocation();
        bytes memory sig = _sign(strats, bps, executor.nonce());

        executor.execute(strats, bps, sig);

        // Nonce should have incremented
        assertEq(executor.nonce(), 1);
        // Allocations applied
        assertEq(vault.strategyAllocations(address(stratA)), 5000);
    }

    // ─── Invalid signature ───────────────────────────────────────────────────

    function test_Execute_RevertsOnInvalidSignature() public {
        (address[] memory strats, uint256[] memory bps) = _buildAllocation();

        // Sign with wrong key
        uint256 wrongKey = 0xDEAD;
        bytes32 msgHash  = keccak256(abi.encode(strats, bps, block.chainid, executor.nonce()));
        bytes32 ethHash  = MessageHashUtils.toEthSignedMessageHash(msgHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert(KeeperExecutor.InvalidSignature.selector);
        executor.execute(strats, bps, badSig);
    }

    // ─── Replay protection ───────────────────────────────────────────────────

    function test_Execute_RevertsOnReplayedNonce() public {
        (address[] memory strats, uint256[] memory bps) = _buildAllocation();
        bytes memory sig = _sign(strats, bps, executor.nonce());

        // First execution succeeds
        executor.execute(strats, bps, sig);

        // Need a new valid allocation that improves on the current (530 bps) for the 2nd
        // But the replay uses the OLD sig whose nonce is now stale — it should revert.
        // Trying to replay the same sig with nonce=0 when contract nonce=1:
        vm.expectRevert(KeeperExecutor.InvalidSignature.selector);
        executor.execute(strats, bps, sig);
    }

    // ─── setAuthorizedSigner ─────────────────────────────────────────────────

    function test_SetAuthorizedSigner() public {
        address newSigner = makeAddr("newSigner");
        executor.setAuthorizedSigner(newSigner);
        assertEq(executor.authorizedSigner(), newSigner);
    }

    function test_SetAuthorizedSigner_RevertsForNonOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        executor.setAuthorizedSigner(alice);
    }

    // ─── nextMessageHash helper ───────────────────────────────────────────────

    function test_NextMessageHash_MatchesSignedHash() public view {
        (address[] memory strats, uint256[] memory bps) = _buildAllocation();
        (, bytes32 ethHash) = executor.nextMessageHash(strats, bps);

        bytes32 expected = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encode(strats, bps, block.chainid, executor.nonce()))
        );
        assertEq(ethHash, expected);
    }
}
