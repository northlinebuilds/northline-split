# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

Northline Split: a USDC revenue splitter on Arc Testnet. Users deploy their own `SplitVault` (up to 10 payees, shares in basis points summing to 10000, immutable, no owner) from the browser, open any split by address (`/?split=0x...`), pay USDC with a memo (approve then pay), and payees pull their share with `release()`. A live feed shows `Paid` and `Released` events.

Decisions:
- No vault is pre-deployed by the agent: each split is deployed from the user's wallet using the ABI and bytecode in `src/lib/splitVaultArtifact.ts` (generated from `contracts/out/SplitVault.sol/SplitVault.json`; regenerate after any contract change).
- USDC is hardcoded in the contract at Arc's standard address `0x3600000000000000000000000000000000000000`. Only USDC paid via `pay()` is accounted; direct transfers are unrecoverable.
- Log reads use 2000-block windows starting from chain head (the RPC rejects wider ranges); older history loads on demand. Creation block is stored in localStorage for splits created in this browser.
- Brand: dark navy and white (Arc Dark tokens in `src/index.css`), Space Grotesk and DM Sans.
- Tests: `contracts/test/SplitVault*.t.sol` (59 tests incl. rounding fuzz, reentrancy, invariants).

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## Share links

- Starter apps already ship `getShareBase`, `buildShareLink` and `installShareSync` in `src/lib/share.ts`; import them instead of rewriting them.
- Keep shareable state in the URL path or query, not in the `#fragment`.
- Never put a secret (private key, claim secret, seed phrase, session token, API key) in the URL path or query, encoded or not: every in-app path and query is mirrored to the visitor's studio.arc.io address bar and browser history and reaches servers. A bearer claim secret goes only in the `#fragment` appended to the share link (`` `${await buildShareLink('/claim')}#${secret}` ``) and is read from `location.hash` on load. A link to the app's own share URL shown inside the app must be copy-only or open in a new tab with `target="_blank" rel="noopener noreferrer"`.
- Build every link a user copies or sends with `buildShareLink()` from `src/lib/share.ts`.
- Keep the `installShareSync()` call in `src/main.tsx` when editing it; it keeps the Studio address bar in step with in-app navigation.
- Navigate inside the app with relative links.

## To Run

```bash
bun install
bun run dev
```
