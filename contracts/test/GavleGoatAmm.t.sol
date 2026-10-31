// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {GavleGoatAmm, IERC20} from "../src/GavleGoatAmm.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract GavleGoatAmmTest is Test {
    MockUSDC usdc;
    GavleGoatAmm amm;

    address resolver = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB0);

    uint64 closesAt;
    uint64 deadline;

    function setUp() public {
        closesAt = uint64(block.timestamp + 30 days);
        deadline = uint64(block.timestamp + 60 days);

        usdc = new MockUSDC();
        amm = new GavleGoatAmm(IERC20(address(usdc)), resolver, closesAt, deadline);

        _fund(alice, 10_000e6);
        _fund(bob, 10_000e6);

        // Alice provides the liquidity and becomes the counterparty to every trade.
        vm.startPrank(alice);
        usdc.approve(address(amm), type(uint256).max);
        amm.seed(1_000e6);
        vm.stopPrank();
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(amm), type(uint256).max);
    }

    function _assertSolvent() internal view {
        assertGe(amm.solvencyGap(), 0, "insolvent");
    }

    /// Only meaningful before resolution: afterwards the winning side is redeemed
    /// and the two totals legitimately diverge.
    function _assertBalanced() internal view {
        assertEq(amm.totalYes(), amm.totalNo(), "unbalanced shares");
        assertEq(amm.totalYes(), usdc.balanceOf(address(amm)) - amm.credited(), "collateral");
    }

    // ── price discovery ─────────────────────────────────────────────────────

    function test_starts_at_fifty_percent() public view {
        assertEq(amm.yesPrice(), 0.5e18, "should open at 50/50");
    }

    function test_buying_yes_moves_price_up() public {
        vm.prank(bob);
        uint256 shares = amm.buy(true, 100e6, 0);

        assertGt(amm.yesPrice(), 0.5e18, "price should rise");
        assertGt(shares, 100e6, "at 50c, 100 USDC buys more than 100 shares");
        assertEq(amm.yesBalance(bob), shares);
        _assertBalanced();
    }

    function test_buying_no_moves_price_down() public {
        vm.prank(bob);
        amm.buy(false, 100e6, 0);
        assertLt(amm.yesPrice(), 0.5e18, "price should fall");
        _assertSolvent();
    }

    function test_price_is_monotonic_in_trade_size() public {
        uint256 p0 = amm.yesPrice();
        vm.startPrank(bob);
        amm.buy(true, 50e6, 0);
        uint256 p1 = amm.yesPrice();
        amm.buy(true, 50e6, 0);
        uint256 p2 = amm.yesPrice();
        vm.stopPrank();
        assertGt(p1, p0);
        assertGt(p2, p1);
        _assertSolvent();
    }

    // ── selling ─────────────────────────────────────────────────────────────

    function test_selling_returns_at_most_what_was_paid() public {
        vm.startPrank(bob);
        uint256 shares = amm.buy(true, 100e6, 0);
        uint256 back = amm.sell(true, shares, 0);
        vm.stopPrank();

        // With no fee, buying and selling the same amount immediately restores the
        // pool exactly, so the round trip returns the input *at most* - never more.
        // It costs nothing, which is the free-option quirk of a zero-fee pool; it
        // only becomes a real trade once someone else moves the price.
        assertLe(back, 100e6, "round trip must never profit");
        assertGt(back, 85e6, "but not absurdly much");
        assertEq(amm.yesBalance(bob), 0);
        _assertBalanced();
    }

    function test_selling_yes_moves_price_back_down() public {
        vm.startPrank(bob);
        uint256 shares = amm.buy(true, 100e6, 0);
        uint256 high = amm.yesPrice();
        amm.sell(true, shares, 0);
        vm.stopPrank();

        assertGt(high, 0.5e18);
        assertLt(amm.yesPrice(), high, "price should fall when selling");
        _assertSolvent();
    }

    function test_cannot_sell_more_than_held() public {
        vm.prank(bob);
        vm.expectRevert(GavleGoatAmm.Insufficient.selector);
        amm.sell(true, 1e6, 0);
    }

    function testFuzz_round_trip_never_profits(uint256 amount) public {
        amount = bound(amount, 1e6, 500e6);
        vm.startPrank(bob);
        uint256 shares = amm.buy(true, amount, 0);
        uint256 back = amm.sell(true, shares, 0);
        vm.stopPrank();
        assertLe(back, amount, "selling must never return more than was paid");
        _assertSolvent();
    }

    // ── guards ──────────────────────────────────────────────────────────────

    function test_cannot_buy_before_seed() public {
        GavleGoatAmm fresh = new GavleGoatAmm(IERC20(address(usdc)), resolver, closesAt, deadline);
        vm.prank(bob);
        vm.expectRevert(GavleGoatAmm.NotTrading.selector);
        fresh.buy(true, 10e6, 0);
    }

    function test_cannot_seed_twice() public {
        vm.prank(bob);
        vm.expectRevert(GavleGoatAmm.AlreadySeeded.selector);
        amm.seed(1_000e6);
    }

    function test_buy_reverts_on_slippage_bound() public {
        vm.prank(bob);
        vm.expectRevert(GavleGoatAmm.Slippage.selector);
        amm.buy(true, 100e6, 1_000e6);
    }

    // ── resolution ──────────────────────────────────────────────────────────

    function _resolve(bool yesWon) internal {
        vm.prank(resolver);
        amm.proposeResolution(yesWon, bytes32("evidence"));
        vm.warp(block.timestamp + 72 hours);
        amm.finalizeResolution();
    }

    function test_resolution_pays_winners_one_to_one() public {
        vm.prank(bob);
        uint256 shares = amm.buy(true, 100e6, 0);

        _resolve(true);

        uint256 before = amm.usdcBalance(bob);
        vm.prank(bob);
        amm.redeem();
        assertEq(amm.usdcBalance(bob), before + shares);
        _assertSolvent();
    }

    function test_losing_side_pays_nothing() public {
        vm.prank(bob);
        amm.buy(true, 100e6, 0);
        _resolve(false);

        vm.prank(bob);
        vm.expectRevert(GavleGoatAmm.NothingToDo.selector);
        amm.redeem();
    }

    function test_seeder_settles_pool_on_resolution() public {
        vm.prank(bob);
        amm.buy(true, 100e6, 0);
        _resolve(true);

        vm.prank(bob);
        amm.redeem();

        vm.prank(alice);
        amm.redeem();

        // Every share has been redeemed: nothing is left owed on either side, and
        // the contract holds exactly the credited balances its users can withdraw.
        assertEq(amm.totalYes(), 0, "all YES redeemed");
        assertEq(amm.solvencyGap(), 0, "zero gap after settlement");
        assertEq(usdc.balanceOf(address(amm)), amm.credited(), "balance == credited");
    }

    function test_cannot_trade_after_resolution_proposed() public {
        vm.prank(resolver);
        amm.proposeResolution(true, bytes32(0));
        vm.prank(bob);
        vm.expectRevert(GavleGoatAmm.NotTrading.selector);
        amm.buy(true, 10e6, 0);
    }

    // ── void ────────────────────────────────────────────────────────────────

    function test_void_refunds_half_per_share() public {
        vm.prank(bob);
        uint256 shares = amm.buy(true, 100e6, 0);

        vm.warp(uint256(amm.voidAfter()) + 1);
        amm.voidMarket();

        uint256 before = amm.usdcBalance(bob);
        vm.prank(bob);
        amm.redeemVoided();
        assertEq(amm.usdcBalance(bob), before + shares / 2, "half price per share");
        _assertSolvent();
    }
}
