import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CHAIN_MANIFEST,
  chainById,
  findChain,
  gigAssetByChain,
  feeCurrencyAddress,
  isNativeAsset,
  assertManifestValid,
  type ChainManifestEntry,
} from '../../src/chains/manifest'
import { ASSET_META, GIG_ASSET_BY_CHAIN } from '../../src/constants/assets'

// The manifest is a hand-maintained data table that the server registry,
// seeder, sponsor, and webhooks all key off — these invariants are what keep
// those consumers correct as chains are added. (The module also self-checks a
// subset at import; importing it here is itself coverage of that guard.)

test('manifest is non-empty and every id is unique', () => {
  assert.ok(CHAIN_MANIFEST.length > 0)
  const ids = CHAIN_MANIFEST.map((c) => c.id)
  assert.equal(new Set(ids).size, ids.length, 'duplicate chain id in manifest')
})

test('every asset id resolves in ASSET_META', () => {
  for (const entry of CHAIN_MANIFEST) {
    for (const asset of entry.assets) {
      assert.ok(ASSET_META[asset.id] !== undefined, `${asset.id} on ${entry.id} missing from ASSET_META`)
    }
  }
})

test('each chain has exactly one native asset (token null, no fromSecret)', () => {
  for (const entry of CHAIN_MANIFEST) {
    const natives = entry.assets.filter(isNativeAsset)
    assert.equal(natives.length, 1, `${entry.id} must have exactly one native asset, found ${natives.length}`)
  }
})

test('fromSecret assets are not counted native and have null manifest token', () => {
  for (const entry of CHAIN_MANIFEST) {
    for (const asset of entry.assets) {
      if (asset.fromSecret !== undefined) {
        assert.equal(asset.token, null, `${asset.id}: fromSecret asset must not also hardcode a token`)
        assert.equal(isNativeAsset(asset), false, `${asset.id}: secret-sourced asset is not native`)
      }
    }
  }
})

test('at most one gig asset per chain', () => {
  for (const entry of CHAIN_MANIFEST) {
    const gigs = entry.assets.filter((a) => a.role === 'gig')
    assert.ok(gigs.length <= 1, `${entry.id} has ${gigs.length} gig assets`)
  }
})

test('feeCurrency is set iff gasPolicy is feeCurrency, and resolves an address', () => {
  for (const entry of CHAIN_MANIFEST) {
    assert.equal(
      entry.feeCurrency !== undefined,
      entry.gasPolicy === 'feeCurrency',
      `${entry.id}: feeCurrency/gasPolicy mismatch`,
    )
    if (entry.feeCurrency !== undefined) {
      assert.ok(feeCurrencyAddress(entry) !== null, `${entry.id}: feeCurrency has no address`)
    } else {
      assert.equal(feeCurrencyAddress(entry), null)
    }
  }
})

test('EVM token addresses are 0x-prefixed 40-hex; native tokens are null', () => {
  for (const entry of CHAIN_MANIFEST) {
    if (entry.namespace !== 'eip155') continue
    for (const asset of entry.assets) {
      if (asset.token === null) continue
      assert.match(asset.token, /^0x[0-9a-fA-F]{40}$/, `${asset.id} on ${entry.id} is not a valid EVM address`)
    }
  }
})

test('namespace and gasPolicy are from the supported sets', () => {
  const policies = new Set(['native-seed', 'paymaster', 'feeCurrency', 'none'])
  for (const entry of CHAIN_MANIFEST) {
    assert.ok(entry.namespace === 'solana' || entry.namespace === 'eip155', `bad namespace on ${entry.id}`)
    assert.ok(policies.has(entry.gasPolicy), `bad gasPolicy on ${entry.id}`)
    assert.ok(entry.family.length > 0, `empty family on ${entry.id}`)
  }
})

test('chainById returns the entry for a known id and throws on unknown', () => {
  const entry = chainById('eip155:8453')
  assert.equal(entry.displayName, 'BASE')
  assert.throws(() => chainById('eip155:99999'), /unknown chain id/)
})

test('findChain returns undefined on unknown without throwing', () => {
  assert.equal(findChain('does:not-exist'), undefined)
  assert.ok(findChain('solana:devnet') !== undefined)
})

