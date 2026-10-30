// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVaultLike {
    function release() external;
    function pay(uint256 amount, string calldata memo) external;
}

/// @dev 6-decimal ERC-20 usable with vm.etch. decimals is a pure constant (no storage needed).
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Fee-on-transfer / bonus-on-transfer variant. Configure AFTER etching.
contract FeeUSDC is MockUSDC {
    uint256 public feeBps; // burned from the sender on transferFrom
    uint256 public bonus; // extra minted to the recipient on transferFrom

    function setFee(uint256 feeBps_) external {
        feeBps = feeBps_;
    }

    function setBonus(uint256 bonus_) external {
        bonus = bonus_;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        _spendAllowance(from, _msgSender(), value);
        uint256 fee = value * feeBps / 10000;
        _transfer(from, to, value - fee);
        if (fee > 0) _burn(from, fee);
        if (bonus > 0) _mint(to, bonus);
        return true;
    }
}

/// @dev Token that calls back into `attacker.hook()` after transfer (to == attacker)
/// and after transferFrom (from == attacker). Revert data from the hook is bubbled.
contract ReentrantUSDC is MockUSDC {
    address public attacker;

    function setAttacker(address a) external {
        attacker = a;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        bool ok = super.transfer(to, value);
        _hook(to);
        return ok;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool ok = super.transferFrom(from, to, value);
        _hook(from);
        return ok;
    }

    function _hook(address who) internal {
        if (attacker != address(0) && who == attacker) {
            (bool s, bytes memory r) = who.call(abi.encodeWithSignature("hook()"));
            if (!s) {
                assembly {
                    revert(add(r, 32), mload(r))
                }
            }
        }
    }
}

/// @dev A payee and/or payer contract that tries to re-enter the vault from the token callback.
contract ReentrantActor {
    enum Action {
        None,
        Release,
        Pay
    }

    address internal constant USDC = 0x3600000000000000000000000000000000000000;

    IVaultLike public vault;
    Action public action;
    bool public bubble;
    uint256 public reenterAmount;

    bool public attempted;
    bool public reenterSucceeded;
    bytes4 public lastSelector;

    constructor(address vault_) {
        vault = IVaultLike(vault_);
    }

    function setAction(Action a, bool bubble_, uint256 amount) external {
        action = a;
        bubble = bubble_;
        reenterAmount = amount;
        IERC20(USDC).approve(address(vault), type(uint256).max);
    }

    function callRelease() external {
        vault.release();
    }

    function callPay(uint256 amount) external {
        IERC20(USDC).approve(address(vault), type(uint256).max);
        vault.pay(amount, "outer");
    }

    function hook() external {
        Action a = action;
        if (a == Action.None) return;
        action = Action.None; // only re-enter once
        attempted = true;

        if (a == Action.Release) {
            try vault.release() {
                reenterSucceeded = true;
            } catch (bytes memory err) {
                _record(err);
            }
        } else {
            try vault.pay(reenterAmount, "inner") {
                reenterSucceeded = true;
            } catch (bytes memory err) {
                _record(err);
            }
        }
    }

    function _record(bytes memory err) internal {
        if (err.length >= 4) lastSelector = bytes4(err);
        if (bubble) {
            assembly {
                revert(add(err, 32), mload(err))
            }
        }
    }
}
