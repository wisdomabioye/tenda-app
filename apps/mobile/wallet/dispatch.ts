/**
 * UnsignedTx dispatcher (stage-3 § mobile wallet façade): one entry point
 * that routes a server-built unsigned transaction to the right transport
 * and returns the chain's tx_ref for the client-ping.
 *
 *  - solana-tx   → MWA sign + app-side broadcast (existing Stage-0 path)
 *  - evm-tx      → WalletConnect (Reown) eth_sendTransaction over the connected
 *                  session; feeCurrency passes through for CELO
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
import { sendEvmTransaction } from '@/wallet/adapters/walletconnect'
import { ensureAllowance } from '@/wallet/allowance'
import { useAuthStore } from '@/stores/auth.store'
import { useEscrowStore } from '@/stores/escrow.store'

export class UnsupportedUnsignedTxError extends Error {
  constructor(kind: string, detail: string) {
    super(`cannot sign '${kind}': ${detail}`)
    this.name = 'UnsupportedUnsignedTxError'
  }
}

/**
 * The EVM account this device signs/sends from — the SINGLE resolution both
 * dispatch and the permit flow use, so the permit's `owner` can never
 * diverge from the eventual `msg.sender`. CO3: `from` must be an eip155
 * account — walletAddress is the SOLANA sign-in address and never valid
 * here. Prefer the live EVM login session (evmAddress); fall back to the
 * verified linked EVM wallet.
 */
export function resolveEvmFrom(): string | null {
  const { evmAddress, wallets } = useAuthStore.getState()
  const verified = wallets.filter((w) => w.chain_ns === 'eip155' && w.verified_at !== null)
  const linked = verified.find((w) => w.is_primary) ?? verified[0]
  return evmAddress ?? linked?.address ?? null
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
      const from = resolveEvmFrom()
      if (from === null) {
        throw new Error('no EVM wallet connected — link one in Settings → Wallets first')
      }
      // The server's approval hint: this ERC-20 call transferFroms, so the
      // allowance must cover it BEFORE broadcast (permit-built calls carry
      // no hint — their allowance rides the tx). Ordering lives HERE so
      // every flow (create, publish-draft, dispute) inherits it.
      if (unsigned.approval !== undefined) {
        if (chain_id === undefined) {
          // Silently skipping would broadcast a tx guaranteed to revert.
          throw new UnsupportedUnsignedTxError(
            'evm-tx',
            'the approval hint needs the chain_id to read/set the allowance — pass it (signSendAndReport always does)',
          )
        }
        await ensureAllowance({
          chainId: chain_id,
          token: unsigned.approval.token,
          spender: unsigned.approval.spender,
          amountRaw: unsigned.approval.amount_raw,
          owner: from,
        })
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
