/**
 * Per-deployment chain SECRETS loader. The public facts live in the shared
 * CHAIN_MANIFEST; this reads the deployment-specific endpoints/addresses from
 * flat, conventionally-named env vars and returns one validated, typed record
 * per ACTIVE chain.
 *
 * Env convention — `CHAIN_<SANITISED_ID>_<FIELD>`, e.g.
 *   CHAIN_EIP155_8453_RPC_URL, CHAIN_SOLANA_DEVNET_PROGRAM_ID
 * Keys are CONSTRUCTED from the manifest id + a fixed per-namespace field set,
 * never parsed back, so single-underscore separators are unambiguous.
 *
 * Activation rule (replaces the old null-gating AND the *_NETWORK toggles):
 *   - none of a chain's fields set        → chain INACTIVE (skipped silently)
 *   - all required set + valid             → chain ACTIVE
 *   - some-but-not-all required, or any
 *     present-but-malformed                → BOOT ERROR (names the exact key)
 * Plus: at most ONE active chain per `family` (Base mainnet XOR Base Sepolia),
 * and any unrecognised `CHAIN_*` env var is a boot error (kills silent typos).
 */

import { CHAIN_MANIFEST, chainById, type ChainManifestEntry } from '@tenda/shared'

/** Validation classes for a secret value. */
type SecretKind = 'url' | 'evmAddr' | 'base58' | 'str'

interface SecretFieldSpec {
  /** Logical key on the resolved record. */
  key: string
  /** Env-var suffix appended after the sanitised chain id. */
  envSuffix: string
  required: boolean
  kind: SecretKind
}

/**
 * Secret schema keyed by NAMESPACE (not family): every EVM chain reads the
 * same fields, every Solana chain reads the same fields — so adding an EVM L2
 * needs no schema change. The resolved record's shape mirrors this 1:1.
 */
const SECRET_SCHEMA: Record<string, readonly SecretFieldSpec[]> = {
  // NOTE: the Solana program id is NOT a secret — it is the deployed IDL
  // artifact (ESCROW_IDL.address), the single source used by the adapter,
  // pdas, and the seeder. Treasury + RPC are the genuine per-deployment values.
  solana: [
    { key: 'rpcUrl', envSuffix: 'RPC_URL', required: true, kind: 'url' },
    { key: 'treasury', envSuffix: 'TREASURY_ADDR', required: true, kind: 'base58' },
    { key: 'usdcMint', envSuffix: 'USDC_MINT', required: false, kind: 'base58' },
    { key: 'gasSeedKey', envSuffix: 'GAS_SEED_KEY', required: false, kind: 'str' },
    { key: 'webhookSecret', envSuffix: 'WEBHOOK_SECRET', required: false, kind: 'str' },
  ],
  eip155: [
    { key: 'rpcUrl', envSuffix: 'RPC_URL', required: true, kind: 'url' },
    { key: 'escrow', envSuffix: 'ESCROW_ADDR', required: true, kind: 'evmAddr' },
    { key: 'treasury', envSuffix: 'TREASURY_ADDR', required: true, kind: 'evmAddr' },
    { key: 'paymasterUrl', envSuffix: 'PAYMASTER_URL', required: false, kind: 'url' },
    { key: 'webhookSecret', envSuffix: 'WEBHOOK_SECRET', required: false, kind: 'str' },
  ],
}

/** Resolved secrets per active chain — a discriminated union over namespace. */
export type ResolvedChainSecret =
  | {
      namespace: 'solana'
      chainId: string
      rpcUrl: string
      treasury: string
      usdcMint?: string
      gasSeedKey?: string
      webhookSecret?: string
    }
  | {
      namespace: 'eip155'
      chainId: string
      rpcUrl: string
      escrow: string
      treasury: string
      paymasterUrl?: string
      webhookSecret?: string
    }

/** `CHAIN_` + the chain id upper-cased with every non-alphanumeric run → `_`. */
export function chainEnvPrefix(id: string): string {
  return `CHAIN_${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`
}

function schemaFor(entry: ChainManifestEntry): readonly SecretFieldSpec[] {
  const schema = SECRET_SCHEMA[entry.namespace]
  if (schema === undefined) {
    throw new Error(`no secret schema for namespace '${entry.namespace}' (chain ${entry.id})`)
  }
  return schema
}

function isValid(kind: SecretKind, value: string): boolean {
  switch (kind) {
    case 'url':
      try {
        return new URL(value).protocol.length > 0 // construction is the validation
      } catch {
        return false
      }
    case 'evmAddr':
      return /^0x[0-9a-fA-F]{40}$/.test(value)
    case 'base58':
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value)
    case 'str':
      return value.length > 0
  }
}

/**
 * Every env key the manifest could legitimately read — powers the boot-time
 * typo guard AND the .env.example parity test (documented CHAIN_* names must
 * be names the loader actually reads, so the docs can't silently rot).
 */
export function knownChainEnvKeys(
  manifest: readonly ChainManifestEntry[] = CHAIN_MANIFEST,
): Set<string> {
  return knownKeys(manifest)
}

function knownKeys(manifest: readonly ChainManifestEntry[]): Set<string> {
  const keys = new Set<string>()
  for (const entry of manifest) {
    const prefix = chainEnvPrefix(entry.id)
    for (const spec of schemaFor(entry)) keys.add(`${prefix}_${spec.envSuffix}`)
  }
  return keys
}

/** Narrowing accessor: a required field is guaranteed present post-validation. */
function must(present: Map<string, string>, key: string, chainId: string): string {
  const value = present.get(key)
  if (value === undefined) {
    // Unreachable: required fields are validated before assembly. Guards the
    // invariant rather than reaching for a non-null assertion.
    throw new Error(`internal: required secret '${key}' absent for ${chainId} after validation`)
  }
  return value
}

