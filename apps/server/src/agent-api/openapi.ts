/**
 * Agent API v0 — the machine-readable contract for the public, read-only gig
 * surface, served at AGENT_API_DOCUMENT_PATH. Assembled from ./paths and
 * ./schemas; this file owns the metadata and the STABILITY GUARANTEES, which
 * are the point of a v0: an agent integrates against what is written here.
 *
 * Drift is caught two ways (test/integration/agent-api-drift.test.ts): every
 * path here must be served, and every documented response must validate the
 * live body — with closed schemas, so a new wire field fails the test until it
 * is documented. Additions therefore always land in the document.
 */
import { AGENT_API_PATHS, type PathItem } from './paths'
import { AGENT_API_SCHEMAS } from './schemas'
import type { SchemaObject } from './schema-types'

/** Where the document is served. One path, frozen with the rest of v0. */
export const AGENT_API_DOCUMENT_PATH = '/v1/openapi.json'

/** The contract line. Bumped only for the additive changes the guarantees allow. */
export const AGENT_API_VERSION = '0.1.0'

/** Seconds a fetched document may be cached — it changes only with a deploy. */
export const AGENT_API_CACHE_SECONDS = 300

export const AGENT_API_STABILITY = [
  'Read-only and anonymous: no request in this document needs a bearer token.',
  'The paths and methods listed here are frozen for the v0 line.',
  'Documented response fields are never removed, renamed or retyped. Fields may be ADDED; clients must ignore fields they do not know.',
  'Enumerations (proof types, categories, statuses, countries, chain ids, sort keys, error codes) are append-only.',
  'Every non-2xx answer is the ApiError envelope: statusCode, error, message, code, and an optional machine-readable details object.',
  'Amounts are base-unit integers carried as decimal strings; timestamps are ISO-8601 UTC; ids are UUIDs; chain ids are CAIP-2.',
  'Fields marked bearer-scoped (viewer, my_signer_address, counterparty, proofs, dispute) are documented for completeness but sit outside the v0 guarantee.',
] as const

export interface OpenApiDocument {
  openapi: '3.1.0'
  info: {
    title: string
    version: string
    description: string
    'x-tenda-stability': readonly string[]
  }
  servers: readonly { url: string; description: string }[]
  tags: readonly { name: string; description: string }[]
  paths: Readonly<Record<string, PathItem>>
  components: { schemas: Readonly<Record<string, SchemaObject>> }
}

export const AGENT_API_DOCUMENT: OpenApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Tenda Agent API',
    version: AGENT_API_VERSION,
    description:
      'The public gig read surface of Tenda — funded, escrow-backed gigs a worker (human or agent) can take. v0 is read-only: browse the feed, read a gig and the proof it will demand. Stability guarantees are listed under x-tenda-stability.',
    'x-tenda-stability': AGENT_API_STABILITY,
  },
  servers: [{ url: '/', description: 'The origin this document was fetched from' }],
  tags: [{ name: 'gigs', description: 'Public, read-only gig listings' }],
  paths: AGENT_API_PATHS,
  components: { schemas: AGENT_API_SCHEMAS },
}
