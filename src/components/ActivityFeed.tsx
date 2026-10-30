import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2 } from 'lucide-react'
import type { Address } from 'viem'
import { addressUrl, formatUsdcAmount, shortAddress, txUrl } from '@/lib/chain'
import { useActivity } from '@/hooks/useActivity'

interface Props {
  vault: Address
  startBlock?: bigint
  onNewEvents: () => void
}

export function ActivityFeed({ vault, startBlock, onNewEvents }: Props) {
  const { items, oldestBlock, headBlock, reachedStart, loading, error, loadOlder, retry } = useActivity(vault, startBlock, onNewEvents)

  return (
    <section className="card p-6">
      <div className="flex items-center justify-between">
        <h2 className="display text-lg font-semibold">Activity</h2>
        <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
          <span className="size-1.5 animate-pulse rounded-full" style={{ background: 'var(--success)' }} />
          Live
        </span>
      </div>

      {items.length === 0 && loading && (
        <div className="mt-4 space-y-3" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl" style={{ background: 'var(--surface-strong)' }} />
          ))}
        </div>
      )}

      {items.length === 0 && !loading && !error && (
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
          No payments or releases in the blocks scanned so far.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3 rounded-2xl p-3" style={{ background: 'var(--surface)' }}>
            <span
              className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{
                background: item.kind === 'paid' ? 'rgba(141,216,159,0.14)' : 'rgba(143,180,240,0.14)',
                color: item.kind === 'paid' ? 'var(--success)' : 'var(--focus)',
              }}
            >
              {item.kind === 'paid' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-sm font-medium">
                  {item.kind === 'paid' ? 'Paid by ' : 'Released to '}
                  <a className="mono text-xs hover:underline" href={addressUrl(item.actor)} target="_blank" rel="noopener noreferrer" title={item.actor}>
                    {shortAddress(item.actor)}
                  </a>
                </span>
                <span className="display text-base font-semibold tabular-nums">
                  {item.kind === 'paid' ? '+' : '−'}
                  {formatUsdcAmount(item.amount)} <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>USDC</span>
                </span>
              </div>
              {item.memo && (
                <p className="mt-0.5 break-words text-sm" style={{ color: 'var(--muted)' }}>
                  “{item.memo}”
                </p>
              )}
              <a
                className="mt-1 inline-flex items-center gap-1 text-xs tabular-nums hover:underline"
                style={{ color: 'var(--subtle)' }}
                href={txUrl(item.txHash)}
                target="_blank"
                rel="noopener noreferrer"
              >
                Block {item.blockNumber.toLocaleString('en-US')} <ExternalLink className="size-3" />
              </a>
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-3 text-sm" style={{ color: 'var(--danger)' }}>
          <span>{error}</span>
          <button className="btn-ghost min-h-9 px-3 text-xs" onClick={retry}>
            Retry
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
        <span>
          {oldestBlock !== null && headBlock !== null
            ? `Scanned blocks ${oldestBlock.toLocaleString('en-US')} to ${headBlock.toLocaleString('en-US')}`
            : 'Connecting to Arc Testnet…'}
          {reachedStart ? ' (since creation)' : ''}
        </span>
        {!reachedStart && oldestBlock !== null && (
          <button className="btn-ghost inline-flex min-h-9 items-center gap-1.5 px-3 text-xs" disabled={loading} onClick={loadOlder}>
            {loading && <Loader2 className="size-3 animate-spin" />} Load older
          </button>
        )}
      </div>
    </section>
  )
}
