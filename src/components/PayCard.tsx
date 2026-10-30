import { useState } from 'react'
import { erc20Abi, type Address } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { splitVaultAbi } from '@/lib/splitVaultArtifact'
import { CHAIN_ID, USDC_ADDRESS, formatUsdcAmount, txUrl } from '@/lib/chain'
import { describeError, isUserRejection } from '@/lib/errors'
import { parseAmount } from '@/onchain-money'
import { useEnsureChain } from '@/hooks/useEnsureChain'

type Stage = 'idle' | 'approve-wallet' | 'approve-confirm' | 'pay-wallet' | 'pay-confirm'

const MAX_MEMO_BYTES = 256
const encoder = new TextEncoder()

function safeParse(value: string): bigint | null {
  if (!value) return null
  try {
    const amount = parseAmount(CHAIN_ID, value)
    return amount.isPositive() ? amount.raw : null
  } catch {
    return null
  }
}

export function PayCard({ vault }: { vault: Address }) {
  const { address: account, isConnected } = useAccount()
  const { ensure } = useEnsureChain()
  const client = usePublicClient({ chainId: CHAIN_ID })
  const queryClient = useQueryClient()
  const { writeContractAsync } = useWriteContract()

  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [stage, setStage] = useState<Stage>('idle')
  const [lastHash, setLastHash] = useState<`0x${string}` | null>(null)

  const balance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(account), refetchInterval: 8000 },
  })
  const allowance = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: account ? [account, vault] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: Boolean(account), refetchInterval: 8000 },
  })

  const raw = safeParse(amount)
  const memoBytes = encoder.encode(memo).length
  const memoTooLong = memoBytes > MAX_MEMO_BYTES
  const insufficient = raw !== null && balance.data !== undefined && raw > balance.data
  const needsApproval = raw !== null && (allowance.data ?? 0n) < raw
  const busy = stage !== 'idle'
  const valid = raw !== null && !memoTooLong && !insufficient

  const send = async (kind: 'approve' | 'pay') => {
    if (raw === null || !client) return
    if (!(await ensure())) {
      toast.error('Switch your wallet to Arc Testnet to continue.')
      return
    }
    setStage(kind === 'approve' ? 'approve-wallet' : 'pay-wallet')
    try {
      const hash =
        kind === 'approve'
          ? await writeContractAsync({
              address: USDC_ADDRESS,
              abi: erc20Abi,
              functionName: 'approve',
              args: [vault, raw],
              chainId: CHAIN_ID,
            })
          : await writeContractAsync({
              address: vault,
              abi: splitVaultAbi,
              functionName: 'pay',
              args: [raw, memo],
              chainId: CHAIN_ID,
            })
      setLastHash(hash)
      setStage(kind === 'approve' ? 'approve-confirm' : 'pay-confirm')
      const receipt = await client.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Transaction reverted')

      await Promise.all([allowance.refetch(), balance.refetch()])
      if (kind === 'pay') {
        toast.success(`Paid ${formatUsdcAmount(raw)} USDC into the split`)
        setAmount('')
        setMemo('')
        await queryClient.invalidateQueries({ queryKey: ['split', vault] })
      }
    } catch (error) {
      if (!isUserRejection(error)) toast.error(describeError(error))
    } finally {
      setStage('idle')
    }
  }

  const label = (() => {
    if (stage === 'approve-wallet' || stage === 'pay-wallet') return 'Confirm in wallet…'
    if (stage === 'approve-confirm') return 'Confirming approval…'
    if (stage === 'pay-confirm') return 'Confirming payment…'
    if (raw === null) return 'Enter an amount'
    if (insufficient) return 'Insufficient USDC'
    return needsApproval ? 'Step 1 of 2: Allow USDC' : 'Pay into split'
  })()

  return (
    <section className="card p-6">
      <h2 className="display text-lg font-semibold">Pay into this split</h2>

      <div className="mt-4 rounded-2xl p-4" style={{ background: 'var(--surface-strong)' }}>
        <label className="text-xs" style={{ color: 'var(--subtle)' }} htmlFor="pay-amount">
          Amount
        </label>
        <div className="mt-1 flex items-baseline gap-2">
          <input
            id="pay-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            disabled={busy}
            onChange={(event) => {
              const value = event.target.value
              if (value === '' || /^\d*\.?\d{0,6}$/.test(value)) setAmount(value)
            }}
            className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:opacity-30"
          />
          <span className="text-lg font-medium" style={{ color: 'var(--subtle)' }}>
            USDC
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {['1', '10', '100'].map((chip) => (
              <button key={chip} className="btn-ghost min-h-9 px-3 text-xs tabular-nums" disabled={busy} onClick={() => setAmount(chip)}>
                {chip}
              </button>
            ))}
          </div>
          <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
            {account ? (balance.data !== undefined ? `Balance: ${formatUsdcAmount(balance.data)} USDC` : 'Loading balance…') : 'Connect to see balance'}
          </span>
        </div>
      </div>

      <div className="mt-3">
        <input
          aria-label="Memo"
          className="field min-h-11 w-full px-3 text-sm"
          placeholder="Memo (optional), e.g. invoice 1042"
          value={memo}
          disabled={busy}
          onChange={(event) => setMemo(event.target.value)}
        />
        <div className="mt-1 flex justify-end px-1 text-xs tabular-nums" style={{ color: memoTooLong ? 'var(--danger)' : 'var(--subtle)' }}>
          {memoBytes}/{MAX_MEMO_BYTES}
        </div>
      </div>

      {isConnected ? (
        <button
          className="btn-primary mt-3 min-h-12 w-full text-sm"
          disabled={!valid || busy}
          onClick={() => void send(needsApproval ? 'approve' : 'pay')}
        >
          {busy ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> {label}
            </span>
          ) : (
            label
          )}
        </button>
      ) : (
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button className="btn-primary mt-3 min-h-12 w-full text-sm" onClick={show}>
              Connect wallet to pay
            </button>
          )}
        </ConnectKitButton.Custom>
      )}

      {valid && needsApproval && !busy && (
        <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
          Allow this split to pull exactly {formatUsdcAmount(raw)} USDC, then confirm the payment.
        </p>
      )}
      {balance.data === 0n && (
        <p className="mt-2 text-xs" style={{ color: 'var(--subtle)' }}>
          No USDC in this wallet.{' '}
          <a className="underline" href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--focus)' }}>
            Get test USDC
          </a>
        </p>
      )}
      {lastHash && (
        <a
          className="mt-3 inline-flex items-center gap-1 text-xs"
          style={{ color: 'var(--focus)' }}
          href={txUrl(lastHash)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Last transaction <ExternalLink className="size-3" />
        </a>
      )}
    </section>
  )
}
