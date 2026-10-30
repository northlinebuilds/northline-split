# Northline Split — Arc Microgrants submission

**One line:** An immutable USDC revenue splitter on Arc: one address takes payments with a memo, each payee pulls exactly their share. No owner, no admin, no upgrade path.

- Live app (Arc mainnet): https://northline-split.pages.dev
- Mainnet vault: `<VAULT_ADDRESS>` — https://explorer.arc.io/address/<VAULT_ADDRESS>
- Launch payment tx: `<PAY_TX>` · releases: `<RELEASE_MAIN_TX>`, `<RELEASE_REVENUE_TX>`
- Repo (MIT): https://github.com/northlinebuilds/northline-split
- Arc Studio project: https://studio.arc.io/app/d72f3f10-fe99-4125-abc1-ef6a2b271d18
- Builder: Northline (northlinebuilds)

## The problem
Small teams, freelancers and AI agents that sell services get paid to one address, then someone has to split the money by
hand: spreadsheets, trust, and a transfer per person. On most chains each of those transfers also needs a second gas token.

## What Northline Split does
- **Create a split** from the browser: up to 10 payees with fixed basis-point shares that must total 100%. Shares are
  immutable once deployed.
- **Pay** any amount of USDC with a memo (`approve` then `pay(amount, memo)`). The contract checks the exact balance
  increase before counting it, so fee-on-transfer surprises can't skew accounting.
- **Release**: each payee calls `release()` and receives only their own pending share (pull-based, `ReentrancyGuard`,
  checks-effects-interactions). Rounding floors on cumulative receipts, so dust carries forward instead of being lost.
- **Live feed** of `Paid` and `Released` events with Arc explorer links; any split can be opened by link (`/?split=0x…`).

## Real use on Arc mainnet
We point our own revenue at it. Northline runs two paid x402 APIs (ChainKit and WebKit) whose revenue lands in one wallet;
the launch vault splits income 60/40 between our operating wallet and that revenue wallet. The launch transaction paid
0.50 USDC into the vault with memo "Northline Split launch", then both payees released their shares (0.30 / 0.20 USDC).
All USDC movement is native Arc USDC through the ERC-20 interface at `0x3600000000000000000000000000000000000000`, and gas
was paid in USDC (whole launch ≈ 0.022 USDC of gas).

## How we used Arc Studio
- The whole app was generated and iterated in Arc Studio: the `SplitVault` contract, the React/wagmi frontend (dark navy
  Arc theme) and the Foundry test suite.
- Studio wrote **55 Foundry tests** — unit tests (constructor validation, pay/release paths, memos, errors), rounding fuzz
  tests, reentrancy tests with a malicious token, and a stateful invariant suite (~128k handler calls) proving aggregate
  entitlements never exceed receipts. All pass (`forge test`).
- Studio's on-chain facts layer (`src/onchain-facts.ts`, `src/onchain-money.ts`) keeps Arc's two USDC views straight
  (18-decimal native gas vs 6-decimal ERC-20) so the UI never mixes them.
- Studio tested the contract on Arc Testnet first. We then added a mainnet config (default chain 5042, explorer.arc.io,
  testnet still available with `?network=testnet`), a mainnet launch script, and simulated it with Arc Foundry
  (`arc-forge`) against mainnet state before broadcasting.

## Why it can grow
- Every x402 / agent-commerce seller has the "one address, many owners" problem; a split address is a drop-in `payTo`.
- Next: a factory with deterministic addresses (CREATE2) so splits can be predicted before deploy, Memo-contract
  integration for invoice IDs, CCTP/Gateway so payers on other chains can fund a split, and an ERC-8004 agent identity
  link so an agent can advertise its split as its payout address.

## Tech
Solidity 0.8.28 · OpenZeppelin 5 (SafeERC20, ReentrancyGuard) · Foundry + Arc Foundry · React 18 · Vite · wagmi/viem
(`arc` chain) · ConnectKit · Cloudflare Pages.
