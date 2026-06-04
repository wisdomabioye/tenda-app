/**
 * lib/ws — subprotocol auth parsing, channel parsing/authorization, and
 * the in-process broadcaster (self-healing on dead sockets).
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  WS_AUTH_SUBPROTOCOL,
  authorizeChannel,
  channelName,
  createWsBroadcaster,
  parseChannel,
  parseSubprotocolAuth,
  type WsAuthStore,
  type WsSink,
} from '@server/lib/ws'

// ---------- subprotocol parsing ----------------------------------------------

test('parseSubprotocolAuth extracts the JWT after the marker', () => {
  assert.strictEqual(parseSubprotocolAuth(`${WS_AUTH_SUBPROTOCOL}, eyJ.token.x`), 'eyJ.token.x')
  assert.strictEqual(parseSubprotocolAuth(`other, ${WS_AUTH_SUBPROTOCOL}, tok`), 'tok')
})

test('parseSubprotocolAuth rejects missing/malformed headers', () => {
  assert.strictEqual(parseSubprotocolAuth(undefined), null)
  assert.strictEqual(parseSubprotocolAuth(''), null)
  assert.strictEqual(parseSubprotocolAuth('graphql-ws'), null)
  assert.strictEqual(parseSubprotocolAuth(WS_AUTH_SUBPROTOCOL), null) // marker but no token
})

// ---------- channel parsing -----------------------------------------------------

test('parseChannel handles the three kinds and round-trips via channelName', () => {
  for (const name of ['escrow:abc', 'chat:conv-1', 'user:u-1']) {
    const c = parseChannel(name)
    assert.ok(c !== null)
    assert.strictEqual(channelName(c), name)
  }
})

test('parseChannel rejects unknown kinds and malformed names', () => {
  assert.strictEqual(parseChannel('admin:x'), null)
  assert.strictEqual(parseChannel('escrow:'), null)
  assert.strictEqual(parseChannel(':id'), null)
  assert.strictEqual(parseChannel('no-separator'), null)
  assert.strictEqual(parseChannel(42), null)
})

// ---------- authorization --------------------------------------------------------

function store(opts: { party?: boolean; member?: boolean }): WsAuthStore {
  return {
    async isEscrowParty() {
      return opts.party ?? false
    },
    async isConversationMember() {
      return opts.member ?? false
    },
  }
}

test('user channel: self only', async () => {
  const s = store({})
  assert.strictEqual(await authorizeChannel(s, { kind: 'user', id: 'u-1' }, 'u-1'), true)
  assert.strictEqual(await authorizeChannel(s, { kind: 'user', id: 'u-2' }, 'u-1'), false)
})

test('escrow channel gated on party; chat on membership', async () => {
  assert.strictEqual(
    await authorizeChannel(store({ party: true }), { kind: 'escrow', id: 'e' }, 'u'),
    true,
  )
  assert.strictEqual(
    await authorizeChannel(store({ party: false }), { kind: 'escrow', id: 'e' }, 'u'),
    false,
  )
  assert.strictEqual(
    await authorizeChannel(store({ member: true }), { kind: 'chat', id: 'c' }, 'u'),
    true,
  )
})

// ---------- broadcaster ------------------------------------------------------------

function sink(): WsSink & { received: string[] } {
  const received: string[] = []
  return {
    received,
    send(data) {
      received.push(data)
    },
  }
}

test('broadcast reaches all subscribers of the channel only', () => {
  const b = createWsBroadcaster()
  const a = sink()
  const c = sink()
  const other = sink()
  b.subscribe('escrow:1', a)
  b.subscribe('escrow:1', c)
  b.subscribe('escrow:2', other)

  const sent = b.broadcast('escrow:1', { kind: 'EscrowAccepted' })
  assert.strictEqual(sent, 2)
  assert.deepStrictEqual(JSON.parse(a.received[0]), {
    channel: 'escrow:1',
    kind: 'EscrowAccepted',
  })
  assert.strictEqual(other.received.length, 0)
})

test('unsubscribe + removeSink stop delivery; empty channels are pruned', () => {
  const b = createWsBroadcaster()
  const a = sink()
  b.subscribe('chat:1', a)
  b.subscribe('user:1', a)
  b.unsubscribe('chat:1', a)
  assert.strictEqual(b.broadcast('chat:1', { x: 1 }), 0)
  b.removeSink(a)
  assert.strictEqual(b.broadcast('user:1', { x: 1 }), 0)
})

test('a throwing (dead) sink is dropped and others still receive', () => {
  const b = createWsBroadcaster()
  const dead: WsSink = {
    send() {
      throw new Error('socket closed')
    },
  }
  const live = sink()
  b.subscribe('escrow:1', dead)
  b.subscribe('escrow:1', live)
  const sent = b.broadcast('escrow:1', { kind: 'x' })
  assert.strictEqual(sent, 1)
  // Dead sink evicted — second broadcast reaches only the live one cleanly.
  assert.strictEqual(b.broadcast('escrow:1', { kind: 'y' }), 1)
  assert.strictEqual(live.received.length, 2)
})

test('broadcast to an unknown channel is a 0-recipient no-op', () => {
  const b = createWsBroadcaster()
  assert.strictEqual(b.broadcast('escrow:none', { x: 1 }), 0)
})
