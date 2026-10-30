import { useCallback, useEffect, useState } from 'react'
import { isAddress, type Address } from 'viem'
import { Header } from '@/components/Header'
import { CreateSplit } from '@/components/CreateSplit'
import { OpenSplit } from '@/components/OpenSplit'
import { SplitView } from '@/components/SplitView'

function readSplitFromUrl(): Address | null {
  const value = new URLSearchParams(window.location.search).get('split')
  return value && isAddress(value) ? (value) : null
}

const STEPS = [
  { title: 'Set the shares', text: 'List up to 10 payees and their percentages. They are fixed at deploy.' },
  { title: 'Collect USDC', text: 'Anyone can pay in with a memo. Every payment is logged onchain.' },
  { title: 'Release on demand', text: 'Each payee withdraws their own share whenever they like.' },
]

export default function App() {
  const [vault, setVault] = useState<Address | null>(readSplitFromUrl)

  useEffect(() => {
    const onPop = () => setVault(readSplitFromUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const open = useCallback((address: Address) => {
    history.pushState(null, '', `/?split=${address}`)
    setVault(address)
    window.scrollTo({ top: 0 })
  }, [])

  const close = useCallback(() => {
    history.pushState(null, '', '/')
    setVault(null)
  }, [])

  return (
    <div className="min-h-dvh">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 pb-24 sm:px-6">
        {vault ? (
          <SplitView key={vault} address={vault} onBack={close} />
        ) : (
          <>
            <section className="pb-8 pt-4 sm:pt-8">
              <h1 className="display max-w-2xl text-balance text-4xl font-bold sm:text-5xl">Share revenue the moment it lands.</h1>
              <p className="mt-3 max-w-xl text-pretty" style={{ color: 'var(--muted)' }}>
                A split is a small immutable contract that collects USDC and lets each payee pull their share. No owner, no admin, no
                withdraw switch.
              </p>
            </section>

            <div className="grid gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
              <CreateSplit onCreated={open} />
              <OpenSplit onOpen={open} />
            </div>

            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-2xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="mono text-xs" style={{ color: 'var(--subtle)' }}>
                    0{index + 1}
                  </div>
                  <div className="display mt-1 text-base font-semibold">{step.title}</div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </>
        )}
      </main>
    </div>
  )
}
