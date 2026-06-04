/**
 * Listener boot plugin (stage-2-listeners.md § plugins/listeners.ts).
 *
 * LISTENER_PROVIDER:
 *   - 'helius' (default): push-based — the webhook route is the intake;
 *     nothing to start here.
 *   - 'polling': self-hosted fallback — starts the chain_cursors-driven
 *     polling loop and stops it on shutdown. Flip the env to fail open
 *     during a Helius outage (stage-2 risk table).
 */

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { getConfig } from '@server/config'
import { createSolanaRpc } from '@server/chains/solana/rpc'
import {
  createSolanaPollingListener,
  drizzleCursorStore,
} from '@server/chains/solana/listener-polling'

const listenersPlugin: FastifyPluginAsync = async (fastify) => {
  const config = getConfig()
  if (config.LISTENER_PROVIDER !== 'polling') return

  const solana = fastify.chains.list().find((a) => a.namespace === 'solana')
  if (solana === undefined) {
    fastify.log.warn({}, 'polling listener: no solana adapter registered — not started')
    return
  }

  const listener = createSolanaPollingListener({
    rpc: createSolanaRpc({ rpc_url: config.SOLANA_RPC_URL, chain_id: solana.chain_id }),
    chain_id: solana.chain_id,
    cursors: drizzleCursorStore(fastify.db),
    queue: fastify.queue,
    log: fastify.log,
  })

  fastify.addHook('onReady', async () => listener.start())
  fastify.addHook('onClose', async () => listener.stop())
}

export default fp(listenersPlugin, { name: 'listeners', dependencies: ['db', 'chains'] })
