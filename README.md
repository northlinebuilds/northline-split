# Northline Split

A USDC revenue splitter for AI agents and small teams on Arc. Create a split with up to 10 payees and fixed shares, let anyone pay USDC into it with a memo, and let each payee withdraw their own share whenever they like.

Built with [Arc Studio](https://studio.arc.io)

## Live on Arc mainnet

- **App:** https://northline-split.pages.dev
- **Demo video (73 s):** https://northline-split.pages.dev/demo.mp4 · also attached to the [v1.0.0 release](https://github.com/northlinebuilds/northline-split/releases/tag/v1.0.0)
- **Launch vault:** [`0x3E0f8d599987DB403dDad11B7Ddb9679E18fD661`](https://explorer.arc.io/address/0x3E0f8d599987DB403dDad11B7Ddb9679E18fD661) (chain 5042, source verified on [Sourcify](https://repo.sourcify.dev/5042/0x3E0f8d599987DB403dDad11B7Ddb9679E18fD661), exact match) — [open it in the app](https://northline-split.pages.dev/?split=0x3E0f8d599987DB403dDad11B7Ddb9679E18fD661)
- **Launch payment:** [0.50 USDC with memo "Northline Split launch"](https://explorer.arc.io/tx/0xc0dcc6339292bda64f56a9ccc0ae3e38b18f1f1d054d998fbc96f979c4fe3bc8), released [0.30](https://explorer.arc.io/tx/0xa429427a320934cf9c08aa96a74bf6a4b9f3e113d079da412e2b4088ed202bc3) / [0.20](https://explorer.arc.io/tx/0xfd5397b8260369a8840713e901b46f4a892326e078a35f0ccaa7318ee6a83b05) USDC
- **Arc Studio project:** https://studio.arc.io/app/d72f3f10-fe99-4125-abc1-ef6a2b271d18
- Full record: [`deployments-mainnet.json`](deployments-mainnet.json)

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
- Network: Arc mainnet (chain 5042) by default; Arc Testnet (5042002) via `?network=testnet` or `VITE_ARC_NETWORK=testnet`. USDC ERC-20 interface `0x3600…0000` (6 decimals; native gas balance is the same USDC at 18 decimals)

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

## Live

- App (Arc mainnet): https://northline-split.pages.dev
- Arc Testnet view: https://northline-split.pages.dev/?network=testnet

## Mainnet launch

`scripts/mainnet-launch.sh` deploys a SplitVault (60/40 split), approves and pays 0.50 USDC with memo
"Northline Split launch", and has both payees release their share. Without `CONFIRM=broadcast` it only simulates
(`contracts/script/MainnetLaunch.s.sol`). Simulation needs [Arc Foundry](https://docs.arc.io/arc/tutorials/install-arc-foundry)
(`arc-forge`), because stock Foundry cannot execute Arc's USDC blocklist precompile.

## License

MIT
