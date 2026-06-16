/**
 * UnsignedTx dispatcher (stage-3 § mobile wallet façade): one entry point
 * that routes a server-built unsigned transaction to the right transport
 * and returns the chain's tx_ref for the client-ping.
 *
 *  - solana-tx   → MWA sign + app-side broadcast (existing Stage-0 path)
 *  - evm-tx      → MetaMask connect-evm eth_sendTransaction (W2 transport;
 *                  feeCurrency passes through for CELO)
 *  - evm-userop  → BLOCKED on #47: signing a sponsored UserOperation needs
 *                  the bundler endpoint (Coinbase) to resolve nonce/gas and
 *                  accept eth_sendUserOperation. The server only emits this
 *                  kind once the paymaster env exists, so the typed error
 *                  below is unreachable until then — and loud if reached.
 */

import { VersionedTransaction } from '@solana/web3.js'
import { Buffer } from 'buffer'
import type { EscrowTxType, UnsignedTx } from '@tenda/shared'
import { signAndSendStored } from '@/wallet/adapters/solana-mwa'
import { sendEvmTransaction } from '@/wallet/adapters/metamask'
import { useAuthStore } from '@/stores/auth.store'
import { useEscrowStore } from '@/stores/escrow.store'

export class UnsupportedUnsignedTxError extends Error {
  constructor(kind: string, detail: string) {
    super(`cannot sign '${kind}': ${detail}`)
    this.name = 'UnsupportedUnsignedTxError'
  }
}

/** Sign + broadcast a server-built unsigned tx. Returns the tx_ref. */
export async function signAndSendUnsignedTx(unsigned: UnsignedTx, chain_id?: string): Promise<string> {
  switch (unsigned.kind) {
    case 'solana-tx': {
      // The MWA adapter owns its session token (AsyncStorage) — single source
      // of truth, no auth-store round-trip.
      const tx = VersionedTransaction.deserialize(Buffer.from(unsigned.tx_base64, 'base64'))
      return signAndSendStored(tx)
    }
    case 'evm-tx': {
      // CO3: `from` must be an eip155 account — walletAddress is the
      // SOLANA sign-in address and never valid here. Prefer the live EVM
      // login session (evmAddress); fall back to the verified linked EVM wallet.
      const { evmAddress, wallets } = useAuthStore.getState()
      const verified = wallets.filter((w) => w.chain_ns === 'eip155' && w.verified_at !== null)
      const linked = verified.find((w) => w.is_primary) ?? verified[0]
      const from = evmAddress ?? linked?.address ?? null
      if (from === null) {
        throw new Error('no EVM wallet connected — link one in Settings → Wallets first')
      }
      return sendEvmTransaction({
        from,
        to: unsigned.to,
        data: unsigned.data,
        value: unsigned.value,
        ...(chain_id !== undefined ? { chainId: chain_id } : {}),
        ...(unsigned.fee_currency !== undefined ? { feeCurrency: unsigned.fee_currency } : {}),
      })
    }
    case 'evm-userop':
      throw new UnsupportedUnsignedTxError(
        'evm-userop',
        'sponsored UserOperation signing lands with the bundler config (#47); ' +
          'the server only emits this kind once COINBASE_PAYMASTER_URL is set',
      )
  }
}

/**
 * The full client leg in one call: sign + broadcast, then client-ping so
 * the server's verify pipeline takes over (deferred on network failure —
 * the pending-sync queue replays it).
 */
export async function signSendAndReport(args: {
  unsigned: UnsignedTx
  action: EscrowTxType
  chain_id: string
  escrow_id?: string
}): Promise<string> {
  const tx_ref = await signAndSendUnsignedTx(args.unsigned, args.chain_id)
  await useEscrowStore.getState().reportTx({
    tx_ref,
    action: args.action,
    chain_id: args.chain_id,
    ...(args.escrow_id !== undefined ? { escrow_id: args.escrow_id } : {}),
  })
  return tx_ref
}
