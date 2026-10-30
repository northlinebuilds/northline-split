import type { Address } from 'viem'
import { arcTestnet } from 'viem/chains'
import { buildAddressExplorerUrl, buildTxExplorerUrl, getUsdc, requireChain } from '@/onchain-facts'
import { Amount, formatAmount, usdcDecimalsFor } from '@/onchain-money'

export const CHAIN_ID = arcTestnet.id
export const CHAIN = requireChain(CHAIN_ID)

const usdcFact = getUsdc(CHAIN_ID)
if (!usdcFact) throw new Error('USDC is not configured for ' + CHAIN.name)

export const USDC_ADDRESS = usdcFact.address as Address
export const USDC_DECIMALS = usdcDecimalsFor(CHAIN_ID)

export const txUrl = (hash: string) => buildTxExplorerUrl(CHAIN_ID, hash)
export const addressUrl = (address: string) => buildAddressExplorerUrl(CHAIN_ID, address)

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** Formats a raw ERC-20 USDC amount with thousands separators and at least two decimals. */
export function formatUsdcAmount(raw: bigint): string {
  const text = formatAmount(CHAIN_ID, Amount.fromRaw(raw, USDC_DECIMALS))
  const [whole, fraction = ''] = text.split('.')
  const grouped = BigInt(whole).toLocaleString('en-US')
  return `${grouped}.${fraction.padEnd(2, '0')}`
}

export const formatBps = (bps: number) => `${(bps / 100).toFixed(2).replace(/\.?0+$/, '')}%`
