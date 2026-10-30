import { useEffect, useMemo, useState } from 'react'
import { NETWORK_LABEL } from '@/lib/network'
import { isAddress, type Address } from 'viem'
import { useAccount, useDeployContract, useWaitForTransactionReceipt } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { ExternalLink, Loader2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { splitVaultAbi, splitVaultBytecode } from '@/lib/splitVaultArtifact'
import { CHAIN_ID, txUrl } from '@/lib/chain'
import { describeError, isUserRejection } from '@/lib/errors'
import { saveSplit } from '@/lib/splits'
import { useEnsureChain } from '@/hooks/useEnsureChain'

const MAX_PAYEES = 10

interface Row {
  id: number
  address: string
  percent: string
}

/** Converts a percent string with up to two decimals into basis points, or null if invalid. */
function toBps(percent: string): number | null {
  if (!/^\d{1,3}(\.\d{1,2})?$|^\d{1,3}\.$/.test(percent)) return null
  const [whole, fraction = ''] = percent.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}

let nextId = 3

export function CreateSplit({ onCreated }: { onCreated: (address: Address) => void }) {
  const { address: account, isConnected } = useAccount()
  const { ensure } = useEnsureChain()
  const [rows, setRows] = useState<Row[]>([
    { id: 1, address: '', percent: '50' },
    { id: 2, address: '', percent: '50' },
  ])

  const { deployContractAsync, data: hash, isPending, reset } = useDeployContract()
  const receipt = useWaitForTransactionReceipt({ hash, chainId: CHAIN_ID })

  const parsed = useMemo(() => {
    const seen = new Set<string>()
    const lines = rows.map((row) => {
      const trimmed = row.address.trim()
      const bps = toBps(row.percent)
      let problem: string | null = null
      if (trimmed && !isAddress(trimmed)) problem = 'Not a valid address'
      else if (trimmed && seen.has(trimmed.toLowerCase())) problem = 'Duplicate address'
      else if (bps === 0) problem = 'Share must be above 0'
      if (trimmed) seen.add(trimmed.toLowerCase())
      return { row, bps, problem, ready: Boolean(trimmed) && !problem && bps !== null && bps > 0 }
    })
    const total = lines.reduce((sum, line) => sum + (line.bps ?? 0), 0)
    return { lines, total, valid: lines.every((line) => line.ready) && total === 10000 }
  }, [rows])

  const update = (id: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const splitEvenly = () => {
    const count = rows.length
    const base = Math.floor(10000 / count)
    const remainder = 10000 - base * count
    setRows((current) =>
      current.map((row, i) => {
        const bps = base + (i === 0 ? remainder : 0)
        return { ...row, percent: (bps / 100).toFixed(2).replace(/\.?0+$/, '') }
      }),
    )
  }

  const deployedAddress = receipt.data?.contractAddress ?? null
  const createdBlock = receipt.data?.blockNumber

  useEffect(() => {
    if (!deployedAddress) return
    saveSplit({ address: deployedAddress, createdBlock: createdBlock?.toString() })
  }, [deployedAddress, createdBlock])

  const submit = async () => {
    if (!parsed.valid) return
    if (!(await ensure())) {
      toast.error(`Switch your wallet to ${NETWORK_LABEL} to continue.`)
      return
    }
    try {
      await deployContractAsync({
        abi: splitVaultAbi,
        bytecode: splitVaultBytecode,
        args: [
          parsed.lines.map((line) => line.row.address.trim() as Address),
          parsed.lines.map((line) => line.bps as number),
        ],
        chainId: CHAIN_ID,
      })
    } catch (error) {
      if (!isUserRejection(error)) toast.error(describeError(error))
    }
  }

  const busy = isPending || receipt.isLoading
  const remaining = 10000 - parsed.total

  if (deployedAddress) {
    return (
      <section className="card p-6">
        <h2 className="display text-xl font-semibold">Split created</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
          Payees and shares are now fixed onchain. Share this address with anyone who should pay in.
        </p>
        <div className="mono mt-4 break-all rounded-2xl p-3 text-xs" style={{ background: 'var(--surface-strong)' }}>
          {deployedAddress}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary min-h-11 px-5 text-sm" onClick={() => onCreated(deployedAddress)}>
            Open split
          </button>
          {hash && (
            <a
              className="btn-ghost inline-flex min-h-11 items-center gap-1.5 px-4 text-sm"
              href={txUrl(hash)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View deployment <ExternalLink className="size-3.5" />
            </a>
          )}
          <button
            className="btn-ghost min-h-11 px-4 text-sm"
            onClick={() => {
              reset()
            }}
          >
            Create another
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="display text-xl font-semibold">Create a split</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Up to {MAX_PAYEES} payees. Shares must total 100% and cannot be changed after deploy.
          </p>
        </div>
        <button className="btn-ghost min-h-11 shrink-0 px-3 text-xs" onClick={splitEvenly} disabled={busy}>
          Split evenly
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {parsed.lines.map(({ row, problem }, index) => (
          <div key={row.id}>
            <div className="flex items-center gap-2">
              <input
                aria-label={`Payee ${index + 1} address`}
                className="field mono min-h-11 min-w-0 flex-1 px-3 text-xs"
                placeholder="0x… payee address"
                value={row.address}
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                onChange={(event) => update(row.id, { address: event.target.value })}
              />
              <div className="relative w-24 shrink-0">
                <input
                  aria-label={`Payee ${index + 1} share in percent`}
                  className="field min-h-11 w-full pl-3 pr-7 text-right text-sm tabular-nums"
                  inputMode="decimal"
                  placeholder="0"
                  value={row.percent}
                  disabled={busy}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === '' || /^\d{0,3}(\.\d{0,2})?$/.test(value)) update(row.id, { percent: value })
                  }}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--subtle)' }}>
                  %
                </span>
              </div>
              <button
                aria-label={`Remove payee ${index + 1}`}
                className="btn-ghost inline-flex size-11 shrink-0 items-center justify-center"
                disabled={rows.length <= 1 || busy}
                onClick={() => setRows((current) => current.filter((r) => r.id !== row.id))}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between px-1 text-xs">
              <span style={{ color: 'var(--danger)' }}>{problem ?? ''}</span>
              {account && !row.address && (
                <button className="underline-offset-2 hover:underline" style={{ color: 'var(--focus)' }} onClick={() => update(row.id, { address: account })}>
                  Use my wallet
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between">
        <button
          className="btn-ghost inline-flex min-h-11 items-center gap-1.5 px-3 text-sm"
          disabled={rows.length >= MAX_PAYEES || busy}
          onClick={() => setRows((current) => [...current, { id: nextId++, address: '', percent: '' }])}
        >
          <Plus className="size-4" /> Add payee
        </button>
        <div className="text-right text-sm tabular-nums">
          <span style={{ color: remaining === 0 ? 'var(--success)' : 'var(--muted)' }}>
            {(parsed.total / 100).toFixed(2)}% of 100%
          </span>
          {remaining !== 0 && (
            <div className="text-xs" style={{ color: 'var(--danger)' }}>
              {remaining > 0 ? `${(remaining / 100).toFixed(2)}% left to assign` : `${(-remaining / 100).toFixed(2)}% over`}
            </div>
          )}
        </div>
      </div>

      {isConnected ? (
        <button className="btn-primary mt-5 min-h-12 w-full text-sm" disabled={!parsed.valid || busy} onClick={() => void submit()}>
          {isPending ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Confirm in wallet…
            </span>
          ) : receipt.isLoading ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin" /> Deploying…
            </span>
          ) : (
            'Create split'
          )}
        </button>
      ) : (
        <ConnectKitButton.Custom>
          {({ show }) => (
            <button className="btn-primary mt-5 min-h-12 w-full text-sm" onClick={show}>
              Connect wallet to create
            </button>
          )}
        </ConnectKitButton.Custom>
      )}
      {receipt.isError && (
        <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          The deployment could not be confirmed. Check your wallet and try again.
        </p>
      )}
    </section>
  )
}
