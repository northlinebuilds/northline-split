// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Northline Split
/// @notice Immutable USDC revenue splitter for AI agents and small teams on Arc.
/// @dev Only USDC received through pay() is accounted for. Plain token transfers
/// are untracked and cannot be rescued. There is no owner, admin, or upgrade path.
/// All token amounts are expressed in USDC's smallest units (6 decimals).
contract SplitVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Arc's USDC token; fixed at compile time, not stored in storage.
    IERC20 public constant USDC = IERC20(0x3600000000000000000000000000000000000000);

    /// @notice Total USDC accepted through pay(), including amounts already released.
    uint256 public totalReceived;

    /// @notice Total USDC released to all payees.
    uint256 public totalReleased;

    /// @notice Cumulative USDC released to each payee.
    mapping(address => uint256) public released;

    /// @notice Fixed share in basis points for each payee; zero for non-payees.
    mapping(address => uint16) public shareBps;

    /// @dev Fixed payee list in constructor order; never modified after construction.
    address[] private _payees;

    /// @notice Payee and share arrays have different lengths.
    error LengthMismatch();
    /// @notice At least one payee is required.
    error EmptyPayees();
    /// @notice At most ten payees are supported.
    error TooManyPayees();
    /// @notice A payee cannot be the zero address.
    error ZeroAddress();
    /// @notice The vault cannot be its own payee.
    error VaultAsPayee();
    /// @notice Every payee must have a positive share.
    error ZeroShare();
    /// @notice Each payee must appear exactly once.
    error DuplicatePayee();
    /// @notice Shares must sum to exactly 10000 basis points.
    error InvalidShareSum();
    /// @notice A payment must be greater than zero.
    error ZeroAmount();
    /// @notice A payment memo cannot exceed 256 bytes.
    error MemoTooLong();
    /// @notice The vault's USDC balance did not increase by the requested amount.
    error UnexpectedTransferAmount();
    /// @notice Only a configured payee may call release().
    error NotPayee();
    /// @notice The payee has no USDC currently available to release.
    error NothingToRelease();

    /// @notice Emitted after an exact USDC payment has been accepted.
    /// @param payer Address that supplied the USDC.
    /// @param amount USDC received in smallest units.
    /// @param memo Payer-supplied memo, at most 256 bytes.
    event Paid(address indexed payer, uint256 amount, string memo);

    /// @notice Emitted after USDC is released to the calling payee.
    /// @param payee Recipient of the released USDC.
    /// @param amount USDC released in smallest units.
    event Released(address indexed payee, uint256 amount);

    /// @notice Sets the permanent payees and their basis-point shares.
    /// @param payees One to ten distinct, nonzero addresses other than this vault.
    /// @param sharesBps Positive shares corresponding to payees, summing to 10000.
    constructor(address[] memory payees, uint16[] memory sharesBps) {
        uint256 count = payees.length;
        if (count != sharesBps.length) revert LengthMismatch();
        if (count == 0) revert EmptyPayees();
        if (count > 10) revert TooManyPayees();

        uint256 sum;
        for (uint256 i; i < count; ++i) {
            address payee = payees[i];
            uint16 share = sharesBps[i];
            if (payee == address(0)) revert ZeroAddress();
            if (payee == address(this)) revert VaultAsPayee();
            if (share == 0) revert ZeroShare();
            if (shareBps[payee] != 0) revert DuplicatePayee();

            _payees.push(payee);
            shareBps[payee] = share;
            sum += share;
        }
        if (sum != 10000) revert InvalidShareSum();
    }

    /// @notice Pulls an approved USDC payment from the caller for all payees.
    /// @dev Accounting follows the guarded transfer because the exact balance
    /// increase must be verified first. Direct transfers are not accounted for.
    /// @param amount Positive USDC amount in smallest units.
    /// @param memo Memo containing at most 256 bytes.
    function pay(uint256 amount, string calldata memo) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (bytes(memo).length > 256) revert MemoTooLong();

        uint256 balanceBefore = USDC.balanceOf(address(this));
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        uint256 balanceAfter = USDC.balanceOf(address(this));
        if (balanceAfter < balanceBefore || balanceAfter - balanceBefore != amount) {
            revert UnexpectedTransferAmount();
        }

        totalReceived += amount;
        emit Paid(msg.sender, amount, memo);
    }

    /// @notice Releases the caller's entire pending entitlement to the caller only.
    /// @dev Updates cumulative accounting before transferring USDC.
    function release() external nonReentrant {
        if (shareBps[msg.sender] == 0) revert NotPayee();
        uint256 amount = pending(msg.sender);
        if (amount == 0) revert NothingToRelease();

        released[msg.sender] += amount;
        totalReleased += amount;
        USDC.safeTransfer(msg.sender, amount);
        emit Released(msg.sender, amount);
    }

    /// @notice Returns a payee's currently unreleased entitlement.
    /// @dev Floors the share of cumulative receipts, not individual payments,
    /// so rounding remainders carry forward as more payments are received.
    /// Aggregate entitlements never exceed totalReceived.
    /// @param payee Address whose entitlement is requested.
    /// @return amount Pending USDC in smallest units; zero for a non-payee.
    function pending(address payee) public view returns (uint256 amount) {
        uint16 share = shareBps[payee];
        if (share == 0) return 0;
        uint256 entitled = totalReceived * share / 10000;
        return entitled - released[payee];
    }

    /// @notice Returns the permanent payees and shares in constructor order.
    /// @return payees Configured payee addresses.
    /// @return shares Corresponding shares in basis points.
    function getPayees() external view returns (address[] memory payees, uint16[] memory shares) {
        payees = _payees;
        shares = new uint16[](payees.length);
        for (uint256 i; i < payees.length; ++i) {
            shares[i] = shareBps[payees[i]];
        }
    }

    /// @notice Returns the number of permanent payees.
    /// @return count Number of configured payees, between one and ten.
    function payeeCount() external view returns (uint256 count) {
        return _payees.length;
    }
}
