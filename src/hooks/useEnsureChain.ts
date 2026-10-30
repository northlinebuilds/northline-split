import { useAccount, useSwitchChain } from 'wagmi'
import { CHAIN_ID } from '@/lib/chain'

/** Guards writes: resolves true once the wallet is on the configured Arc network, switching it when needed. */
export function useEnsureChain() {
  const { chainId, isConnected } = useAccount()
  const { switchChainAsync, isPending } = useSwitchChain()

  const ensure = async (): Promise<boolean> => {
    if (chainId === CHAIN_ID) return true
    try {
      await switchChainAsync({ chainId: CHAIN_ID })
      return true
    } catch {
      return false
    }
  }

  return { ensure, wrongChain: isConnected && chainId !== CHAIN_ID, switching: isPending }
}
