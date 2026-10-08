import { test } from 'node:test'
import assert from 'node:assert/strict'
import { networkFeeNote, NATIVE_GAS_COPY } from '../../src/wallet'

test('fee disclosure follows the manifest fee asset, not all EVM chains', () => {
  assert.equal(networkFeeNote('eip155:42220'), NATIVE_GAS_COPY.feeNote)
  for (const chain of [undefined, 'unknown', 'eip155:84532']) assert.equal(networkFeeNote(chain), undefined)
})
