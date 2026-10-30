import { ConnectKitButton } from 'connectkit'
import { Wallet } from 'lucide-react'
import { useAccount } from 'wagmi'
import { CHAIN, CHAIN_ID } from '@/lib/chain'

export function NorthlineMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#ffffff" />
      <path d="M16 6.5 22 17H10l6-10.5Z" fill="#08142b" />
      <rect x="7" y="21" width="18" height="2.5" rx="1.25" fill="#08142b" />
    </svg>
  )
}

export function Header() {
  const { chainId, isConnected } = useAccount()
  const onArc = isConnected && chainId === CHAIN_ID

  return (
    <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
      <div className="flex items-center gap-3">
        <NorthlineMark />
        <div className="leading-tight">
          <div className="display text-lg font-semibold">Northline Split</div>
          <div className="text-xs" style={{ color: 'var(--subtle)' }}>
            USDC revenue splits on Arc
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isConnected && (
          <span
            className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium sm:inline-flex"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: onArc ? 'var(--success)' : 'var(--danger)',
            }}
          >
            <span className="size-1.5 rounded-full" style={{ background: 'currentColor' }} />
            {onArc ? CHAIN.name : 'Wrong network'}
          </span>
        )}
        <ConnectKitButton.Custom>
          {({ isConnected: connected, show, truncatedAddress }) => (
            <button
              onClick={show}
              className={`${connected ? 'btn-ghost' : 'btn-primary'} inline-flex min-h-11 items-center gap-2 px-4 text-sm`}
            >
              <Wallet className="size-4" />
              {connected ? truncatedAddress : 'Connect wallet'}
            </button>
          )}
        </ConnectKitButton.Custom>
      </div>
    </header>
  )
}
