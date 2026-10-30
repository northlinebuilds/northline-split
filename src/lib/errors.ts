import { BaseError, ContractFunctionRevertedError } from 'viem'

const CONTRACT_ERRORS: Record<string, string> = {
  NothingToRelease: 'Nothing to release yet for this wallet.',
  NotPayee: 'This wallet is not a payee of this split.',
  ZeroAmount: 'Enter an amount greater than zero.',
  MemoTooLong: 'The memo is too long (256 bytes max).',
  UnexpectedTransferAmount: 'USDC did not arrive in full. Nothing was recorded.',
  InvalidShareSum: 'Shares must add up to exactly 100%.',
  DuplicatePayee: 'Each payee address can only appear once.',
  ZeroShare: 'Every payee needs a share above zero.',
  ZeroAddress: 'A payee address is empty.',
  VaultAsPayee: 'A split cannot pay itself.',
  TooManyPayees: 'A split supports at most 10 payees.',
}

export function isUserRejection(error: unknown): boolean {
  const text = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()
  return text.includes('user rejected') || text.includes('user denied') || text.includes('rejected the request')
}

/** Turns a wallet or RPC failure into a short, actionable sentence. */
export function describeError(error: unknown): string {
  if (isUserRejection(error)) return 'Transaction cancelled.'

  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError)
    if (reverted instanceof ContractFunctionRevertedError) {
      const name = reverted.data?.errorName
      if (name && CONTRACT_ERRORS[name]) return CONTRACT_ERRORS[name]
      if (reverted.reason) return `Transaction failed: ${reverted.reason}`
    }
  }

  const message = error instanceof Error ? error.message.toLowerCase() : ''
  for (const [name, text] of Object.entries(CONTRACT_ERRORS)) {
    if (message.includes(name.toLowerCase())) return text
  }
  if (message.includes('insufficient funds') || message.includes('exceeds balance')) {
    return 'Insufficient balance. Add test USDC and try again.'
  }
  if (message.includes('rate limit')) return 'The network is busy. Try again in a moment.'
  if (message.includes('network') || message.includes('timeout')) return 'Network issue. Check your connection and retry.'
  return 'Something went wrong. Please try again.'
}
