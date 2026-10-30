// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SplitVault} from "../SplitVault.sol";
import {SplitVaultTestBase} from "./SplitVault.Base.t.sol";
import {MockUSDC} from "./mocks/Mocks.sol";

/// @dev Bounded action surface driven by the invariant fuzzer.
contract SplitVaultHandler is Test {
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    SplitVault public vault;
    MockUSDC public usdc;
    address[] internal _payees;
    address[] internal _payers;

    uint256 public ghostPaid;
    uint256 public ghostReleased;
    uint256 public ghostDonated;
    uint256 public ghostStrangerReleases;

    constructor(SplitVault v, address[] memory payees_) {
        vault = v;
        usdc = MockUSDC(USDC_ADDR);
        _payees = payees_;
        _payers.push(makeAddr("hPayer0"));
        _payers.push(makeAddr("hPayer1"));
        _payers.push(makeAddr("hPayer2"));
    }

    function pay(uint256 payerSeed, uint256 amount) external {
        amount = bound(amount, 1, 1e12);
        address payer = _payers[payerSeed % _payers.length];
        usdc.mint(payer, amount);
        vm.startPrank(payer);
        usdc.approve(address(vault), amount);
        vault.pay(amount, "");
        vm.stopPrank();
        ghostPaid += amount;
    }

    function release(uint256 idx) external {
        address p = _payees[idx % _payees.length];
        uint256 pend = vault.pending(p);
        if (pend == 0) return;
        vm.prank(p);
        vault.release();
        ghostReleased += pend;
    }

    /// @dev Direct (untracked) donation to the vault.
    function donate(uint256 amount) external {
        amount = bound(amount, 0, 1e12);
        usdc.mint(address(vault), amount);
        ghostDonated += amount;
    }

    function releaseAsStranger(address who) external {
        if (vault.shareBps(who) != 0) return;
        vm.prank(who);
        try vault.release() {
            ghostStrangerReleases++;
        } catch {}
    }

    function payees() external view returns (address[] memory) {
        return _payees;
    }
}

contract SplitVaultInvariantTest is SplitVaultTestBase {
    SplitVault internal ivault;
    SplitVaultHandler internal handler;
    address[] internal ipayees;

    function setUp() public override {
        super.setUp();
        ipayees.push(makeAddr("i0"));
        ipayees.push(makeAddr("i1"));
        ipayees.push(makeAddr("i2"));
        ipayees.push(makeAddr("i3"));
        uint16[] memory s = new uint16[](4);
        s[0] = 1234;
        s[1] = 2345;
        s[2] = 3456;
        s[3] = 2965; // sums to 10000
        ivault = _deploy(ipayees, s);
        handler = new SplitVaultHandler(ivault, ipayees);
        targetContract(address(handler));
    }

    function _sums() internal view returns (uint256 sumReleased, uint256 sumPending) {
        for (uint256 i; i < ipayees.length; ++i) {
            sumReleased += ivault.released(ipayees[i]);
            sumPending += ivault.pending(ipayees[i]);
        }
    }

    // sum of all payees' released <= totalReceived
    function invariant_ReleasedNeverExceedsReceived() public view {
        (uint256 sumReleased,) = _sums();
        assertLe(sumReleased, ivault.totalReceived());
        assertEq(sumReleased, ivault.totalReleased());
    }

    // token balance >= unreleased entitlements (and entitlements never exceed what was received)
    function invariant_BalanceCoversUnreleasedEntitlements() public view {
        (uint256 sumReleased, uint256 sumPending) = _sums();
        assertGe(usdc.balanceOf(address(ivault)), sumPending);
        assertLe(sumPending + sumReleased, ivault.totalReceived());
    }

    // balance == totalReceived - totalReleased (+ untracked donations)
    function invariant_BalanceAccounting() public view {
        assertEq(
            usdc.balanceOf(address(ivault)),
            ivault.totalReceived() - ivault.totalReleased() + handler.ghostDonated()
        );
    }

    // ghost totals match on-chain accounting; non-payees never release
    function invariant_GhostsMatchAndStrangersExcluded() public view {
        assertEq(handler.ghostPaid(), ivault.totalReceived());
        assertEq(handler.ghostReleased(), ivault.totalReleased());
        assertEq(handler.ghostStrangerReleases(), 0);
    }

    // per-payee cumulative release never exceeds its floor share of total received
    function invariant_PerPayeeReleasedWithinShare() public view {
        for (uint256 i; i < ipayees.length; ++i) {
            assertLe(
                ivault.released(ipayees[i]),
                ivault.totalReceived() * ivault.shareBps(ipayees[i]) / 10000
            );
        }
    }
}
