/**
 * Listener boot plugin (stage-2-listeners.md § plugins/listeners.ts).
 *
 * Provider is INFERRED from the Solana chain's secrets, not a separate env:
 *   - WEBHOOK_SECRET set  → Helius push: the webhook route is the intake;
 *     nothing to start here.
 *   - WEBHOOK_SECRET unset → self-hosted polling fallback: start the
 *     chain_cursors-driven loop and stop it on shutdown. To fail open during a
 *     Helius outage, unset the chain's WEBHOOK_SECRET (stage-2 risk table).
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { solanaSecret } from '@server/chains/secrets'
import { createSolanaRpc } from '@server/chains/solana/rpc'
import {
  createSolanaPollingListener,
  drizzleCursorStore,
} from '@server/chains/solana/listener-polling'

const listenersPlugin: FastifyPluginAsync = async (fastify) => {
  const solana = solanaSecret()
  // No Solana chain, or Helius push configured → nothing to poll.
  if (solana === undefined || solana.webhookSecret !== undefined) return

  const adapter = fastify.chains.list().find((a) => a.namespace === 'solana')
  if (adapter === undefined) {
    fastify.log.warn({}, 'polling listener: no solana adapter registered — not started')
    return
  }

  const listener = createSolanaPollingListener({
    rpc: createSolanaRpc({ rpc_url: solana.rpcUrl, chain_id: adapter.chain_id }),
    chain_id: adapter.chain_id,
    cursors: drizzleCursorStore(fastify.db),
    queue: fastify.queue,
    log: fastify.log,
  })

  fastify.addHook('onReady', async () => listener.start())
  fastify.addHook('onClose', async () => listener.stop())
}

export default fp(listenersPlugin, { name: 'listeners', dependencies: ['db', 'chains'] })
