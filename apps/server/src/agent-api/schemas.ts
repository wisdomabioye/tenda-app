/**
 * Component schemas for the Agent API v0 document — the public gig read
 * surface's wire shapes, written as CLOSED objects (`additionalProperties:
 * false`). That closure is the drift mechanism: the integration test validates
 * real responses against these, so a field that reaches the wire without
 * reaching this file fails a test rather than silently widening the contract.
 *
 * Every enum is DERIVED from the shared constant the server itself enforces
 * (PROOF_TYPES, GIG_CATEGORIES, escrowStatusEnum, LOCATIONS…), so a vocabulary
 * change lands here without a hand edit.
 */
import {
  AMOUNT_RAW_PATTERN,
  APPLICATION_STATUSES,
  CHAIN_MANIFEST,
  DISPUTE_WINNER_CODE,
  ErrorCode,
  GIG_CATEGORIES,
  LOCATIONS,
  MAX_GEOTAG_RADIUS_M,
  MIN_GEOTAG_RADIUS_M,
  PROOF_TYPES,
  STRUCTURED_FIELD_KINDS,
} from '@tenda/shared'
import { escrowStatusEnum } from '@tenda/shared/db/schema'
import { FEATURED_RAIL_LIMIT } from '@server/lib/featured'
import { closed, nullable, ref, type SchemaObject } from './schema-types'

const COUNTRY_CODES = Object.keys(LOCATIONS)

/** Exported for ./paths: the same scalar shapes describe path and query parameters. */
export const uuid: SchemaObject = { type: 'string', format: 'uuid' }
export const latitude: SchemaObject = { type: 'number', minimum: -90, maximum: 90 }
export const longitude: SchemaObject = { type: 'number', minimum: -180, maximum: 180 }
const isoInstant: SchemaObject = { type: 'string', format: 'date-time', description: 'ISO-8601 UTC' }
/** Base-unit integer as a canonical decimal STRING — never a JSON number (2^53 is too small). */
const rawAmount: SchemaObject = { type: 'string', pattern: AMOUNT_RAW_PATTERN.source, description: 'Base units, decimal string' }
/** The chains this codebase knows, from the manifest — a closed, append-only vocabulary. */
const chainId: SchemaObject = { type: 'string', enum: CHAIN_MANIFEST.map((entry) => entry.id), description: 'CAIP-2 chain id' }

const userRef = closed(
  {
    id: uuid,
    first_name: nullable({ type: 'string' }),
    last_name: nullable({ type: 'string' }),
    avatar_url: nullable({ type: 'string' }),
    review_score: nullable({ type: 'string', description: 'Average 0–5 as a decimal string, e.g. "4.80"' }),
    is_seeker: { type: 'boolean' },
    country: nullable({ type: 'string', enum: COUNTRY_CODES }),
  },
  ['id', 'first_name', 'last_name', 'avatar_url', 'review_score', 'is_seeker', 'country'],
  'A user as other users see them.',
)

const structuredField = closed(
  {
    name: { type: 'string', minLength: 1 },
    kind: { type: 'string', enum: STRUCTURED_FIELD_KINDS },
    required: { type: 'boolean' },
  },
  ['name', 'kind', 'required'],
)

const proofParams = closed(
  {
    geotag: closed(
      { radius_m: { type: 'integer', minimum: MIN_GEOTAG_RADIUS_M, maximum: MAX_GEOTAG_RADIUS_M } },
      ['radius_m'],
      'A geotag check-in is verified within this many metres of the gig pin.',
    ),
    structured: closed({ fields: { type: 'array', items: structuredField } }, ['fields']),
  },
  [],
  'Per-type params behind the proof requirements; keys present only for required types.',
)

