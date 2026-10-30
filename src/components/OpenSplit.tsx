import { useState } from 'react'
import { isAddress, type Address } from 'viem'
import { ArrowRight } from 'lucide-react'
import { listSavedSplits } from '@/lib/splits'
import { shortAddress } from '@/lib/chain'

export function OpenSplit({ onOpen }: { onOpen: (address: Address) => void }) {
  const [value, setValue] = useState('')
  const saved = listSavedSplits()
  const trimmed = value.trim()
  const valid = isAddress(trimmed)

  return (
    <section className="card p-6">
      <h2 className="display text-xl font-semibold">Open a split</h2>
      <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
        Paste a split address to pay into it, check balances, or release your share.
      </p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (valid) onOpen(trimmed)
        }}
      >
        <input
          aria-label="Split address"
          className="field mono min-h-11 min-w-0 flex-1 px-3 text-xs"
          placeholder="0x… split address"
          value={value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="submit" className="btn-primary inline-flex min-h-11 items-center gap-1.5 px-4 text-sm" disabled={!valid}>
          Open <ArrowRight className="size-4" />
        </button>
      </form>
      {trimmed && !valid && (
        <p className="mt-2 text-xs" style={{ color: 'var(--danger)' }}>
          That is not a valid address.
        </p>
      )}

      {saved.length > 0 && (
        <div className="mt-6">
          <div className="text-xs font-semibold uppercase" style={{ color: 'var(--subtle)', letterSpacing: '0.08em' }}>
            Recent splits on this device
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {saved.map((item) => (
              <button key={item.address} className="btn-ghost mono min-h-11 px-3 text-xs" onClick={() => onOpen(item.address)}>
                {shortAddress(item.address)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
