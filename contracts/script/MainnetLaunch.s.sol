// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SplitVault} from "../SplitVault.sol";

/// @notice Northline Split launch on Arc mainnet (chain 5042):
///   1. deploy SplitVault with payees [MAIN 60%, REVENUE 40%]
///   2. MAIN approves the vault for exactly LAUNCH_AMOUNT USDC (ERC-20 interface, 6 decimals)
///   3. MAIN pays LAUNCH_AMOUNT with memo "Northline Split launch"
///   4. MAIN releases its 60% share back to itself (REVENUE releases its 40% later from its own key)
/// Dry run (no key, nothing sent):
///   forge script contracts/script/MainnetLaunch.s.sol --rpc-url arc --sender $MAIN
/// Broadcast (only after explicit approval):
///   forge script contracts/script/MainnetLaunch.s.sol --rpc-url arc --private-key $KEY --broadcast --slow
contract MainnetLaunch is Script {
    address constant MAIN = 0xFe5D81D8268CBaC025829CEdD11D5cF6962d4096;
    address constant REVENUE = 0xD4F04c07037c42F84e5B15A7843e58e1C6FccC96;
    uint256 constant LAUNCH_AMOUNT = 500_000; // 0.50 USDC (6 decimals)

    function run() external returns (SplitVault vault) {
        require(block.chainid == 5042 || block.chainid == 5042002, "not an Arc chain");
        IERC20 usdc = IERC20(0x3600000000000000000000000000000000000000);

        address[] memory payees = new address[](2);
        payees[0] = MAIN;
        payees[1] = REVENUE;
        uint16[] memory shares = new uint16[](2);
        shares[0] = 6000;
        shares[1] = 4000;

        vm.startBroadcast(MAIN);
        vault = new SplitVault(payees, shares);
        usdc.approve(address(vault), LAUNCH_AMOUNT);
        vault.pay(LAUNCH_AMOUNT, "Northline Split launch");
        vault.release();
        vm.stopBroadcast();

        console2.log("vault", address(vault));
        console2.log("totalReceived", vault.totalReceived());
        console2.log("released MAIN", vault.released(MAIN));
        console2.log("pending REVENUE", vault.pending(REVENUE));
        console2.log("vault USDC balance", usdc.balanceOf(address(vault)));
    }
}
