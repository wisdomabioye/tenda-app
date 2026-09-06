/**
 * The one PLATFORM path the agent document carries: `GET /v1/platform/chains`,
 * the deployment's own answer to "which chains can I settle on here" (#126).
 *
 * WHY IT IS HERE. `chain_id` used to be documented as an enum of every
 * `CHAIN_MANIFEST` entry, which offered agents `solana:mainnet` and
 * `eip155:8453` — both `status: 'planned'`, refused by every deployment that
 * exists. The manifest is the set of chains this CODEBASE knows; the set a
 * deployment settles on comes from its `CHAIN_<id>_*` secrets, and the two are
 * different facts. The document is a module-load constant and can only state
 * the first, so ./scalars now checks the SHAPE of a chain id and points here
 * for the list — and a pointer to an endpoint the document does not describe
 * is the same dead end the enum was, one indirection further out.
 *
 * The route already answers with exactly the right set: enabled in the
 * database INTERSECTED with the adapter registry, so a chain the server cannot
 * build or verify a transaction on is omitted rather than advertised. Nothing
 * about that behaviour is added here; it is only made visible to a reader who
 * never leaves this document.
 *
 * ONE FILE, not the `paths-x` / `schemas-x` pair the two older surfaces use.
 * Those pairs split a SURFACE in half — v0 reads across ./paths + ./schemas, v1
 * writes across ./paths-agent + ./schemas-agent — and each half carries enough
 * to stand alone. This surface is one path and three schemas; splitting it the
 * same way would buy symmetry at the cost of two files neither of which can be
 * read on its own.
 *
 * IT IS ALSO THE ADDRESS SOURCE. `escrow_address` is the contract the agent's
 * own signature authorises as spender — served from the registry the server
 * itself uses, never from the stored column, which is written by `db:seed` and
 * has drifted two contract generations behind before now.
 */
import { apiRoutes, type ChainRegistryEntry, type PlatformContract } from '@tenda/shared'
import { chainNamespaceEnum } from '@tenda/shared/db/schema'
import { closedFor, nullable, ref, type PlatformComponentName, type SchemaObject } from './schema-types'
import { json, type PathItem } from './paths'
import { chainIdShape } from './scalars'

/** One enabled asset on one enabled chain — what a client may price a task in. */
const chainRegistryAsset: SchemaObject = closedFor<ChainRegistryEntry['assets'][number]>(
  {
    id: { type: 'string', description: 'As sent in `asset`' },
    symbol: { type: 'string' },
    decimals: { type: 'integer', minimum: 0 },
    is_stable: { type: 'boolean' },
    token_address: nullable({ type: 'string', description: 'ERC-20 contract / SPL mint; null for the native gas token' }),
    supports_permit: { type: 'boolean', description: 'EIP-2612: approvable by signature' },
  },
  ['id', 'symbol', 'decimals', 'is_stable', 'token_address', 'supports_permit'],
)

const chainRegistryEntry: SchemaObject = closedFor<ChainRegistryEntry>(
  {
    id: chainIdShape,
    namespace: { type: 'string', enum: chainNamespaceEnum },
    display_name: { type: 'string' },
    escrow_address: { type: 'string', description: 'Escrow contract / program id — the spender an agent authorises' },
    assets: { type: 'array', items: ref('ChainRegistryAsset') },
  },
  ['id', 'namespace', 'display_name', 'escrow_address', 'assets'],
  'A chain THIS deployment settles on.',
)

type ChainsResponse = PlatformContract['chains']['response']

const chainRegistry: SchemaObject = closedFor<ChainsResponse>(
  { data: { type: 'array', items: ref('ChainRegistryEntry') } },
  ['data'],
  'What this deployment settles on — never what the codebase knows.',
)

export const AGENT_API_PLATFORM_SCHEMAS: Readonly<Record<PlatformComponentName, SchemaObject>> = {
  ChainRegistryAsset: chainRegistryAsset,
  ChainRegistryEntry: chainRegistryEntry,
  ChainRegistry: chainRegistry,
}

export const AGENT_API_PLATFORM_PATHS: Readonly<Record<string, PathItem>> = {
  [apiRoutes.platform.chains]: {
    get: {
      operationId: 'listChains',
      summary: 'The chains THIS deployment settles on',
      description:
        'Anonymous, and per-deployment: a chain appears only when this server holds its configuration and can settle on it, so testnet and mainnet deployments answer differently. Read it before choosing `chain_id` or `asset` — those are shape-checked, not enumerated, because THIS is the list.',
      tags: ['platform'],
      responses: { '200': { description: 'The enabled chains and their enabled assets', content: json(ref('ChainRegistry')) } },
    },
  },
}
