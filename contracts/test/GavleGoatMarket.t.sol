// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {GavleGoatMarket, IERC20} from "../src/GavleGoatMarket.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract GavleGoatMarketTest is Test {
    MockUSDC usdc;
    GavleGoatMarket market;

    address resolver = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0);
    address carol = address(0xCA201);

    uint64 closesAt;
    uint64 deadline;

    uint256 constant START = 10_000e6;

    function setUp() public {
        closesAt = uint64(block.timestamp + 30 days);
        deadline = uint64(block.timestamp + 60 days);

        usdc = new MockUSDC();
        market = new GavleGoatMarket(IERC20(address(usdc)), resolver, closesAt, deadline);

        _fund(alice, START);
        _fund(bob, START);
        _fund(carol, START);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.startPrank(who);
        usdc.approve(address(market), type(uint256).max);
        market.deposit(amount);
        vm.stopPrank();
    }

    function _assertSolvent() internal view {
        assertGe(market.solvencyGap(), 0, "insolvent");
    }

    function _assertBalanced() internal view {
        assertEq(market.totalYes(), market.totalNo(), "unbacked shares");
        assertEq(market.solvencyGap(), 0, "gap should be exactly zero while trading");
    }

    // ── collateral ──────────────────────────────────────────────────────────

    function test_split_merge_roundtrip() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        assertEq(market.yesBalance(alice), 1_000e6);
        assertEq(market.noBalance(alice), 1_000e6);
        assertEq(market.usdcBalance(alice), START - 1_000e6);
        market.merge(1_000e6);
        assertEq(market.usdcBalance(alice), START);
        assertEq(market.yesBalance(alice), 0);
        vm.stopPrank();
        _assertSolvent();
    }

    function test_withdraw_returns_funds() public {
        vm.prank(alice);
        market.withdraw(4_000e6);
        assertEq(usdc.balanceOf(alice), 4_000e6);
        assertEq(market.usdcBalance(alice), START - 4_000e6);
        _assertSolvent();
    }

    // ── asks ────────────────────────────────────────────────────────────────

    function test_fill_ask_moves_shares_and_usdc() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 id = market.placeAsk(true, 500e6, 0.6e18, closesAt);
        vm.stopPrank();

        vm.prank(bob);
        market.fillAsk(id, 500e6);

        assertEq(market.yesBalance(bob), 500e6);
        assertEq(market.usdcBalance(alice), START - 1_000e6 + 300e6);
        assertEq(market.usdcBalance(bob), START - 300e6);
        assertEq(market.escrowedUsdc(), 0);
        _assertSolvent();
    }

    function test_partial_fill_then_cancel_unlocks_rest() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 id = market.placeAsk(true, 1_000e6, 0.5e18, closesAt);
        assertEq(market.lockedYes(alice), 1_000e6);
        vm.stopPrank();

        vm.prank(bob);
        market.fillAsk(id, 400e6);

        vm.prank(alice);
        market.cancelOrder(id);

        assertEq(market.lockedYes(alice), 0);
        assertEq(market.freeShares(alice, true), 1_000e6 - 400e6);
        _assertSolvent();
    }

    function test_cannot_sell_locked_shares_twice() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        market.placeAsk(true, 1_000e6, 0.5e18, closesAt);
        vm.expectRevert(GavleGoatMarket.InsufficientShares.selector);
        market.placeAsk(true, 1e6, 0.5e18, closesAt);
        vm.stopPrank();
    }

    // ── bids ────────────────────────────────────────────────────────────────

    function test_fill_bid_pays_seller_from_escrow() public {
        vm.prank(bob);
        uint256 id = market.placeBid(true, 400e6, 0.5e18, closesAt);
        assertEq(market.escrowedUsdc(), 200e6);

        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 before = market.usdcBalance(alice);
        market.fillBid(id, 400e6);
        vm.stopPrank();

        assertEq(market.usdcBalance(alice), before + 200e6);
        assertEq(market.yesBalance(bob), 400e6);
        assertEq(market.escrowedUsdc(), 0);
        _assertSolvent();
    }

    function test_cancel_bid_refunds_escrow() public {
        vm.prank(bob);
        uint256 id = market.placeBid(false, 400e6, 0.25e18, closesAt);
        assertEq(market.usdcBalance(bob), START - 100e6);

        vm.prank(bob);
        market.cancelOrder(id);

        assertEq(market.usdcBalance(bob), START);
        assertEq(market.escrowedUsdc(), 0);
        _assertSolvent();
    }

    function test_self_trade_blocked() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 id = market.placeAsk(true, 100e6, 0.5e18, closesAt);
        vm.expectRevert(GavleGoatMarket.SelfTrade.selector);
        market.fillAsk(id, 100e6);
        vm.stopPrank();
    }

    function test_third_party_cannot_cancel_live_order() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 id = market.placeAsk(true, 100e6, 0.5e18, closesAt);
        vm.stopPrank();

        vm.expectRevert(GavleGoatMarket.BadOrder.selector);
        vm.prank(carol);
        market.cancelOrder(id);
    }

    // ── resolution ──────────────────────────────────────────────────────────

    function test_resolution_freezes_then_pays_winners() public {
        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 id = market.placeAsk(true, 500e6, 0.6e18, closesAt);
        vm.stopPrank();

        vm.prank(bob);
        market.fillAsk(id, 500e6);

        vm.prank(resolver);
        market.proposeResolution(true, bytes32("evidence"));
        assertFalse(market.isTrading());

        vm.expectRevert(GavleGoatMarket.NotTrading.selector);
        vm.prank(bob);
        market.fillAsk(id, 1e6);

        vm.expectRevert(GavleGoatMarket.TimelockActive.selector);
        market.finalizeResolution();

        vm.warp(block.timestamp + 72 hours);
        market.finalizeResolution();

        uint256 before = market.usdcBalance(bob);
        vm.prank(bob);
        market.redeem();
        assertEq(market.usdcBalance(bob), before + 500e6);
        assertEq(market.yesBalance(bob), 0);
        _assertSolvent();
    }

    function test_nobody_can_propose_but_resolver() public {
        vm.expectRevert(GavleGoatMarket.NotResolver.selector);
        vm.prank(alice);
        market.proposeResolution(true, bytes32(0));
    }

    function test_trading_hard_stops_at_close_time() public {
        vm.warp(closesAt);
        vm.prank(alice);
        vm.expectRevert(GavleGoatMarket.NotTrading.selector);
        market.placeAsk(true, 1e6, 0.5e18, closesAt + 1);
    }

    // ── void ────────────────────────────────────────────────────────────────

    function test_void_returns_half_per_share() public {
        vm.prank(alice);
        market.split(1_000e6);

        vm.warp(uint256(market.voidAfter()) + 1);
        market.voidMarket();

        uint256 before = market.usdcBalance(alice);
        vm.prank(alice);
        market.redeemVoided();
        assertEq(market.usdcBalance(alice), before + 1_000e6);
        _assertSolvent();
    }

    function test_void_refunds_open_bid_escrow() public {
        vm.prank(bob);
        uint256 id = market.placeBid(true, 1_000e6, 0.3e18, closesAt);

        vm.warp(closesAt + 1);
        vm.prank(carol);
        market.cancelOrder(id);

        assertEq(market.usdcBalance(bob), START);
        assertEq(market.escrowedUsdc(), 0);
        _assertSolvent();
    }

    function test_cannot_void_before_grace_period() public {
        vm.expectRevert(GavleGoatMarket.TooEarly.selector);
        market.voidMarket();
    }

    // ── fuzz ────────────────────────────────────────────────────────────────

    function testFuzz_split_merge(uint256 amount) public {
        amount = bound(amount, 1, START);
        vm.startPrank(carol);
        market.split(amount);
        market.merge(amount);
        vm.stopPrank();
        assertEq(market.usdcBalance(carol), START);
        _assertSolvent();
    }

    function testFuzz_fill_ask_partial(uint256 shares, uint256 price) public {
        shares = bound(shares, market.MIN_ORDER_SHARES(), 1_000e6);
        price = bound(price, 1e15, 0.99e18);

        vm.startPrank(alice);
        market.split(1_000e6);
        uint256 id = market.placeAsk(true, shares, price, closesAt);
        vm.stopPrank();

        uint256 half = shares / 2;
        vm.prank(bob);
        market.fillAsk(id, half);

        assertEq(market.yesBalance(bob), half);
        _assertSolvent();

        // Only the maker may cancel while the order is live and the market open.
        vm.prank(alice);
        market.cancelOrder(id);
        _assertSolvent();
        assertEq(market.freeShares(alice, true), 1_000e6 - half);
    }
}
