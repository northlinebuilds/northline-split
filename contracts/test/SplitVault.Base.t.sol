// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {SplitVault} from "../SplitVault.sol";
import {MockUSDC} from "./mocks/Mocks.sol";

abstract contract SplitVaultTestBase is Test {
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    event Paid(address indexed payer, uint256 amount, string memo);
    event Released(address indexed payee, uint256 amount);

    SplitVault internal vault; // default 50/30/20 vault: alice/bob/carol
    MockUSDC internal usdc;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal payer1 = makeAddr("payer1");
    address internal payer2 = makeAddr("payer2");
    address internal stranger = makeAddr("stranger");

    function setUp() public virtual {
        // Etch working ERC-20 code at the hardcoded USDC address (empty storage).
        vm.etch(USDC_ADDR, address(new MockUSDC()).code);
        usdc = MockUSDC(USDC_ADDR);
        vault = _deploy(_a3(alice, bob, carol), _s3(5000, 3000, 2000));
    }

    // ---------- helpers ----------

    function _deploy(address[] memory p, uint16[] memory s) internal returns (SplitVault) {
        return new SplitVault(p, s);
    }

    function _a3(address a, address b, address c) internal pure returns (address[] memory r) {
        r = new address[](3);
        r[0] = a;
        r[1] = b;
        r[2] = c;
    }

    function _a2(address a, address b) internal pure returns (address[] memory r) {
        r = new address[](2);
        r[0] = a;
        r[1] = b;
    }

    function _s3(uint16 a, uint16 b, uint16 c) internal pure returns (uint16[] memory r) {
        r = new uint16[](3);
        r[0] = a;
        r[1] = b;
        r[2] = c;
    }

    function _s2(uint16 a, uint16 b) internal pure returns (uint16[] memory r) {
        r = new uint16[](2);
        r[0] = a;
        r[1] = b;
    }

    /// @dev Mint `amount` to `payer`, approve `v`, and pay.
    function _pay(SplitVault v, address payer, uint256 amount) internal {
        usdc.mint(payer, amount);
        vm.startPrank(payer);
        usdc.approve(address(v), amount);
        v.pay(amount, "");
        vm.stopPrank();
    }

    function _release(SplitVault v, address payee) internal {
        vm.prank(payee);
        v.release();
    }

    /// @dev Core accounting properties that must hold at all times.
    function _checkAccounting(SplitVault v, address[] memory p) internal view {
        uint256 sumPending;
        uint256 sumReleased;
        for (uint256 i; i < p.length; ++i) {
            sumPending += v.pending(p[i]);
            sumReleased += v.released(p[i]);
        }
        assertEq(sumReleased, v.totalReleased(), "sum released != totalReleased");
        assertLe(sumPending + sumReleased, v.totalReceived(), "overpaying entitlements");
        // each payee floors by < 1 unit, so dust is strictly less than the payee count
        assertLt(v.totalReceived() - (sumPending + sumReleased), p.length, "dust >= payee count");
        assertEq(usdc.balanceOf(address(v)), v.totalReceived() - v.totalReleased(), "balance accounting");
    }
}
