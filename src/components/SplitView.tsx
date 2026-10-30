import { useCallback, useEffect, useState } from 'react'
import type { Address } from 'viem'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { addressUrl, formatUsdcAmount, shortAddress } from '@/lib/chain'
import { buildShareLink } from '@/lib/share'
import { getSavedSplit, saveSplit } from '@/lib/splits'
import { useSplit } from '@/hooks/useSplit'
import { PayCard } from '@/components/PayCard'
import { PayeesList } from '@/components/PayeesList'
import { ActivityFeed } from '@/components/ActivityFeed'

export function SplitView({ address, onBack }: { address: Address; onBack: () => void }) {
  const queryClient = useQueryClient()
  const split = useSplit(address)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const saved = getSavedSplit(address)
  const startBlock = saved?.createdBlock ? BigInt(saved.createdBlock) : undefined

  useEffect(() => {
    if (split.data) saveSplit({ address })
  }, [split.data, address])

  useEffect(() => {
    let active = true
    void buildShareLink(`/?split=${address}`).then((link) => {
      if (active) setShareLink(link)
    })
    return () => {
      active = false
    }
  }, [address])

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['split', address] })
  }, [queryClient, address])

  const copyLink = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const data = split.data
  const unreleased = data ? data.totalReceived - data.totalReleased : 0n

  return (
    <div>
      <button className="btn-ghost mb-4 inline-flex min-h-11 items-center gap-2 px-3 text-sm" onClick={onBack}>
        <ArrowLeft className="size-4" /> All splits
      </button>

      {split.isError && (
        <section className="card p-6">
          <h2 className="display text-xl font-semibold">No split found here</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            <span className="mono">{shortAddress(address)}</span> is not a Northline split on Arc Testnet, or the network did not respond.
          </p>
          <div className="mt-4 flex gap-2">
            <button className="btn-primary min-h-11 px-5 text-sm" onClick={() => void split.refetch()}>
              Try again
            </button>
            <button className="btn-ghost min-h-11 px-4 text-sm" onClick={onBack}>
              Back
            </button>
          </div>
        </section>
      )}

      {!split.isError && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <section className="card p-6">
              <div className="text-xs font-semibold uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
                Total received
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                {data ? (
                  <span className="display text-5xl font-bold tabular-nums">{formatUsdcAmount(data.totalReceived)}</span>
                ) : (
                  <span className="h-12 w-48 animate-pulse rounded-xl" style={{ background: 'var(--surface-strong)' }} />
                )}
                <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>
                  USDC
                </span>
              </div>
              <div className="mt-2 text-sm tabular-nums" style={{ color: 'var(--muted)' }}>
                {data ? `${formatUsdcAmount(data.totalReleased)} released · ${formatUsdcAmount(unreleased)} in the vault` : 'Reading from Arc Testnet…'}
              </div>

              <div className="mt-5 flex items-center gap-2 rounded-2xl p-3" style={{ background: 'var(--surface-strong)' }}>
                <span className="mono min-w-0 flex-1 truncate text-xs" title={address}>
                  {address}
                </span>
                <a
                  aria-label="View split on explorer"
                  className="btn-ghost inline-flex size-9 shrink-0 items-center justify-center"
                  href={addressUrl(address)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-4" />
                </a>
                <button
                  aria-label="Copy share link"
                  className="btn-ghost inline-flex size-9 shrink-0 items-center justify-center"
                  disabled={!shareLink}
                  onClick={() => void copyLink()}
                >
                  {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                </button>
              </div>
            </section>

            <PayCard vault={address} />
          </div>

          <div className="space-y-5">
            {data ? (
              <PayeesList split={data} />
            ) : (
              <section className="card p-6" aria-busy="true">
                <div className="h-6 w-24 animate-pulse rounded-lg" style={{ background: 'var(--surface-strong)' }} />
                <div className="mt-4 h-16 animate-pulse rounded-2xl" style={{ background: 'var(--surface-strong)' }} />
              </section>
            )}
            <ActivityFeed vault={address} startBlock={startBlock} onNewEvents={refresh} />
          </div>
        </div>
      )}
    </div>
  )
}
