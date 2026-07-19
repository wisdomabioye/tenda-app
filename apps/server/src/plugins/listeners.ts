/**
 * Listener boot plugin (stage-2-listeners.md § plugins/listeners.ts).
 *
 * Provider is INFERRED per chain from its secrets, not a separate env:
 *   - WEBHOOK_SECRET set  → push intake (Helius for Solana, Alchemy for EVM):
 *     the webhook route is the intake; nothing to start here.
 *   - WEBHOOK_SECRET unset → self-hosted polling fallback: start the
 *     chain_cursors-driven loop and stop it on shutdown. To fail open during
 *     a provider outage, unset the chain's WEBHOOK_SECRET (stage-2 risk table).
 *
 * The same rule covers every namespace, so a chain graduates from polling to
 * push by setting one secret — no code change.
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { chainById } from '@tenda/shared'
import { getChainSecrets, solanaSecret } from '@server/chains/secrets'
import { drizzleCursorStore } from '@server/chains/cursors'
import { createSolanaRpc } from '@server/chains/solana/rpc'
import { createSolanaPollingListener } from '@server/chains/solana/listener-polling'
import { createEvmRpc } from '@server/chains/evm/rpc'
import {
  createEvmPollingListener,
  EVM_LISTENER_RPC_TIMEOUT_MS,
} from '@server/chains/evm/listener-polling'
import type { ChainListener } from '@server/chains/types'

const listenersPlugin: FastifyPluginAsync = async (fastify) => {
  const listeners: ChainListener[] = []

  const solana = solanaSecret()
  if (solana !== undefined && solana.webhookSecret === undefined) {
    const adapter = fastify.chains.list().find((a) => a.namespace === 'solana')
    if (adapter === undefined) {
      fastify.log.warn({}, 'polling listener: no solana adapter registered, not started')
    } else {
      listeners.push(
        createSolanaPollingListener({
          rpc: createSolanaRpc({ rpc_url: solana.rpcUrl, chain_id: adapter.chain_id }),
          chain_id: adapter.chain_id,
          cursors: drizzleCursorStore(fastify.db),
          queue: fastify.queue,
          log: fastify.log,
        }),
      )
    }
  }

  for (const secret of getChainSecrets().values()) {
    if (secret.namespace !== 'eip155' || secret.webhookSecret !== undefined) continue
    if (!fastify.chains.has(secret.chainId)) {
      fastify.log.warn(
        { chain_id: secret.chainId },
        'polling listener: no adapter registered for configured EVM chain, not started',
      )
      continue
    }
    if (secret.escrowDeployBlock === undefined) {
      // Loud, once at boot: without the deploy block a FIRST run only
      // backfills the recency window; older escrow events stay unscanned.
      fastify.log.warn(
        { chain_id: secret.chainId },
        'polling listener: ESCROW_DEPLOY_BLOCK unset, first-run backfill limited to the recency window',
      )
    }
    listeners.push(
      createEvmPollingListener({
        rpc: createEvmRpc({
          rpc_url: secret.rpcUrl,
          ...(secret.rpcUrlFallback !== undefined ? { rpc_url_fallback: secret.rpcUrlFallback } : {}),
          // Background poller: relaxed per-endpoint budget, not the
          // interactive tx-build one (see the constant's rationale).
          timeout_ms: EVM_LISTENER_RPC_TIMEOUT_MS,
        }),
        chain_id: secret.chainId,
        escrow_contract: secret.escrow as `0x${string}`,
        ...(secret.escrowDeployBlock !== undefined ? { deploy_block: secret.escrowDeployBlock } : {}),
        min_confirmations: chainById(secret.chainId).minConfirmations,
        cursors: drizzleCursorStore(fastify.db),
        queue: fastify.queue,
        log: fastify.log,
      }),
    )
  }

  if (listeners.length === 0) return
  fastify.addHook('onReady', async () => {
    for (const listener of listeners) await listener.start()
  })
  fastify.addHook('onClose', async () => {
    for (const listener of listeners) await listener.stop()
  })
}

export default fp(listenersPlugin, { name: 'listeners', dependencies: ['db', 'chains', 'queue'] })
