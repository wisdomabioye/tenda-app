/**
 * WebSocket plugin (stage-2-listeners.md): registers @fastify/websocket
 * and decorates the in-process broadcaster. The verify-tx worker wiring
 * (#33) publishes escrow events through `fastify.wsBroadcast`; the chat
 * routes publish messages the same way.
 */

import fp from 'fastify-plugin'
import websocket from '@fastify/websocket'
import type { FastifyPluginAsync } from 'fastify'
import { WS_AUTH_SUBPROTOCOL, createWsBroadcaster } from '@server/lib/ws'

const websocketPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket, {
    options: {
      // Browsers ABORT the connection when they request subprotocols and
      // the server's handshake response doesn't select one, echo the auth
      // marker back when offered (the JWT rides as a second "protocol" and
      // must not be echoed).
      handleProtocols(protocols: Set<string>) {
        return protocols.has(WS_AUTH_SUBPROTOCOL) ? WS_AUTH_SUBPROTOCOL : false
      },
    },
  })
  fastify.decorate('wsBroadcast', createWsBroadcaster())
}

export default fp(websocketPlugin, { name: 'websocket' })
