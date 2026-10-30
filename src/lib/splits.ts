import { isAddress, type Address } from 'viem'

const KEY = 'northline.splits.v1'

export interface SavedSplit {
  address: Address
  /** Block of the creating transaction when this browser created the split. */
  createdBlock?: string
}

function read(): SavedSplit[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is SavedSplit =>
        typeof item === 'object' && item !== null && 'address' in item && isAddress(String((item as SavedSplit).address)),
    )
  } catch {
    return []
  }
}

export function listSavedSplits(): SavedSplit[] {
  return read()
}

export function getSavedSplit(address: string): SavedSplit | undefined {
  return read().find((item) => item.address.toLowerCase() === address.toLowerCase())
}

export function saveSplit(entry: SavedSplit): void {
  const rest = read().filter((item) => item.address.toLowerCase() !== entry.address.toLowerCase())
  const existing = getSavedSplit(entry.address)
  const next = [{ ...existing, ...entry }, ...rest].slice(0, 6)
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // Storage can be unavailable in embedded previews; the app works without it.
  }
}