const proofPayload: SchemaObject = {
  description: 'A data proof\'s substance, by type: geotag, text or structured.',
  oneOf: [
    closed({ latitude: { type: 'number' }, longitude: { type: 'number' } }, ['latitude', 'longitude']),
    closed({ text: { type: 'string' } }, ['text']),
    closed(
      {
        values: {
          type: 'object',
          // A union spelled as oneOf: strict validators refuse a multi-type
          // `type` list unless it is `X | null`.
          additionalProperties: { oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }] },
        },
      },
      ['values'],
    ),
  ],
}

const escrowProof = closed(
  {
    id: uuid,
    escrow_id: uuid,
    type: { type: 'string', enum: PROOF_TYPES },
    url: nullable({ type: 'string', description: 'File proofs only' }),
    payload: nullable(proofPayload),
    uploaded_at: isoInstant,
  },
  ['id', 'escrow_id', 'type', 'url', 'payload', 'uploaded_at'],
)

const dispute = closed(
  {
    id: uuid,
    escrow_id: uuid,
    raised_by: uuid,
    reason: { type: 'string' },
    assigned_to: nullable(uuid),
    assigned_at: nullable(isoInstant),
    winner: nullable({ type: 'string', enum: Object.keys(DISPUTE_WINNER_CODE) }),
    resolved_by: nullable(uuid),
    resolved_at: nullable(isoInstant),
    created_at: isoInstant,
  },
  ['id', 'escrow_id', 'raised_by', 'reason', 'assigned_to', 'assigned_at', 'winner', 'resolved_by', 'resolved_at', 'created_at'],
)

const review = closed(
  {
    id: uuid,
    escrow_id: uuid,
    reviewer_id: uuid,
    reviewee_id: uuid,
    score: { type: 'integer', minimum: 1, maximum: 5 },
    comment: nullable({ type: 'string' }),
    created_at: isoInstant,
  },
  ['id', 'escrow_id', 'reviewer_id', 'reviewee_id', 'score', 'comment', 'created_at'],
)

const gigApplication = closed(
  {
    id: uuid,
    escrow_id: uuid,
    applicant_id: uuid,
    message: nullable({ type: 'string' }),
    wallet_address: nullable({ type: 'string' }),
    status: { type: 'string', enum: APPLICATION_STATUSES },
    expires_at: isoInstant,
    created_at: isoInstant,
  },
  ['id', 'escrow_id', 'applicant_id', 'message', 'wallet_address', 'status', 'expires_at', 'created_at'],
)

const viewer = closed(
  {
    application: nullable(ref('GigApplication')),
    open_application_count: nullable({ type: 'integer', minimum: 0 }),
  },
  ['application', 'open_application_count'],
  'Bearer-scoped facts; null for anonymous readers. Outside the v0 guarantee.',
)

/** The listing fields — the SUMMARY, and the first half of the DETAIL. */
const GIG_SUMMARY_PROPERTIES: Readonly<Record<string, SchemaObject>> = {
  escrow_id: uuid,
  public_feed_revision: { type: 'string', pattern: AMOUNT_RAW_PATTERN.source, description: 'Realtime revision, decimal string' },
  chain_id: chainId,
  asset: { type: 'string', description: 'Asset id, e.g. USDC_SOL' },
  amount_raw: rawAmount,
  status: { type: 'string', enum: escrowStatusEnum.enumValues },
  accept_deadline: nullable(isoInstant),
  created_at: nullable(isoInstant),
  title: { type: 'string' },
  description: nullable({ type: 'string' }),
  category: { type: 'string', enum: GIG_CATEGORIES },
  country: nullable({ type: 'string', enum: COUNTRY_CODES }),
  city: nullable({ type: 'string' }),
  latitude: nullable(latitude),
  longitude: nullable(longitude),
  remote: { type: 'boolean' },
  cross_border: { type: 'boolean' },
  proof_requirements: { type: 'array', items: { type: 'string', enum: PROOF_TYPES } },
  proof_params: nullable(ref('ProofParams')),
  requires_approval: { type: 'boolean' },
  creator: ref('UserRef'),
}
const GIG_SUMMARY_REQUIRED = Object.keys(GIG_SUMMARY_PROPERTIES)

