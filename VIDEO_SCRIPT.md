# Northline Split — walkthrough video (≈75 s)

| Time | On screen | Voice-over |
|---|---|---|
| 0:00–0:08 | App home, https://northline-split.pages.dev | "This is Northline Split: one USDC address that pays everyone their share, live on Arc mainnet." |
| 0:08–0:20 | Arc Studio project: chat history, contract file, tests panel | "We built it in Arc Studio. Studio wrote the SplitVault contract, the React app and 55 Foundry tests, including fuzz, reentrancy and invariant suites." |
| 0:20–0:30 | Terminal: `forge test` → 55 passed | "Everything passes locally too." |
| 0:30–0:42 | App: open the mainnet vault link (`?split=<VAULT>`), payee list 60% / 40% | "Here's our launch vault on mainnet: our operating wallet gets 60%, our API revenue wallet 40%. Shares are fixed forever. No owner, no admin." |
| 0:42–0:55 | Activity feed: Paid 0.50 USDC "Northline Split launch", then two Released rows; click through to explorer.arc.io | "We paid 0.50 USDC in with a memo, and each payee pulled exactly their share: 0.30 and 0.20. Gas was paid in USDC, about two cents for the whole launch." |
| 0:55–1:05 | Create split form: add payees and percentages | "Anyone can create their own split from the browser in one transaction and share the link." |
| 1:05–1:15 | Repo page on GitHub + closing card | "We're pointing our x402 API revenue at it next. Code is MIT on GitHub. Northline Split, built in Arc Studio, running on Arc." |

Recording notes: 1080p screen capture, no face or personal name; use the Northline brand only. Show explorer.arc.io tx
pages for the pay and release transactions so judges see real mainnet USDC movement.
