import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rejectsFeeCurrency, WalletError } from '../../src/wallet'

const message = 'Invalid params feeCurrency - Expected a value of type `never`, but received: `"0xAdapter"`'

test('accepts explicit schema rejections as Error or plain provider objects', () => {
  assert.equal(rejectsFeeCurrency(new Error(message)), true)
  assert.equal(rejectsFeeCurrency({ message }), true)
  assert.equal(rejectsFeeCurrency({ message: message.toUpperCase() }), true)
})

test('rejects malformed, unrelated and partially matching errors', () => {
  for (const error of [null, undefined, 'error', 42, {}, { message: 42 },
    new Error('timeout'), new Error('execution reverted'),
    new Error('Invalid params feeCurrency: invalid address'),
    new Error('Expected a value of type `never`'),
    new Error(message.replace('feeCurrency', 'feeCurrencyOther')),
    new Error(message.replace('never', 'nevermore'))]) {
    assert.equal(rejectsFeeCurrency(error), false)
  }
})

test('user rejection and guarded application failures never permit retry', () => {
  assert.equal(rejectsFeeCurrency({ code: 4001, message }), false)
  assert.equal(rejectsFeeCurrency(new WalletError('declined', message)), false)
  assert.equal(rejectsFeeCurrency(new WalletError('timeout', message)), false)
  assert.equal(rejectsFeeCurrency(new WalletError('network', message)), false)
})