const gigSummary = closed(GIG_SUMMARY_PROPERTIES, GIG_SUMMARY_REQUIRED, 'One listing in the public feed.')

const GIG_DETAIL_ONLY: Readonly<Record<string, SchemaObject>> = {
  hidden: { type: 'boolean' },
  completion_duration_seconds: nullable({ type: 'integer' }),
  completion_deadline: nullable(isoInstant),
  submitted_at: nullable(isoInstant),
  approval_deadline: nullable(isoInstant),
  dispute_bond_raw: rawAmount,
  my_signer_address: nullable({ type: 'string', description: 'Bearer-scoped; null for anonymous readers' }),
  assigned_counterparty_id: nullable(uuid),
  is_assigned: { type: 'boolean' },
  unassign_window_seconds: { type: 'integer', minimum: 0 },
  assignment_released_at: nullable(isoInstant),
  counterparty: nullable(ref('UserRef')),
  proofs: { type: 'array', items: ref('EscrowProof') },
  dispute: nullable(ref('Dispute')),
  reviews: { type: 'array', items: ref('Review') },
  is_seeker: { type: 'boolean' },
  viewer: nullable(ref('Viewer')),
}

const gigDetail = closed(
  { ...GIG_SUMMARY_PROPERTIES, ...GIG_DETAIL_ONLY },
  [...GIG_SUMMARY_REQUIRED, ...Object.keys(GIG_DETAIL_ONLY)],
  'The listing plus its escrow facts. counterparty/proofs/dispute are PARTY-scoped: anonymous readers receive null/[]/null.',
)

const counts = (keys: readonly string[]): SchemaObject =>
  closed(Object.fromEntries(keys.map((key) => [key, { type: 'integer', minimum: 0 }])), keys)

const gigFacets = closed(
  {
    category: counts(GIG_CATEGORIES),
    country: counts(COUNTRY_CODES),
    remote: { type: 'integer', minimum: 0 },
    cross_border: { type: 'integer', minimum: 0 },
  },
  ['category', 'country', 'remote', 'cross_border'],
  'Counts per feed-rail cell: each answers "how many gigs if this cell were clicked".',
)

const paginatedGigs = closed(
  {
    data: { type: 'array', items: ref('GigSummary') },
    total: { type: 'integer', minimum: 0 },
    limit: { type: 'integer', minimum: 1 },
    offset: { type: 'integer', minimum: 0 },
    next_cursor: nullable({ type: 'string', description: 'Opaque keyset cursor; present on recency-ordered pages' }),
  },
  ['data', 'total', 'limit', 'offset'],
  // No `has_more`: the shared PaginatedResponse declares it, but no route
  // populates it (see shared/pagination/page.ts) — a documented field the
  // producer never sends is a promise an agent would wait on. Paging is
  // `offset + data.length < total`, or `next_cursor` when present.
  'One page of the feed.',
)

const apiError = closed(
  {
    statusCode: { type: 'integer' },
    error: { type: 'string' },
    message: { type: 'string' },
    code: { type: 'string', enum: Object.values(ErrorCode) },
    details: { type: 'object', additionalProperties: true },
  },
  ['statusCode', 'error', 'message', 'code'],
  'Every non-2xx answer.',
)

export const AGENT_API_SCHEMAS: Readonly<Record<string, SchemaObject>> = {
  UserRef: userRef,
  ProofParams: proofParams,
  EscrowProof: escrowProof,
  Dispute: dispute,
  Review: review,
  GigApplication: gigApplication,
  Viewer: viewer,
  GigSummary: gigSummary,
  GigDetail: gigDetail,
  GigFacets: gigFacets,
  PaginatedGigs: paginatedGigs,
  FeaturedGigs: closed(
    { data: { type: 'array', items: ref('GigSummary'), maxItems: FEATURED_RAIL_LIMIT } },
    ['data'],
    'The curated rail — a carousel, capped, never a second feed.',
  ),
  ApiError: apiError,
}