test('gigAssetByChain matches the legacy GIG_ASSET_BY_CHAIN for every manifest chain', () => {
  // Cross-check against the existing constant to prove no drift while the two
  // coexist (Phase 2 retires GIG_ASSET_BY_CHAIN in favour of this helper).
  for (const entry of CHAIN_MANIFEST) {
    assert.equal(gigAssetByChain(entry.id), GIG_ASSET_BY_CHAIN[entry.id] ?? null, `gig asset drift on ${entry.id}`)
  }
  assert.equal(gigAssetByChain('unknown:chain'), null)
})

// ---------- assertManifestValid (the import-time integrity guard) -----------

test('assertManifestValid accepts the real manifest', () => {
  assert.doesNotThrow(() => assertManifestValid(CHAIN_MANIFEST))
})

test('assertManifestValid rejects a duplicate chain id', () => {
  const dup = [chainById('solana:devnet'), chainById('solana:devnet')]
  assert.throws(() => assertManifestValid(dup), /duplicate chain id/)
})

test('assertManifestValid rejects an asset missing from ASSET_META', () => {
  const bad: ChainManifestEntry = {
    id: 'eip155:1', namespace: 'eip155', family: 'eth', kind: 'mainnet',
    displayName: 'X', minConfirmations: 1, gasPolicy: 'none',
    assets: [{ id: 'NOT_A_REAL_ASSET', role: 'gig', token: null }],
  }
  assert.throws(() => assertManifestValid([bad]), /missing from ASSET_META/)
})

test('assertManifestValid rejects a chain without exactly one native asset', () => {
  const noNative: ChainManifestEntry = {
    id: 'eip155:1', namespace: 'eip155', family: 'eth', kind: 'mainnet',
    displayName: 'X', minConfirmations: 1, gasPolicy: 'none',
    assets: [{ id: 'USDC_BASE', role: 'gig', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' }],
  }
  assert.throws(() => assertManifestValid([noNative]), /exactly one native asset/)
})

test('assertManifestValid rejects feeCurrency/gasPolicy mismatch', () => {
  const mismatch: ChainManifestEntry = {
    id: 'eip155:1', namespace: 'eip155', family: 'eth', kind: 'mainnet',
    displayName: 'X', minConfirmations: 1, publicRpcUrl: 'https://rpc.example',
    gasPolicy: 'none', feeCurrency: 'cUSD',
    assets: [{ id: 'ETH_BASE', role: 'exchange', token: null }],
  }
  assert.throws(() => assertManifestValid([mismatch]), /feeCurrency must be set iff/)
})

test('assertManifestValid rejects feeCurrency that resolves no address', () => {
  // gasPolicy feeCurrency + feeCurrency id present, but that asset has no token.
  const bad: ChainManifestEntry = {
    id: 'eip155:1', namespace: 'eip155', family: 'eth', kind: 'mainnet',
    displayName: 'X', minConfirmations: 1, publicRpcUrl: 'https://rpc.example',
    gasPolicy: 'feeCurrency', feeCurrency: 'CELO',
    assets: [{ id: 'CELO', role: 'exchange', token: null }],
  }
  assert.throws(() => assertManifestValid([bad]), /has no token address/)
})

test('every EVM manifest chain exposes a publicRpcUrl; assertManifestValid enforces it', () => {
  for (const entry of CHAIN_MANIFEST) {
    if (entry.namespace !== 'eip155') continue
    assert.ok((entry.publicRpcUrl ?? '').length > 0, `${entry.id} missing publicRpcUrl`)
  }
  const noRpc: ChainManifestEntry = {
    id: 'eip155:1', namespace: 'eip155', family: 'eth', kind: 'mainnet',
    displayName: 'X', minConfirmations: 1, gasPolicy: 'none',
    assets: [{ id: 'ETH_BASE', role: 'exchange', token: null }],
  }
  assert.throws(() => assertManifestValid([noRpc]), /must set a publicRpcUrl/)
})

test('exactly one chain is active per family across mainnet/testnet pairs', () => {
  // Not a uniqueness assertion (families repeat by design) — documents that
  // families group networks, which the secret loader uses to enforce one
  // active chain per family.
  const byFamily = new Map<string, ChainManifestEntry[]>()
  for (const entry of CHAIN_MANIFEST) {
    const list = byFamily.get(entry.family) ?? []
    list.push(entry)
    byFamily.set(entry.family, list)
  }
  // base + solana ship a mainnet/testnet pair; celo currently mainnet-only.
  assert.deepEqual(byFamily.get('base')?.map((e) => e.kind).sort(), ['mainnet', 'testnet'])
  assert.deepEqual(byFamily.get('solana')?.map((e) => e.kind).sort(), ['mainnet', 'testnet'])
})
