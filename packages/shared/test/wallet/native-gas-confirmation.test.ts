import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createNativeGasConfirmationState, type NativeGasConfirmationState } from '../../src/wallet'

function clientState() {
  let state: NativeGasConfirmationState = createNativeGasConfirmationState(
    update => { state = { ...state, ...update } }, () => state,
  )
  return () => state
}

test('approval resolves consent, clears pending and permits a new request', async () => {
  const get = clientState()
  const first = get().request()
  assert.notEqual(get().pending, null)
  get().settle(true)
  await first
  assert.equal(get().pending, null)
  const next = get().request()
  get().settle(true)
  await next
})

test('cancellation rejects consent and settlement without a pending request is harmless', async () => {
  const get = clientState()
  get().settle(false)
  const pending = get().request()
  const rejected = assert.rejects(pending, { name: 'WalletError', code: 'declined' })
  get().settle(false)
  await rejected
  assert.equal(get().pending, null)
  get().settle(true)
  assert.equal(get().pending, null)
})

test('a concurrent request is refused without replacing the original request', async () => {
  const get = clientState()
  const first = get().request()
  const original = get().pending
  await assert.rejects(get().request(), { name: 'WalletError', code: 'network' })
  assert.equal(get().pending, original)
  get().settle(true)
  await first
})

test('client instances do not share pending state or settlement', async () => {
  const web = clientState()
  const mobile = clientState()
  const webConsent = web().request()
  assert.equal(mobile().pending, null)
  const mobileConsent = mobile().request()
  const rejected = assert.rejects(mobileConsent, { code: 'declined' })
  web().settle(true)
  await webConsent
  assert.notEqual(mobile().pending, null)
  mobile().settle(false)
  await rejected
  assert.equal(web().pending, null)
})
