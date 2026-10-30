# Northline Split

A USDC revenue splitter for AI agents and small teams on Arc. Create a split with up to 10 payees and fixed shares, let anyone pay USDC into it with a memo, and let each payee withdraw their own share whenever they like.

Built with [Arc Studio](https://studio.arc.io)

## What you can do

- Create a split from your wallet: payee addresses and percentages that total 100%. Shares cannot be changed afterwards and there is no owner or admin.
- Open any split by address, or from a shared link.
- Pay USDC into a split with an optional memo (you allow the amount first, then pay).
- See each payee's share, pending amount and released amount, and release your own share.
- Watch a live feed of payments and releases with explorer links.

Payments must go through the app (or the contract's `pay` function). USDC sent to a split by a plain transfer is not counted and cannot be recovered.

## Tech stack

- React, Vite, TypeScript, Tailwind CSS
- wagmi, viem, ConnectKit
- Solidity 0.8.28 with Foundry and OpenZeppelin
- Network: Arc Testnet, USDC

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://getfoundry.sh).

```bash
bun install
bun run dev          # start the app
bun run check        # lint and typecheck
bun run contracts:build
bun run contracts:test
```

If you change `contracts/SplitVault.sol`, rebuild and regenerate `src/lib/splitVaultArtifact.ts` from `contracts/out/SplitVault.sol/SplitVault.json`.

### Environment variables

None.
