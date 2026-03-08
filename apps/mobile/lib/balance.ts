import { PublicKey } from '@solana/web3.js'
import { getBalance } from '@/wallet'

export interface BalanceCheckResult {
  sufficient: boolean
  balance: bigint
}

export async function checkBalance(
  walletAddress: string,
  required: bigint,
): Promise<BalanceCheckResult> {
  const balance = BigInt(await getBalance(new PublicKey(walletAddress)))
  return { sufficient: balance >= required, balance }
}
