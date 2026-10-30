/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 * Mainnet config: Arc mainnet (5042) by default; Arc Testnet via ?network=testnet or VITE_ARC_NETWORK=testnet.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arc, arcTestnet } from 'viem/chains'
import { injected } from 'wagmi/connectors'
import { ARC_CHAIN, IS_TESTNET } from './lib/network'
import { registerChain } from './tracing'

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(ARC_CHAIN.id, ARC_CHAIN.rpcUrls.default.http[0])

export const config = createConfig({
  // The selected Arc network is listed first; mainnet is needed for ENS resolution.
  chains: IS_TESTNET ? [arcTestnet, arc, mainnet] : [arc, arcTestnet, mainnet],
  connectors: [injected()],
  transports: {
    [arc.id]: http('https://rpc.mainnet.arc.io'),
    [arcTestnet.id]: http('https://rpc.testnet.arc.io'),
    [mainnet.id]: http('https://cloudflare-eth.com'), // ENS resolution uses mainnet
  },
})
