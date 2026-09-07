/**
 * The RELAY_UNAVAILABLE body (#132), both branches.
 *
 * The integration suite proves the branch a deployment with one relay-capable
 * chain produces (the EVM fake). It cannot reach the other: every harness app
 * carries that fake, so "this deployment can relay on no chain" never runs
 * there — and it is the answer a real deployment configured without relayer
 * keys gives. The message is pure so this can hold both.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { apiRoutes } from '@tenda/shared'
import { relayUnavailableMessage } from '@server/features/escrows/funding/relayDraftFunding'

test('names the failing chain, every chain that CAN relay, and the registry field to read', () => {
  const message = relayUnavailableMessage('solana:devnet', ['eip155:84532', 'eip155:16602'])
  assert.match(message, /^relayed funding is not available on solana:devnet: this deployment holds no relayer for it\. /)
  assert.match(message, /Chains it can relay on: eip155:84532, eip155:16602/)
  assert.ok(message.includes(`relayed_funding_available in GET ${apiRoutes.platform.chains}`))
})

test('with no relay-capable chain at all it says so — never an empty list, and still points at the registry', () => {
  const message = relayUnavailableMessage('solana:devnet', [])
  assert.match(message, /It can relay on no chain/)
  assert.doesNotMatch(message, /Chains it can relay on:/)
  assert.ok(message.includes(`relayed_funding_available in GET ${apiRoutes.platform.chains}`))
})

test('the failing chain is never listed among the chains it can relay on', () => {
  // The caller filters on `relay !== undefined`, and the failing chain has
  // none — so a message that named it would mean the list was built from the
  // wrong source. Pinned here as the contract the caller relies on.
  const message = relayUnavailableMessage('solana:devnet', ['eip155:84532'])
  assert.doesNotMatch(message, /Chains it can relay on:.*solana:devnet/)
})
