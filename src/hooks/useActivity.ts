import { useCallback, useEffect, useRef, useState } from 'react'
import { usePublicClient } from 'wagmi'
import { parseAbiItem, type Address, type PublicClient } from 'viem'
import { CHAIN_ID } from '@/lib/chain'

const paidEvent = parseAbiItem('event Paid(address indexed payer, uint256 amount, string memo)')
const releasedEvent = parseAbiItem('event Released(address indexed payee, uint256 amount)')

export interface ActivityItem {
  id: string
  kind: 'paid' | 'released'
  actor: Address
  amount: bigint
  memo?: string
  txHash: `0x${string}`
  blockNumber: bigint
  logIndex: number
}

/** The RPC rejects wide log queries, so history is read in fixed block windows. */
const CHUNK = 2000n
const CHUNKS_PER_PAGE = 10n
const POLL_MS = 5000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function fetchChunk(client: PublicClient, vault: Address, fromBlock: bigint, toBlock: bigint) {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const logs = await client.getLogs({ address: vault, events: [paidEvent, releasedEvent], fromBlock, toBlock })
      const items: ActivityItem[] = []
      for (const log of logs) {
        if (log.blockNumber === null || log.logIndex === null || log.transactionHash === null) continue
        const id = `${log.transactionHash}:${log.logIndex}`
        if (log.eventName === 'Paid') {
          items.push({
            id,
            kind: 'paid',
            actor: log.args.payer as Address,
            amount: log.args.amount as bigint,
            memo: log.args.memo,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
          })
        } else {
          items.push({
            id,
            kind: 'released',
            actor: log.args.payee as Address,
            amount: log.args.amount as bigint,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            logIndex: log.logIndex,
          })
        }
      }
      return items
    } catch (error) {
      lastError = error
      await sleep(600 * (attempt + 1))
    }
  }
  throw lastError
}

function merge(current: ActivityItem[], incoming: ActivityItem[]): ActivityItem[] {
  const byId = new Map(current.map((item) => [item.id, item]))
  for (const item of incoming) byId.set(item.id, item)
  return [...byId.values()].sort((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber > b.blockNumber ? -1 : 1,
  )
}

export interface ActivityState {
  items: ActivityItem[]
  /** Lowest block scanned so far. */
  oldestBlock: bigint | null
  /** Chain head at the last poll. */
  headBlock: bigint | null
  /** True once the scan has reached the block the split was created in. */
  reachedStart: boolean
  loading: boolean
  error: string | null
  loadOlder: () => void
  retry: () => void
}

/**
 * Live Paid and Released feed. Starts from the chain head (never block 0), reads a bounded
 * window back from it, and polls forward. Older history is loaded on demand. When the
 * creation block is known the scan stops there.
 */
export function useActivity(vault: Address | undefined, startBlock: bigint | undefined, onNewEvents?: () => void): ActivityState {
  const client = usePublicClient({ chainId: CHAIN_ID })
  const [items, setItems] = useState<ActivityItem[]>([])
  const [oldestBlock, setOldestBlock] = useState<bigint | null>(null)
  const [headBlock, setHeadBlock] = useState<bigint | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const generation = useRef(0)
  const busy = useRef(false)
  const newest = useRef<bigint | null>(null)
  const oldest = useRef<bigint | null>(null)
  const notify = useRef(onNewEvents)
  useEffect(() => {
    notify.current = onNewEvents
  }, [onNewEvents])

  const floor = startBlock ?? 0n

  /** Scans [from, to] newest chunk first so recent activity appears immediately. */
  const scan = useCallback(
    async (from: bigint, to: bigint, gen: number): Promise<ActivityItem[]> => {
      if (!client || !vault) return []
      const found: ActivityItem[] = []
      let cursor = to
      while (cursor >= from) {
        const chunkFrom = cursor - CHUNK + 1n > from ? cursor - CHUNK + 1n : from
        const chunk = await fetchChunk(client, vault, chunkFrom, cursor)
        if (gen !== generation.current) return found
        found.push(...chunk)
        if (chunk.length > 0) setItems((current) => merge(current, chunk))
        cursor = chunkFrom - 1n
        if (cursor >= from) await sleep(120)
      }
      return found
    },
    [client, vault],
  )

  // Initial window, then forward polling.
  useEffect(() => {
    if (!client || !vault) return
    const gen = ++generation.current
    const invalidate = () => {
      generation.current++
      busy.current = false
    }
    newest.current = null
    oldest.current = null

    const run = async () => {
      busy.current = true
      setLoading(true)
      try {
        const head = await client.getBlockNumber()
        if (gen !== generation.current) return
        setHeadBlock(head)
        const windowStart = head - CHUNK * CHUNKS_PER_PAGE + 1n
        const from = windowStart > floor ? windowStart : floor
        newest.current = head
        oldest.current = from
        setOldestBlock(from)
        await scan(from, head, gen)
      } catch {
        if (gen === generation.current) setError('Activity could not be loaded from the network.')
      } finally {
        if (gen === generation.current) {
          busy.current = false
          setLoading(false)
        }
      }
    }
    void run()

    const timer = setInterval(() => {
      if (busy.current || newest.current === null) return
      void (async () => {
        busy.current = true
        try {
          const head = await client.getBlockNumber()
          if (gen !== generation.current || newest.current === null) return
          setHeadBlock(head)
          if (head > newest.current) {
            const found = await scan(newest.current + 1n, head, gen)
            if (gen !== generation.current) return
            newest.current = head
            if (found.length > 0) notify.current?.()
          }
        } catch {
          // A missed poll is retried on the next tick.
        } finally {
          if (gen === generation.current) busy.current = false
        }
      })()
    }, POLL_MS)

    return () => {
      clearInterval(timer)
      invalidate()
    }
  }, [client, vault, floor, scan, nonce])

  const loadOlder = useCallback(() => {
    const gen = generation.current
    const current = oldest.current
    if (busy.current || current === null || current <= floor) return
    void (async () => {
      busy.current = true
      setLoading(true)
      setError(null)
      try {
        const windowStart = current - CHUNK * CHUNKS_PER_PAGE
        const from = windowStart > floor ? windowStart : floor
        await scan(from, current - 1n, gen)
        if (gen !== generation.current) return
        oldest.current = from
        setOldestBlock(from)
      } catch {
        if (gen === generation.current) setError('Older activity could not be loaded.')
      } finally {
        if (gen === generation.current) {
          busy.current = false
          setLoading(false)
        }
      }
    })()
  }, [floor, scan])

  const retry = useCallback(() => {
    setError(null)
    setNonce((n) => n + 1)
  }, [])

  return {
    items,
    oldestBlock,
    headBlock,
    reachedStart: startBlock !== undefined && oldestBlock !== null && oldestBlock <= startBlock,
    loading,
    error,
    loadOlder,
    retry,
  }
}
