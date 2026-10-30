// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {SplitVault} from "../SplitVault.sol";
import {SplitVaultTestBase} from "./SplitVault.Base.t.sol";

contract SplitVaultRoundingTest is SplitVaultTestBase {
    SplitVault internal v33; // 3333 / 3333 / 3334

    function setUp() public override {
        super.setUp();
        v33 = _deploy(_a3(alice, bob, carol), _s3(3333, 3333, 3334));
    }

    function _pend(SplitVault v) internal view returns (uint256 a, uint256 b, uint256 c) {
        return (v.pending(alice), v.pending(bob), v.pending(carol));
    }

    // ---------------- (3) rounding with odd bps ----------------

    function test_Rounding_SinglePaymentsOfOddSizes() public {
        uint256[4] memory amounts = [uint256(1), 3, 7, 101];
        for (uint256 i; i < 4; ++i) {
            SplitVault v = _deploy(_a3(alice, bob, carol), _s3(3333, 3333, 3334));
            _pay(v, payer1, amounts[i]);
            _checkAccounting(v, _a3(alice, bob, carol));
            (uint256 a, uint256 b, uint256 c) = _pend(v);
            assertLe(a + b + c, amounts[i]);
        }
    }

    function test_Rounding_DustCarriesForwardAcrossPayments() public {
        // cumulative totals: 1, 4, 11, 112
        _pay(v33, payer1, 1);
        (uint256 a, uint256 b, uint256 c) = _pend(v33);
        assertEq(a, 0);
        assertEq(b, 0);
        assertEq(c, 0);

        _pay(v33, payer1, 3); // total 4
        (a, b, c) = _pend(v33);
        assertEq(a, 1);
        assertEq(b, 1);
        assertEq(c, 1);
        _checkAccounting(v33, _a3(alice, bob, carol));

        _pay(v33, payer2, 7); // total 11
        (a, b, c) = _pend(v33);
        assertEq(a, 3);
        assertEq(b, 3);
        assertEq(c, 3);
        _checkAccounting(v33, _a3(alice, bob, carol));

        _pay(v33, payer2, 101); // total 112
        (a, b, c) = _pend(v33);
        assertEq(a, 37);
        assertEq(b, 37);
        assertEq(c, 37);
        assertLe(a + b + c, v33.totalReceived());
        _checkAccounting(v33, _a3(alice, bob, carol));
    }

    function test_Rounding_ThreeSingleUnitPaymentsFavourLargestShare() public {
        // 3 units total: 3*3333/10000 == 0, but 3*3334/10000 == 1
        _pay(v33, payer1, 1);
        _pay(v33, payer1, 1);
        _pay(v33, payer1, 1);
        (uint256 a, uint256 b, uint256 c) = _pend(v33);
        assertEq(a, 0);
        assertEq(b, 0);
        assertEq(c, 1);
    }

    function test_Rounding_TwoWaySplit_OneUnitAtATime() public {
        SplitVault v = _deploy(_a2(alice, bob), _s2(5000, 5000));
        _pay(v, payer1, 1);
        assertEq(v.pending(alice), 0);
        assertEq(v.pending(bob), 0);
        _pay(v, payer1, 1); // dust of the first payment is now distributed
        assertEq(v.pending(alice), 1);
        assertEq(v.pending(bob), 1);
    }

    function test_Rounding_DustFullyDistributedAtMultipleOf10000() public {
        _pay(v33, payer1, 1);
        _pay(v33, payer1, 3);
        _pay(v33, payer1, 7);
        _pay(v33, payer1, 101);
        _pay(v33, payer1, 10000 - 112); // total now exactly 10000
        (uint256 a, uint256 b, uint256 c) = _pend(v33);
        assertEq(a, 3333);
        assertEq(b, 3333);
        assertEq(c, 3334);
        assertEq(a + b + c, v33.totalReceived());
    }

    function test_Rounding_ReleasedNeverExceedsReceivedWithInterleavedReleases() public {
        address[] memory p = _a3(alice, bob, carol);
        uint256[4] memory amounts = [uint256(1), 3, 7, 101];
        for (uint256 i; i < 4; ++i) {
            _pay(v33, payer1, amounts[i]);
            for (uint256 j; j < 3; ++j) {
                if (v33.pending(p[j]) > 0) _release(v33, p[j]);
            }
            _checkAccounting(v33, p);
        }
    }

    // ---------------- (4) multiple payers + partial releases ----------------

    function test_MultiPayer_PartialReleasesPayOnlyDelta() public {
        address[] memory p = _a3(alice, bob, carol);

        _pay(vault, payer1, 1000);
        // alice releases 500
        vm.expectEmit(true, false, false, true, address(vault));
        emit Released(alice, 500);
        _release(vault, alice);
        assertEq(usdc.balanceOf(alice), 500);

        _pay(vault, payer2, 500); // total 1500
        assertEq(vault.pending(alice), 250);
        assertEq(vault.pending(bob), 450);
        assertEq(vault.pending(carol), 300);

        _release(vault, bob);
        assertEq(usdc.balanceOf(bob), 450);

        // alice receives only the delta (250), not 750 again
        vm.expectEmit(true, false, false, true, address(vault));
        emit Released(alice, 250);
        _release(vault, alice);
        assertEq(usdc.balanceOf(alice), 750);

        _pay(vault, payer1, 333); // total 1833
        assertEq(vault.pending(alice), 166); // floor(916.5) - 750
        assertEq(vault.pending(bob), 99); // floor(549.9) - 450
        assertEq(vault.pending(carol), 366); // floor(366.6) - 0
        assertEq(vault.totalReleased(), 1200);
        assertEq(usdc.balanceOf(address(vault)), 633);
        _checkAccounting(vault, p);

        _release(vault, carol);
        assertEq(usdc.balanceOf(carol), 366);
        _release(vault, alice);
        _release(vault, bob);
        assertEq(vault.released(alice), 916);
        assertEq(vault.released(bob), 549);
        assertEq(vault.released(carol), 366);
        _checkAccounting(vault, p);
    }

    function test_MultiPayer_BalanceEqualsReceivedMinusReleased() public {
        _pay(vault, payer1, 12345);
        _release(vault, bob);
        _pay(vault, payer2, 6789);
        _release(vault, alice);
        _pay(vault, stranger, 1);
        assertEq(usdc.balanceOf(address(vault)), vault.totalReceived() - vault.totalReleased());
        assertEq(vault.totalReceived(), 12345 + 6789 + 1);
    }

    // ---------------- fuzz ----------------

    function _genShares(uint256 seed, uint256 n) internal pure returns (uint16[] memory s) {
        s = new uint16[](n);
        uint256 remaining = 10000 - n; // every payee gets >= 1
        for (uint256 i; i + 1 < n; ++i) {
            uint256 take = uint256(keccak256(abi.encode(seed, i))) % (remaining + 1);
            s[i] = uint16(1 + take);
            remaining -= take;
        }
        s[n - 1] = uint16(1 + remaining);
    }

    function _genPayees(uint256 n) internal pure returns (address[] memory p) {
        p = new address[](n);
        for (uint256 i; i < n; ++i) {
            p[i] = address(uint160(0xB000 + i));
        }
    }

    function testFuzz_Rounding_NeverOverpays_DustBounded(
        uint256 seed,
        uint8 nRaw,
        uint64[8] memory amounts,
        uint8[8] memory releasers
    ) public {
        uint256 n = bound(nRaw, 1, 10);
        address[] memory p = _genPayees(n);
        uint16[] memory s = _genShares(seed, n);
        SplitVault v = _deploy(p, s);

        for (uint256 i; i < 8; ++i) {
            uint256 amt = bound(amounts[i], 1, 1e15);
            _pay(v, i % 2 == 0 ? payer1 : payer2, amt);

            uint256 idx = releasers[i] % (n + 1);
            if (idx < n && v.pending(p[idx]) > 0) {
                uint256 beforeBal = usdc.balanceOf(p[idx]);
                uint256 pend = v.pending(p[idx]);
                _release(v, p[idx]);
                assertEq(usdc.balanceOf(p[idx]) - beforeBal, pend, "release != pending");
                assertEq(v.pending(p[idx]), 0);
            }
            _checkAccounting(v, p);
        }

        // cumulative entitlement is exactly floor(totalReceived * share / 10000)
        for (uint256 i; i < n; ++i) {
            assertEq(v.pending(p[i]) + v.released(p[i]), v.totalReceived() * s[i] / 10000);
        }
    }

    function testFuzz_Rounding_ExactWhenTotalMultipleOf10000(uint256 seed, uint8 nRaw, uint32 k) public {
        uint256 n = bound(nRaw, 1, 10);
        uint256 mult = bound(k, 1, 1e9);
        address[] memory p = _genPayees(n);
        uint16[] memory s = _genShares(seed, n);
        SplitVault v = _deploy(p, s);
        _pay(v, payer1, mult * 10000);
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            assertEq(v.pending(p[i]), mult * s[i]);
            sum += v.pending(p[i]);
        }
        assertEq(sum, v.totalReceived());
    }
}
