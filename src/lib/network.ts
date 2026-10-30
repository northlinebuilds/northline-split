import { arc, arcTestnet } from 'viem/chains'

/**
 * Network selection. Default is Arc mainnet (chain 5042).
 * Build with VITE_ARC_NETWORK=testnet, or open the app with ?network=testnet, for Arc Testnet.
 */
const fromQuery =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('network') : null
const fromEnv = import.meta.env.VITE_ARC_NETWORK as string | undefined

export const NETWORK: 'mainnet' | 'testnet' =
  (fromQuery ?? fromEnv ?? 'mainnet') === 'testnet' ? 'testnet' : 'mainnet'

export const ARC_CHAIN = NETWORK === 'testnet' ? arcTestnet : arc

/** Human label used in UI copy. */
export const NETWORK_LABEL = NETWORK === 'testnet' ? 'Arc Testnet' : 'Arc mainnet'
export const IS_TESTNET = NETWORK === 'testnet'
