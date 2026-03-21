// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

contract MockUSDCTest is Test {
    MockUSDC usdc;
    address alice = makeAddr("alice");
    address bob   = makeAddr("bob");

    function setUp() public {
        usdc = new MockUSDC(alice);
    }

    function test_Decimals_IsSix() public view {
        assertEq(usdc.decimals(), 6);
    }

    function test_Name_IsCorrect() public view {
        assertEq(usdc.name(), "Mock USDC");
    }

    function test_Symbol_IsCorrect() public view {
        assertEq(usdc.symbol(), "USDC");
    }

    function test_InitialSupply_MintedToRecipient() public view {
        uint256 expected = 1_000_000_000 * 1e6;
        assertEq(usdc.totalSupply(), expected);
        assertEq(usdc.balanceOf(alice), expected);
    }

    function test_Transfer_Works() public {
        uint256 amount = 100 * 1e6; // 100 USDC
        vm.prank(alice);
        usdc.transfer(bob, amount);
        assertEq(usdc.balanceOf(bob), amount);
        assertEq(usdc.balanceOf(alice), 1_000_000_000 * 1e6 - amount);
    }

    function test_Approve_And_TransferFrom() public {
        uint256 amount = 500 * 1e6;
        vm.prank(alice);
        usdc.approve(bob, amount);
        assertEq(usdc.allowance(alice, bob), amount);

        vm.prank(bob);
        usdc.transferFrom(alice, bob, amount);
        assertEq(usdc.balanceOf(bob), amount);
    }
}
