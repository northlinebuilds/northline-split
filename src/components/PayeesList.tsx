import { useState } from 'react'
import { useAccount, usePublicClient, useWriteContract } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Address } from 'viem'
import { splitVaultAbi } from '@/lib/splitVaultArtifact'
import { CHAIN_ID, addressUrl, formatBps, formatUsdcAmount, shortAddress } from '@/lib/chain'
import { describeError, isUserRejection } from '@/lib/errors'
import { useEnsureChain } from '@/hooks/useEnsureChain'
import type { SplitState } from '@/hooks/useSplit'

export function PayeesList({ split }: { split: SplitState }) {
  const { address: account } = useAccount()
  const { ensure } = useEnsureChain()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const queryClient = useQueryClient()
  const { writeContractAsync } = useWriteContract()
  const [releasing, setReleasing] = useState<'wallet' | 'confirm' | null>(null)

  const release = async (vault: Address, amount: bigint) => {
    if (!client) return
    if (!(await ensure())) {
      toast.error('Switch your wallet to Arc Testnet to continue.')
      return
    }
    setReleasing('wallet')
    try {
      const hash = await writeContractAsync({ address: vault, abi: splitVaultAbi, functionName: 'release', chainId: CHAIN_ID })
      setReleasing('confirm')
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted')
      toast.success(`Released ${formatUsdcAmount(amount)} USDC to your wallet`)
      await queryClient.invalidateQueries({ queryKey: ['split', vault] })
    } catch (error) {
      if (!isUserRejection(error)) toast.error(describeError(error))
    } finally {
      setReleasing(null)
    }
  }

  return (
    <section className="card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-lg font-semibold">Payees</h2>
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          Each payee releases from their own wallet
        </span>
      </div>

      <ul className="mt-4 divide-y" style={{ borderColor: 'var(--border)' }}>
        {split.payees.map((payee) => {
          const mine = account?.toLowerCase() === payee.address.toLowerCase()
          return (
            <li key={payee.address} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
              <div className="min-w-0 flex-1 basis-40">
                <div className="flex items-center gap-2">
                  <a
                    className="mono inline-flex items-center gap-1 text-sm hover:underline"
                    href={addressUrl(payee.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={payee.address}
                  >
                    {shortAddress(payee.address)} <ExternalLink className="size-3" style={{ color: 'var(--subtle)' }} />
                  </a>
                  {mine && (
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'var(--accent)', color: 'var(--accent-ink)', letterSpacing: '0.06em' }}>
                      You
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
                  {formatBps(payee.bps)} share
                </div>
              </div>

              <div className="text-right tabular-nums">
                <div className="text-[11px] uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                  Pending
                </div>
                <div className="display text-lg font-semibold">{formatUsdcAmount(payee.pending)}</div>
              </div>
              <div className="text-right tabular-nums">
                <div className="text-[11px] uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                  Released
                </div>
                <div className="display text-lg font-semibold" style={{ color: 'var(--muted)' }}>
                  {formatUsdcAmount(payee.released)}
                </div>
              </div>

              {mine && (
                <div className="w-full sm:w-auto">
                  <button
                    className="btn-primary min-h-11 w-full px-5 text-sm sm:w-auto"
                    disabled={payee.pending === 0n || releasing !== null}
                    onClick={() => void release(split.address, payee.pending)}
                  >
                    {releasing ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> {releasing === 'wallet' ? 'Confirm in wallet…' : 'Confirming…'}
                      </span>
                    ) : (
                      'Release'
                    )}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
