/**
 * The relayer hot-wallet secret (#18) on both namespaces — split from
 * secrets.test.ts, which sits at the 300-line ceiling, rather than grown into
 * it. Same fixtures: the minimal env that activates exactly one chain.
 */
import { test } from 'node:test'
import * as assert from 'node:assert'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import { loadChainSecrets } from '@server/chains/secrets'

const SOL_PUBKEY = '7H6AAoghUCPAVA1WTEwpSmkiRfPHWrgFidZQPzbXzkes'
const EVM_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

function solanaDevnetEnv(): NodeJS.ProcessEnv {
  return {
    CHAIN_SOLANA_DEVNET_RPC_URL: 'https://api.devnet.solana.com',
    CHAIN_SOLANA_DEVNET_TREASURY_ADDR: SOL_PUBKEY,
  }
}

function baseMainnetEnv(): NodeJS.ProcessEnv {
  return {
    CHAIN_EIP155_8453_RPC_URL: 'https://base-sepolia.example/v2/key',
    CHAIN_EIP155_8453_ESCROW_ADDR: EVM_ADDR,
    CHAIN_EIP155_8453_TREASURY_ADDR: EVM_ADDR,
  }
}

test('relayerKey (#18): an EVM key is captured when well-formed, refused by name when not', () => {
  const key = `0x${'ab'.repeat(32)}`
  const ok = loadChainSecrets({ ...baseMainnetEnv(), CHAIN_EIP155_8453_RELAYER_KEY: key })
  const secret = ok.get('eip155:8453')
  assert.equal(secret?.namespace === 'eip155' ? secret.relayerKey : undefined, key)
  // Absent → undefined, the adapter then offers no relay surface.
  const none = loadChainSecrets(baseMainnetEnv()).get('eip155:8453')
  assert.equal(none?.namespace === 'eip155' ? none.relayerKey : 'wrong-ns', undefined)
  // An address, a short key, a missing 0x: each is a boot error naming the key.
  for (const bad of [EVM_ADDR, `0x${'ab'.repeat(31)}`, 'ab'.repeat(32)]) {
    assert.throws(
      () => loadChainSecrets({ ...baseMainnetEnv(), CHAIN_EIP155_8453_RELAYER_KEY: bad }),
      /CHAIN_EIP155_8453_RELAYER_KEY/,
    )
  }
})

test('relayerKey (#18): the Solana key rides the solana shape when it is a 64-byte base58 secret, and is refused by name otherwise', () => {
  const key = bs58.encode(Keypair.generate().secretKey)
  const secret = loadChainSecrets({ ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_RELAYER_KEY: key }).get('solana:devnet')
  assert.equal(secret?.namespace === 'solana' ? secret.relayerKey : undefined, key)
  // A public key (32 bytes), a 0x key, free text, and a 63-byte key whose base58
  // LENGTH looks right (87 chars) are each a boot error naming the key.
  const sixtyThreeBytes = bs58.encode(new Uint8Array(63).fill(255))
  for (const bad of [SOL_PUBKEY, `0x${'ab'.repeat(32)}`, 'base58secret', sixtyThreeBytes]) {
    assert.throws(
      () => loadChainSecrets({ ...solanaDevnetEnv(), CHAIN_SOLANA_DEVNET_RELAYER_KEY: bad }),
      /CHAIN_SOLANA_DEVNET_RELAYER_KEY/,
    )
  }
})
