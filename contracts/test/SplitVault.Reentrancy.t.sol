// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SplitVault} from "../SplitVault.sol";
import {SplitVaultTestBase} from "./SplitVault.Base.t.sol";
import {ReentrantUSDC, ReentrantActor} from "./mocks/Mocks.sol";

contract SplitVaultReentrancyTest is SplitVaultTestBase {
    ReentrantUSDC internal rusdc;
    ReentrantActor internal actor;
    SplitVault internal v; // actor 50% / bob 50%

    bytes4 internal immutable GUARD = ReentrancyGuard.ReentrancyGuardReentrantCall.selector;

    function setUp() public override {
        super.setUp();
        vm.etch(USDC_ADDR, address(new ReentrantUSDC()).code);
        rusdc = ReentrantUSDC(USDC_ADDR);
        usdc = rusdc;

        // Predict the vault address so the actor can reference it, then deploy both.
        address predictedVault = vm.computeCreateAddress(address(this), vm.getNonce(address(this)) + 1);
        actor = new ReentrantActor(predictedVault);
        v = _deploy(_a2(address(actor), bob), _s2(5000, 5000));
        assertEq(address(v), predictedVault);
    }

    // ---- malicious payee re-enters from the token callback during release() ----

    function test_Reenter_Release_FromPayeeCallback_Blocked() public {
        _pay(v, payer1, 1000);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Release, false, 0);

        actor.callRelease();

        assertTrue(actor.attempted(), "hook never ran");
        assertFalse(actor.reenterSucceeded(), "re-entrant release succeeded");
        assertEq(actor.lastSelector(), GUARD);
        // no double payout: exactly one 500 release
        assertEq(usdc.balanceOf(address(actor)), 500);
        assertEq(v.released(address(actor)), 500);
        assertEq(v.totalReleased(), 500);
        assertEq(usdc.balanceOf(address(v)), 500);
        assertEq(v.pending(bob), 500);
    }

    function test_Reenter_Release_FromPayeeCallback_BubblesRevert() public {
        _pay(v, payer1, 1000);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Release, true, 0);

        vm.expectRevert(GUARD);
        actor.callRelease();

        // everything rolled back: nothing paid out
        assertEq(usdc.balanceOf(address(actor)), 0);
        assertEq(v.totalReleased(), 0);
        assertEq(v.pending(address(actor)), 500);
        assertEq(usdc.balanceOf(address(v)), 1000);
    }

    function test_Reenter_Pay_FromPayeeCallbackDuringRelease_Blocked() public {
        _pay(v, payer1, 1000);
        rusdc.mint(address(actor), 100);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Pay, false, 100);

        actor.callRelease();

        assertTrue(actor.attempted());
        assertFalse(actor.reenterSucceeded());
        assertEq(actor.lastSelector(), GUARD);
        assertEq(v.totalReceived(), 1000, "inner pay was accounted");
        assertEq(v.totalReleased(), 500);
        assertEq(usdc.balanceOf(address(actor)), 600); // 100 own + 500 released
    }

    function test_Reenter_Pay_FromPayeeCallbackDuringRelease_BubblesRevert() public {
        _pay(v, payer1, 1000);
        rusdc.mint(address(actor), 100);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Pay, true, 100);

        vm.expectRevert(GUARD);
        actor.callRelease();

        assertEq(v.totalReceived(), 1000);
        assertEq(v.totalReleased(), 0);
    }

    // ---- malicious payer re-enters from the token callback during pay() ----

    function test_Reenter_Pay_FromPayerCallback_Blocked() public {
        rusdc.mint(address(actor), 1000);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Pay, false, 100);

        actor.callPay(500);

        assertTrue(actor.attempted());
        assertFalse(actor.reenterSucceeded());
        assertEq(actor.lastSelector(), GUARD);
        assertEq(v.totalReceived(), 500, "only the outer payment is accounted");
        assertEq(usdc.balanceOf(address(v)), 500);
        assertEq(usdc.balanceOf(address(actor)), 500);
    }

    function test_Reenter_Pay_FromPayerCallback_BubblesRevert() public {
        rusdc.mint(address(actor), 1000);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Pay, true, 100);

        vm.expectRevert(GUARD);
        actor.callPay(500);

        assertEq(v.totalReceived(), 0);
        assertEq(usdc.balanceOf(address(v)), 0);
        assertEq(usdc.balanceOf(address(actor)), 1000);
    }

    function test_Reenter_Release_FromPayerCallbackDuringPay_Blocked() public {
        // actor is both a payee and the payer; vault already holds earlier funds
        _pay(v, payer1, 1000);
        rusdc.mint(address(actor), 500);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Release, false, 0);

        actor.callPay(500);

        assertTrue(actor.attempted());
        assertFalse(actor.reenterSucceeded());
        assertEq(actor.lastSelector(), GUARD);
        assertEq(v.released(address(actor)), 0, "released mid-pay");
        assertEq(v.totalReceived(), 1500);
        assertEq(v.totalReleased(), 0);
        assertEq(usdc.balanceOf(address(v)), 1500);
        // after the call completes normally the actor can release exactly its share
        actor.callRelease();
        assertEq(v.released(address(actor)), 750);
    }

    function test_Reenter_Release_FromPayerCallbackDuringPay_BubblesRevert() public {
        _pay(v, payer1, 1000);
        rusdc.mint(address(actor), 500);
        rusdc.setAttacker(address(actor));
        actor.setAction(ReentrantActor.Action.Release, true, 0);

        vm.expectRevert(GUARD);
        actor.callPay(500);

        assertEq(v.totalReceived(), 1000);
        assertEq(v.totalReleased(), 0);
    }

    // ---- sanity: with the hook disarmed, the same flows work normally ----

    function test_NoAttack_NormalFlowWorks() public {
        rusdc.mint(address(actor), 1000);
        actor.callPay(1000);
        actor.callRelease();
        assertEq(v.released(address(actor)), 500);
        _release(v, bob);
        assertEq(usdc.balanceOf(address(v)), 0);
    }
}