function assemble(
  entry: ChainManifestEntry,
  present: Map<string, string>,
): ResolvedChainSecret {
  if (entry.namespace === 'solana') {
    return {
      namespace: 'solana',
      chainId: entry.id,
      rpcUrl: must(present, 'rpcUrl', entry.id),
      treasury: must(present, 'treasury', entry.id),
      usdcMint: present.get('usdcMint'),
      gasSeedKey: present.get('gasSeedKey'),
      webhookSecret: present.get('webhookSecret'),
    }
  }
  return {
    namespace: 'eip155',
    chainId: entry.id,
    rpcUrl: must(present, 'rpcUrl', entry.id),
    escrow: must(present, 'escrow', entry.id),
    treasury: must(present, 'treasury', entry.id),
    paymasterUrl: present.get('paymasterUrl'),
    webhookSecret: present.get('webhookSecret'),
  }
}

/**
 * Load and validate chain secrets from `env`. `env` is a parameter (defaulting
 * to process.env) so the loader is fully testable without global mutation.
 * Aggregates ALL configuration errors and throws once, so a misconfigured
 * deployment sees every problem at once rather than one-per-restart.
 */
export function loadChainSecrets(
  env: NodeJS.ProcessEnv = process.env,
  manifest: readonly ChainManifestEntry[] = CHAIN_MANIFEST,
): Map<string, ResolvedChainSecret> {
  const errors: string[] = []
  const result = new Map<string, ResolvedChainSecret>()
  const activeByFamily = new Map<string, string>()

  // Typo guard: any CHAIN_-prefixed var that no manifest chain would read.
  const valid = knownKeys(manifest)
  const unknown = Object.keys(env).filter(
    (k) => k.startsWith('CHAIN_') && !valid.has(k) && (env[k] ?? '').trim().length > 0,
  )
  if (unknown.length > 0) {
    errors.push(`unrecognised chain env var(s): ${unknown.sort().join(', ')} — check spelling against the manifest`)
  }

  for (const entry of manifest) {
    const prefix = chainEnvPrefix(entry.id)
    const schema = schemaFor(entry)
    const present = new Map<string, string>()
    for (const spec of schema) {
      const raw = env[`${prefix}_${spec.envSuffix}`]
      const value = raw?.trim() ?? ''
      // Empty / whitespace-only is treated as ABSENT, not malformed, so a
      // commented-out or blank `VAR=` line leaves the chain inactive.
      if (value.length > 0) present.set(spec.key, value)
    }

    if (present.size === 0) continue // inactive — chain not configured here

    const missingRequired = schema
      .filter((s) => s.required && !present.has(s.key))
      .map((s) => `${prefix}_${s.envSuffix}`)
    const malformed: string[] = []
    for (const spec of schema) {
      const value = present.get(spec.key)
      if (value !== undefined && !isValid(spec.kind, value)) {
        malformed.push(`${prefix}_${spec.envSuffix}`)
      }
    }

    if (missingRequired.length > 0) {
      errors.push(`${entry.id}: partially configured — missing ${missingRequired.join(', ')}`)
    }
    if (malformed.length > 0) {
      errors.push(`${entry.id}: malformed value(s) for ${malformed.join(', ')}`)
    }
    if (missingRequired.length > 0 || malformed.length > 0) continue

    const clash = activeByFamily.get(entry.family)
    if (clash !== undefined) {
      errors.push(
        `${entry.id} and ${clash} are both configured but share family '${entry.family}' — a deployment runs one network per family`,
      )
      continue
    }
    activeByFamily.set(entry.family, entry.id)
    result.set(entry.id, assemble(entry, present))
  }

  if (errors.length > 0) {
    throw new Error(`Chain secret configuration error:\n  - ${errors.join('\n  - ')}`)
  }
  return result
}

/** Convenience aliases for the two namespace variants of the resolved union. */
export type SolanaChainSecret = Extract<ResolvedChainSecret, { namespace: 'solana' }>
export type EvmChainSecret = Extract<ResolvedChainSecret, { namespace: 'eip155' }>

let cached: Map<string, ResolvedChainSecret> | undefined

/**
 * Cached process-wide chain secrets (mirrors getConfig): loaded once from
 * process.env against the live manifest. Consumers call this instead of
 * reading per-chain env directly.
 */
export function getChainSecrets(): Map<string, ResolvedChainSecret> {
  if (cached === undefined) cached = loadChainSecrets()
  return cached
}

/** Test seam: drop the cache so a later getChainSecrets re-reads env. */
export function resetChainSecretsCache(): void {
  cached = undefined
}

/**
 * The single active Solana chain, if configured. The loader guarantees at most
 * one chain per family and Solana clusters share family 'solana', so the
 * namespace match is unique.
 */
export function solanaSecret(
  secrets: Map<string, ResolvedChainSecret> = getChainSecrets(),
): SolanaChainSecret | undefined {
  for (const secret of secrets.values()) {
    if (secret.namespace === 'solana') return secret
  }
  return undefined
}

/** The active paymaster-managed EVM chain (BASE-style), if configured. */
export function paymasterChainSecret(
  secrets: Map<string, ResolvedChainSecret> = getChainSecrets(),
): EvmChainSecret | undefined {
  for (const secret of secrets.values()) {
    if (secret.namespace === 'eip155' && chainById(secret.chainId).gasPolicy === 'paymaster') {
      return secret
    }
  }
  return undefined
}

