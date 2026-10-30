import { useQuery } from '@tanstack/react-query'
import { usePublicClient } from 'wagmi'
import type { Address } from 'viem'
import { splitVaultAbi } from '@/lib/splitVaultArtifact'
import { CHAIN_ID } from '@/lib/chain'

export interface PayeeState {
  address: Address
  bps: number
  pending: bigint
  released: bigint
}

export interface SplitState {
  address: Address
  payees: PayeeState[]
  totalReceived: bigint
  totalReleased: bigint
}

/** Reads a split's full state in two round trips (payee list, then one batched multicall). */
export function useSplit(address: Address | undefined) {
  const client = usePublicClient({ chainId: CHAIN_ID })

  return useQuery<SplitState>({
    queryKey: ['split', address],
    enabled: Boolean(client && address),
    refetchInterval: 6000,
    retry: 1,
    queryFn: async () => {
      if (!client || !address) throw new Error('Not ready')

      const [payees, shares] = await client.readContract({
        address,
        abi: splitVaultAbi,
        functionName: 'getPayees',
      })

      const calls = [
        { address, abi: splitVaultAbi, functionName: 'totalReceived' } as const,
        { address, abi: splitVaultAbi, functionName: 'totalReleased' } as const,
        ...payees.flatMap((payee) => [
          { address, abi: splitVaultAbi, functionName: 'pending', args: [payee] } as const,
          { address, abi: splitVaultAbi, functionName: 'released', args: [payee] } as const,
        ]),
      ]

      const results = await client.multicall({ contracts: calls, allowFailure: false })
      const totalReceived = results[0]
      const totalReleased = results[1]

      return {
        address,
        totalReceived,
        totalReleased,
        payees: payees.map((payee, i) => ({
          address: payee,
          bps: shares[i],
          pending: results[2 + i * 2],
          released: results[3 + i * 2],
        })),
      }
    },
  })
}
