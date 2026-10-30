// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";
import {SplitVault} from "../SplitVault.sol";
import {SplitVaultTestBase} from "./SplitVault.Base.t.sol";
import {FeeUSDC} from "./mocks/Mocks.sol";

contract SplitVaultTest is SplitVaultTestBase {
    // =====================================================================
    // (1) Constructor
    // =====================================================================

    function test_Constructor_LengthMismatch() public {
        vm.expectRevert(SplitVault.LengthMismatch.selector);
        new SplitVault(_a2(alice, bob), new uint16[](1));
    }

    function test_Constructor_LengthMismatch_MoreShares() public {
        vm.expectRevert(SplitVault.LengthMismatch.selector);
        new SplitVault(_a2(alice, bob), _s3(5000, 3000, 2000));
    }

    function test_Constructor_EmptyPayees() public {
        vm.expectRevert(SplitVault.EmptyPayees.selector);
        new SplitVault(new address[](0), new uint16[](0));
    }

    function test_Constructor_TooManyPayees() public {
        address[] memory p = new address[](11);
        uint16[] memory s = new uint16[](11);
        for (uint256 i; i < 11; ++i) {
            p[i] = address(uint160(0x1000 + i));
            s[i] = i == 10 ? 910 : 909; // 10*909 + 910 = 10000
        }
        vm.expectRevert(SplitVault.TooManyPayees.selector);
        new SplitVault(p, s);
    }

    function test_Constructor_ZeroAddress() public {
        vm.expectRevert(SplitVault.ZeroAddress.selector);
        new SplitVault(_a2(alice, address(0)), _s2(5000, 5000));
    }

    function test_Constructor_VaultAsPayee() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        address[] memory p = _a2(alice, predicted);
        uint16[] memory s = _s2(5000, 5000);
        vm.expectRevert(SplitVault.VaultAsPayee.selector);
        new SplitVault(p, s);
    }

    function test_Constructor_ZeroShare() public {
        vm.expectRevert(SplitVault.ZeroShare.selector);
        new SplitVault(_a2(alice, bob), _s2(10000, 0));
    }

    function test_Constructor_DuplicatePayee() public {
        vm.expectRevert(SplitVault.DuplicatePayee.selector);
        new SplitVault(_a2(alice, alice), _s2(5000, 5000));
    }

    function test_Constructor_ShareSumTooLow() public {
        vm.expectRevert(SplitVault.InvalidShareSum.selector);
        new SplitVault(_a2(alice, bob), _s2(5000, 4999));
    }

    function test_Constructor_ShareSumTooHigh() public {
        vm.expectRevert(SplitVault.InvalidShareSum.selector);
        new SplitVault(_a2(alice, bob), _s2(5000, 5001));
    }

    function test_Constructor_ShareSumNoUint16Wrap() public {
        // 65535 + 65535 + ... must not wrap around to 10000
        vm.expectRevert(SplitVault.InvalidShareSum.selector);
        new SplitVault(_a2(alice, bob), _s2(65535, 65535));
    }

    function test_Constructor_ExactlyTenPayees() public {
        address[] memory p = new address[](10);
        uint16[] memory s = new uint16[](10);
        for (uint256 i; i < 10; ++i) {
            p[i] = address(uint160(0x2000 + i));
            s[i] = 1000;
        }
        SplitVault v = new SplitVault(p, s);
        assertEq(v.payeeCount(), 10);
        (address[] memory gp, uint16[] memory gs) = v.getPayees();
        assertEq(gp.length, 10);
        for (uint256 i; i < 10; ++i) {
            assertEq(gp[i], p[i]);
            assertEq(gs[i], 1000);
        }
    }

    function test_Constructor_SinglePayeeFullShare() public {
        SplitVault v = new SplitVault(_a2(alice, bob), _s2(10000 - 1, 1));
        assertEq(v.payeeCount(), 2);
        address[] memory one = new address[](1);
        one[0] = alice;
        uint16[] memory shares = new uint16[](1);
        shares[0] = 10000;
        SplitVault solo = new SplitVault(one, shares);
        assertEq(solo.payeeCount(), 1);
        assertEq(solo.shareBps(alice), 10000);
    }

    function test_GetPayees_And_PayeeCount_PreserveOrder() public view {
        assertEq(vault.payeeCount(), 3);
        (address[] memory p, uint16[] memory s) = vault.getPayees();
        assertEq(p[0], alice);
        assertEq(p[1], bob);
        assertEq(p[2], carol);
        assertEq(s[0], 5000);
        assertEq(s[1], 3000);
        assertEq(s[2], 2000);
        assertEq(vault.shareBps(stranger), 0);
        assertEq(vault.totalReceived(), 0);
        assertEq(vault.totalReleased(), 0);
        assertEq(address(vault.USDC()), USDC_ADDR);
    }

    // =====================================================================
    // (2) Share math
    // =====================================================================

    function test_Pending_5030_20() public {
        _pay(vault, payer1, 1000e6);
        assertEq(vault.pending(alice), 500e6);
        assertEq(vault.pending(bob), 300e6);
        assertEq(vault.pending(carol), 200e6);
    }

    function test_Pending_UnevenSplit() public {
        SplitVault v = _deploy(_a3(alice, bob, carol), _s3(6667, 2500, 833));
        _pay(v, payer1, 1_000_001);
        assertEq(v.pending(alice), 666_700);
        assertEq(v.pending(bob), 250_000);
        assertEq(v.pending(carol), 83_300);
    }

    function test_Pending_NonPayeeIsZero() public {
        _pay(vault, payer1, 1000e6);
        assertEq(vault.pending(stranger), 0);
        assertEq(vault.pending(address(0)), 0);
        assertEq(vault.pending(payer1), 0);
    }

    // =====================================================================
    // (5) release
    // =====================================================================

    function test_Release_RevertsForNonPayee() public {
        _pay(vault, payer1, 1000);
        vm.prank(stranger);
        vm.expectRevert(SplitVault.NotPayee.selector);
        vault.release();
    }

    function test_Release_RevertsNothingBeforeAnyPayment() public {
        vm.prank(alice);
        vm.expectRevert(SplitVault.NothingToRelease.selector);
        vault.release();
    }

    function test_Release_RevertsWhenShareRoundsToZero() public {
        _pay(vault, payer1, 1); // 1 * 2000 / 10000 == 0
        vm.prank(carol);
        vm.expectRevert(SplitVault.NothingToRelease.selector);
        vault.release();
    }

    function test_Release_PaysCallerAndEmitsEvent() public {
        _pay(vault, payer1, 1000e6);
        vm.expectEmit(true, false, false, true, address(vault));
        emit Released(alice, 500e6);
        _release(vault, alice);

        assertEq(usdc.balanceOf(alice), 500e6);
        assertEq(vault.released(alice), 500e6);
        assertEq(vault.totalReleased(), 500e6);
        assertEq(vault.pending(alice), 0);
        // others untouched
        assertEq(vault.pending(bob), 300e6);
        assertEq(vault.pending(carol), 200e6);
        assertEq(usdc.balanceOf(address(vault)), vault.totalReceived() - vault.totalReleased());
    }

    function test_Release_SecondCallReverts() public {
        _pay(vault, payer1, 1000e6);
        _release(vault, alice);
        vm.prank(alice);
        vm.expectRevert(SplitVault.NothingToRelease.selector);
        vault.release();
    }

    function test_Release_AllPayeesDrainVault() public {
        _pay(vault, payer1, 1000e6);
        _release(vault, alice);
        _release(vault, bob);
        _release(vault, carol);
        assertEq(usdc.balanceOf(address(vault)), 0);
        assertEq(vault.totalReleased(), vault.totalReceived());
    }

    // =====================================================================
    // (6) pay
    // =====================================================================

    function test_Pay_RevertsZeroAmount() public {
        vm.prank(payer1);
        vm.expectRevert(SplitVault.ZeroAmount.selector);
        vault.pay(0, "hi");
    }

    function test_Pay_ZeroAmountCheckedBeforeMemo() public {
        vm.prank(payer1);
        vm.expectRevert(SplitVault.ZeroAmount.selector);
        vault.pay(0, string(new bytes(257)));
    }

    function test_Pay_Memo256Ok() public {
        usdc.mint(payer1, 10);
        vm.startPrank(payer1);
        usdc.approve(address(vault), 10);
        vault.pay(10, string(new bytes(256)));
        vm.stopPrank();
        assertEq(vault.totalReceived(), 10);
    }

    function test_Pay_Memo257Reverts() public {
        usdc.mint(payer1, 10);
        vm.startPrank(payer1);
        usdc.approve(address(vault), 10);
        vm.expectRevert(SplitVault.MemoTooLong.selector);
        vault.pay(10, string(new bytes(257)));
        vm.stopPrank();
        assertEq(vault.totalReceived(), 0);
    }

    function test_Pay_RevertsInsufficientAllowance() public {
        usdc.mint(payer1, 1000);
        vm.startPrank(payer1);
        usdc.approve(address(vault), 500);
        vm.expectRevert(
            abi.encodeWithSelector(IERC20Errors.ERC20InsufficientAllowance.selector, address(vault), 500, 1000)
        );
        vault.pay(1000, "");
        vm.stopPrank();
        assertEq(vault.totalReceived(), 0);
    }

    function test_Pay_RevertsInsufficientBalance() public {
        usdc.mint(payer1, 400);
        vm.startPrank(payer1);
        usdc.approve(address(vault), 1000);
        vm.expectRevert(abi.encodeWithSelector(IERC20Errors.ERC20InsufficientBalance.selector, payer1, 400, 1000));
        vault.pay(1000, "");
        vm.stopPrank();
        assertEq(vault.totalReceived(), 0);
    }

    function test_Pay_EmitsPaidAndMovesFunds() public {
        usdc.mint(payer1, 1000);
        vm.startPrank(payer1);
        usdc.approve(address(vault), 1000);
        vm.expectEmit(true, false, false, true, address(vault));
        emit Paid(payer1, 1000, "invoice #42");
        vault.pay(1000, "invoice #42");
        vm.stopPrank();

        assertEq(vault.totalReceived(), 1000);
        assertEq(usdc.balanceOf(payer1), 0);
        assertEq(usdc.balanceOf(address(vault)), 1000);
    }

    function test_Pay_EmitsPaidWithEmptyMemo() public {
        usdc.mint(payer2, 77);
        vm.startPrank(payer2);
        usdc.approve(address(vault), 77);
        vm.expectEmit(true, false, false, true, address(vault));
        emit Paid(payer2, 77, "");
        vault.pay(77, "");
        vm.stopPrank();
    }

    function test_Pay_DirectTransferIsNotAccounted() public {
        usdc.mint(address(this), 999);
        usdc.transfer(address(vault), 999);
        assertEq(vault.totalReceived(), 0);
        assertEq(vault.pending(alice), 0);
        vm.prank(alice);
        vm.expectRevert(SplitVault.NothingToRelease.selector);
        vault.release();
    }

    // ---- fee-on-transfer / bonus tokens ----

    function _etchFeeToken() internal returns (FeeUSDC fee) {
        vm.etch(USDC_ADDR, address(new FeeUSDC()).code);
        fee = FeeUSDC(USDC_ADDR);
    }

    function test_Pay_RevertsUnexpectedTransferAmount_FeeOnTransfer() public {
        FeeUSDC fee = _etchFeeToken();
        fee.setFee(100); // 1%
        fee.mint(payer1, 1000);
        vm.startPrank(payer1);
        fee.approve(address(vault), 1000);
        vm.expectRevert(SplitVault.UnexpectedTransferAmount.selector);
        vault.pay(1000, "");
        vm.stopPrank();
        assertEq(vault.totalReceived(), 0);
    }

    function test_Pay_RevertsUnexpectedTransferAmount_Bonus() public {
        FeeUSDC fee = _etchFeeToken();
        fee.setBonus(5);
        fee.mint(payer1, 1000);
        vm.startPrank(payer1);
        fee.approve(address(vault), 1000);
        vm.expectRevert(SplitVault.UnexpectedTransferAmount.selector);
        vault.pay(1000, "");
        vm.stopPrank();
        assertEq(vault.totalReceived(), 0);
    }

    function test_Pay_FeeTokenWithZeroFeeBehavesNormally() public {
        FeeUSDC fee = _etchFeeToken();
        fee.mint(payer1, 1000);
        vm.startPrank(payer1);
        fee.approve(address(vault), 1000);
        vault.pay(1000, "");
        vm.stopPrank();
        assertEq(vault.totalReceived(), 1000);
    }
}
