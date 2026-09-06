/**
 * The Agent API document (v0 reads; the v1 writes are in the sibling
 * agent-api-document-v1.test.ts), as a document: well-formed, internally
 * consistent, and DERIVED from the shared vocabularies rather than restating
 * them. The live half — every path served, every response validating — is
 * test/integration/agent-api-drift.test.ts.
 *
 * The closure property is asserted here because it is the mechanism the
 * drift test relies on: an object schema that admitted unknown keys would
 * let a new wire field through silently.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { Column, is } from 'drizzle-orm'
import {
  AMOUNT_RAW_PATTERN,
  CHAIN_MANIFEST,
  APPLICATION_STATUSES,
  ErrorCode,
  GIG_CATEGORIES,
  GIG_LIST_SORTS,
  LOCATIONS,
  MAX_PAGINATION_LIMIT,
  MAX_PROXIMITY_RADIUS_KM,
  PROOF_TYPES,
  apiRoutes,
} from '@tenda/shared'
import { chainNamespaceEnum, escrowStatusEnum } from '@tenda/shared/db/schema'
import {
  AGENT_API_DOCUMENT,
  AGENT_API_DOCUMENT_PATH,
  AGENT_API_STABILITY,
  AGENT_API_VERSION,
} from '@server/agent-api/openapi'
import { operationsOf } from '@server/agent-api/paths'
import type { SchemaObject } from '@server/agent-api/schema-types'
import { FEATURED_RAIL_LIMIT } from '@server/lib/featured'
import { GIG_SUMMARY_COLS } from '@server/lib/gig-read'
import { COMPONENT_REF_PREFIX, agentApiAjv, strictAjv } from '../helpers/agent-api-validator'

const { paths, components } = AGENT_API_DOCUMENT

/** Every schema object reachable from `root`, including nested ones. */
function walk(root: SchemaObject, visit: (schema: SchemaObject) => void): void {
  visit(root)
  for (const child of Object.values(root.properties ?? {})) walk(child, visit)
  if (root.items !== undefined) walk(root.items, visit)
  for (const child of root.oneOf ?? []) walk(child, visit)
  if (typeof root.additionalProperties === 'object') walk(root.additionalProperties, visit)
}

test('the document names its own path and version, and is OpenAPI 3.1', () => {
  assert.strictEqual(AGENT_API_DOCUMENT.openapi, '3.1.0')
  // The $ref prefix is OpenAPI's, not ours: every internal check would still
  // pass with a misspelt one (the validator registers under the same string),
  // and only an external reader would notice. Pinned to the spec's spelling.
  assert.strictEqual(COMPONENT_REF_PREFIX, '#/components/schemas/')
  assert.strictEqual(AGENT_API_DOCUMENT.info.version, AGENT_API_VERSION)
  assert.strictEqual(AGENT_API_DOCUMENT_PATH, '/v1/openapi.json')
  // The guarantees are the point of a v0: they travel IN the document.
  assert.deepStrictEqual(AGENT_API_DOCUMENT.info['x-tenda-stability'], AGENT_API_STABILITY)
  assert.ok(AGENT_API_STABILITY.some((line) => /anonymous/i.test(line) && /bearer/i.test(line)))
  assert.ok(AGENT_API_STABILITY.some((line) => /never removed/i.test(line)))
  assert.ok(AGENT_API_STABILITY.some((line) => /is_agent/.test(line)))
  // Pinned so a bump is never incidental. 2.0.0 is the first MAJOR: #41 renamed
  // and retyped a REQUEST field on POST /v1/agent/tasks (accept_deadline_unix →
  // accept_window_seconds), which the response-field promise below does not
  // cover and which a caller must act on.
  assert.strictEqual(AGENT_API_VERSION, '2.0.0')
})

test('the public reads are GET-only and every agent write POST-only, all spelled from the route map', () => {
  // Anonymous GETs: the four gig reads, plus the deployment's own chain list.
  // That last one is documented because #126 stopped enumerating chain ids —
  // the document cannot know which chains a deployment settles on, so it points
  // at the endpoint that does, and a pointer to a path this document does not
  // describe would be the same dead end one indirection further out.
  const READS = [
    apiRoutes.gigs.list, apiRoutes.gigs.facets, apiRoutes.gigs.featured, apiRoutes.gigs.get.replace(':id', '{id}'),
    apiRoutes.platform.chains,
  ]
  // Writes that take a body. The demo session is a POST too, but it takes NONE
  // — that is its whole shape (#108) — so it is asserted separately below
  // rather than weakened into this list.
  const WRITES = [apiRoutes.agent.register, apiRoutes.agent.tasks]
  const BODYLESS = [apiRoutes.agent.demoSession]
  assert.deepStrictEqual(Object.keys(paths).sort(), [...READS, ...WRITES, ...BODYLESS].sort())
  for (const path of READS) {
    const item = paths[path]
    assert.deepStrictEqual(Object.keys(item), ['get'], `${path} must be read-only`)
    assert.ok(item.get?.responses['200'] !== undefined, `${path} documents its 200`)
    assert.strictEqual(item.get?.security, undefined, `${path} is anonymous`)
  }
  for (const path of WRITES) {
    const item = paths[path]
    assert.deepStrictEqual(Object.keys(item), ['post'], `${path} must be write-only`)
    assert.ok(item.post?.requestBody?.required === true, `${path} documents its body`)
  }
  // The demo session (#108): a POST that takes nothing, needs nothing, and
  // hands back a bearer. Anonymous BY NECESSITY, exactly like registration — it
  // is the door for a caller who cannot sign a wallet proof — and it must keep
  // documenting the 503 a deployment without a demo address answers, or the
  // only honest outcome becomes an undocumented one.
  for (const path of BODYLESS) {
    const item = paths[path]
    assert.deepStrictEqual(Object.keys(item), ['post'], `${path} must be write-only`)
    assert.strictEqual(item.post?.requestBody, undefined, `${path} must take no body`)
    assert.strictEqual(item.post?.security, undefined, `${path} is anonymous — it is how a bearer is obtained`)
    assert.ok(item.post?.responses['200'] !== undefined, `${path} documents its 200`)
    assert.ok(item.post?.responses['503'] !== undefined, `${path} documents the unconfigured deployment`)
  }
  // The one-shot is bearer-scoped and documents BOTH halves of the x402 round trip.
  const tasks = paths[apiRoutes.agent.tasks].post
  assert.deepStrictEqual(tasks?.security, [{ bearer: [] }])
  assert.ok(tasks?.responses['402'] !== undefined && tasks.responses['201'] !== undefined)
  assert.ok(tasks?.parameters?.some((p) => p.in === 'header' && p.name === 'x-payment'))
  // #126 instance 3: the recorded example carries the chain and asset it was
  // CAPTURED on, which is what makes it a recording. The operation has to say
  // so, or a reader takes those values for defaults and posts a chain this
  // deployment does not settle on.
  assert.match(tasks?.description ?? '', /\/v1\/platform\/chains/)
  // Registration is anonymous by necessity — it is how a bearer is obtained.
  assert.strictEqual(paths[apiRoutes.agent.register].post?.security, undefined)
  // Every operation in the document, walked once — three separate nested walks
  // stood here before #126 added a third.
  const operations = Object.values(paths).flatMap(operationsOf)
  // OpenAPI: a requirement may only name a scheme components.securitySchemes declares.
  const declared = new Set(Object.keys(components.securitySchemes))
  for (const op of operations) {
    for (const requirement of op.security ?? []) {
      for (const name of Object.keys(requirement)) assert.ok(declared.has(name), `security scheme ${name} is not declared`)
    }
  }
  // OpenAPI: an operation may only carry tags the document declares. Unchecked
  // until #126 added the first new tag since the document was written, and a
  // typo here is invalid OpenAPI that renders as an unlabelled operation.
  const declaredTags = new Set(AGENT_API_DOCUMENT.tags.map((tag) => tag.name))
  for (const op of operations) {
    for (const tag of op.tags) assert.ok(declaredTags.has(tag), `tag ${tag} on ${op.operationId} is not declared`)
  }
  assert.deepStrictEqual(components.securitySchemes.bearer.type, 'http')
  assert.deepStrictEqual(components.securitySchemes.bearer.scheme, 'bearer')
  for (const op of operations) assert.ok(op.operationId.length > 0)
})

test('every $ref resolves to a component schema, and every component is referenced or is a response', () => {
  const referenced = new Set<string>()
  const collect = (schema: SchemaObject) => {
    if (schema.$ref !== undefined) {
      const name = schema.$ref.replace(COMPONENT_REF_PREFIX, '')
      assert.ok(name in components.schemas, `dangling $ref ${schema.$ref}`)
      referenced.add(name)
    }
  }
  for (const schema of Object.values(components.schemas)) walk(schema, collect)
  for (const item of Object.values(paths)) {
    for (const op of operationsOf(item)) {
      for (const response of Object.values(op.responses)) {
        for (const media of Object.values(response.content ?? {})) walk(media.schema, collect)
      }
      for (const media of Object.values(op.requestBody?.content ?? {})) walk(media.schema, collect)
      for (const parameter of op.parameters ?? []) walk(parameter.schema, collect)
    }
  }
  const unreferenced = Object.keys(components.schemas).filter((name) => !referenced.has(name))
  assert.deepStrictEqual(unreferenced, [], 'a component nothing points at is dead documentation')
})

test('every object schema is CLOSED — the drift test depends on it', () => {
  const open: string[] = []
  for (const [name, schema] of Object.entries(components.schemas)) {
    walk(schema, (node) => {
      if (node.type === 'object' && node.additionalProperties === undefined) open.push(name)
    })
  }
  // Two objects are free-form BY CONTRACT (ApiError.details, a structured
  // proof's `values`) — and both say so with an EXPLICIT additionalProperties,
  // which is why neither appears here: the defect is omission, not openness.
  assert.deepStrictEqual(open, [])
})

test('enumerations are the shared vocabularies, not restated copies', () => {
  const summary = components.schemas.GigSummary.properties ?? {}
  assert.deepStrictEqual(summary.status.enum, escrowStatusEnum.enumValues)
  assert.deepStrictEqual(summary.category.enum, GIG_CATEGORIES)
  assert.deepStrictEqual(summary.proof_requirements.items?.enum, PROOF_TYPES)
  // Nullable enums carry null as a value too (a remote poster may have no country).
  assert.deepStrictEqual(summary.country.enum, [...Object.keys(LOCATIONS), null])
  assert.deepStrictEqual(
    components.schemas.GigApplication.properties?.status.enum,
    APPLICATION_STATUSES,
  )
  assert.deepStrictEqual(components.schemas.ApiError.properties?.code.enum, Object.values(ErrorCode))
  // Chain ids are SHAPE-checked and deliberately NOT enumerated (#126): which
  // chains exist is a manifest fact, which chains a deployment settles on is a
  // configuration fact, and this document is deployment-independent. It used to
  // list every manifest entry, which promised `solana:mainnet` and
  // `eip155:8453` — both `planned`, refused everywhere.
  assert.strictEqual(summary.chain_id.enum, undefined, 'chain_id must not enumerate the manifest')
  assert.ok(summary.chain_id.pattern !== undefined, 'chain_id must still be shape-checked')
  const shape = new RegExp(summary.chain_id.pattern)
  assert.ok(shape.test('eip155:84532') && shape.test('solana:devnet'), 'a real chain id must pass')
  assert.ok(!shape.test('bogus:1') && !shape.test('eip155:'), 'a malformed id must not')
  // Every namespace the shared enum declares is accepted. This cannot see
  // WHERE the pattern's alternation came from — a hardcoded one matching today's
  // two namespaces passes — but it is the assertion that goes red the moment a
  // third namespace is added to the enum and a literal fails to follow it.
  for (const ns of chainNamespaceEnum) assert.ok(summary.chain_id.pattern.includes(ns), `${ns} is missing from the pattern`)
  // CAIP-2's reference half is `[-_a-zA-Z0-9]{1,32}`: no dot, and not empty.
  assert.ok(!shape.test('eip155:1.5'), 'a dot is not a CAIP-2 reference character')
  assert.ok(!shape.test(`eip155:${'x'.repeat(33)}`), 'a reference over 32 characters is not CAIP-2')
  // And the reader is told where the deployment's own list lives.
  assert.match(summary.chain_id.description ?? '', /\/v1\/platform\/chains/)
  // The rail is a carousel with a fixed cap, and the document says so.
  assert.strictEqual(components.schemas.FeaturedGigs.properties?.data.maxItems, FEATURED_RAIL_LIMIT)
  // Facets carry one count per category and per market — the whole vocabulary.
  const facets = components.schemas.GigFacets.properties ?? {}
  assert.deepStrictEqual(Object.keys(facets.category.properties ?? {}), [...GIG_CATEGORIES])
  assert.deepStrictEqual(Object.keys(facets.country.properties ?? {}), Object.keys(LOCATIONS))
})

/**
 * A field's nullability on the wire is a property of the COLUMN it is
 * projected from, so this derives the expectation from the Drizzle schema
 * rather than restating it: `GIG_SUMMARY_COLS` is the same map the query
 * selects with, and `.notNull` is what the migration actually declared.
 *
 * `closedFor<GigSummary>` cannot catch this — it binds which keys exist and
 * which are required, and a nullable schema accepts a non-null value happily,
 * so a document that over-promises null drifts silently in both directions.
 */
/**
 * #126 instance 3. The recorded example legitimately carries the chain and
 * asset it was captured on — that is what makes it a recording rather than a
 * hand-written sample. A DESCRIPTION naming one is a different thing: it reads
 * as an instruction, and on a deployment that settles elsewhere it is a wrong
 * one. The document had two ("The chain\'s gig asset id (USDC), e.g.
 * USDC_BASE", and the chain_id enum before instance 2), which is how a
 * reviewer on a Celo deployment would have been told to post USDC_BASE on
 * Base Sepolia.
 *
 * Derived from the manifest, so a chain or asset added later is covered
 * without touching this. Values are left alone; only prose is scanned.
 */
test('no description hand-writes a chain or asset id — those are per-deployment', () => {
  const forbidden = [
    ...CHAIN_MANIFEST.map((entry) => entry.id),
    ...CHAIN_MANIFEST.flatMap((entry) => entry.assets.map((asset) => asset.id)),
  ]
  assert.ok(forbidden.length > 0, 'the manifest is empty — this would pass vacuously')
  const prose: { where: string; text: string }[] = []
  for (const [name, schema] of Object.entries(components.schemas)) {
    walk(schema, (node) => {
      if (node.description !== undefined) prose.push({ where: `schema ${name}`, text: node.description })
    })
  }
  for (const [path, item] of Object.entries(paths)) {
    for (const op of operationsOf(item)) {
      prose.push({ where: `${path} description`, text: op.description })
      prose.push({ where: `${path} summary`, text: op.summary })
      for (const parameter of op.parameters ?? []) {
        if (parameter.description !== undefined) prose.push({ where: `${path} ?${parameter.name}`, text: parameter.description })
      }
      for (const [status, response] of Object.entries(op.responses)) {
        prose.push({ where: `${path} ${status}`, text: response.description })
      }
    }
  }
  assert.ok(prose.length > 0, 'no prose collected — the scan below would be vacuous')
  const offences = prose.flatMap(({ where, text }) =>
    forbidden.filter((id) => new RegExp(`\\b${id}\\b`).test(text)).map((id) => `${where} names ${id}`),
  )
  assert.deepStrictEqual(offences, [], 'a per-deployment value is written into prose, where it reads as an instruction')
})

test('the document allows null exactly where the DATABASE does', () => {
  const summary = components.schemas.GigSummary.properties ?? {}
  const allowsNull = (schema: SchemaObject): boolean => {
    if (schema.oneOf !== undefined) return schema.oneOf.some((branch) => branch.type === 'null')
    if (Array.isArray(schema.type)) return schema.type.includes('null')
    return schema.type === 'null'
  }

  const checked: string[] = []
  for (const [field, column] of Object.entries(GIG_SUMMARY_COLS)) {
    // `creator` is a nested projection (USER_COLS), not a column of its own.
    // Drizzle's own guard, so this narrows without a cast.
    if (!is(column, Column)) continue
    const schema = summary[field]
    assert.ok(schema !== undefined, `${field} is selected but absent from the document`)
    assert.strictEqual(
      allowsNull(schema),
      !column.notNull,
      `${field}: document ${allowsNull(schema) ? 'allows' : 'refuses'} null, column is ${column.notNull ? 'NOT NULL' : 'nullable'}`,
    )
    checked.push(field)
  }
  // Both polarities are actually represented, or the loop above proves nothing.
  assert.ok(checked.includes('created_at'), 'created_at was not checked')
  assert.ok(checked.includes('accept_deadline'), 'accept_deadline was not checked')
  assert.strictEqual(
    checked.length,
    Object.keys(GIG_SUMMARY_COLS).length - 1,
    'every selected key but `creator` is a column; a new nested projection needs a case here',
  )
})

test('every query parameter compiles strictly and states the bound the server refuses at', () => {
  const ajv = strictAjv()
  type Parameter = NonNullable<ReturnType<typeof operationsOf>[number]['parameters']>[number]
  const byName = new Map<string, Parameter>()
  for (const item of Object.values(paths)) {
    for (const op of operationsOf(item)) {
      for (const parameter of op.parameters ?? []) {
        // Compiling is the check: strict ajv refuses a contradictory schema.
        ajv.compile(parameter.schema)
        byName.set(parameter.name, parameter)
      }
    }
  }
  const param = (name: string): SchemaObject => {
    const parameter = byName.get(name)
    assert.ok(parameter !== undefined, `${name} is documented`)
    return parameter.schema
  }
  // Proximity: the server 400s a zero radius and anything past the cap.
  const radius = ajv.compile(param('radius_km'))
  assert.strictEqual(radius(0), false)
  assert.strictEqual(radius(0.5), true)
  assert.strictEqual(radius(MAX_PROXIMITY_RADIUS_KM), true)
  assert.strictEqual(radius(MAX_PROXIMITY_RADIUS_KM + 1), false)
  // Page size: the clamp's ceiling, from the constant the clamp reads.
  assert.strictEqual(param('limit').maximum, MAX_PAGINATION_LIMIT)
  // Amount bounds: CANONICAL integers — the server refuses `007`.
  const minAmount = ajv.compile(param('min_amount_raw'))
  assert.strictEqual(minAmount('0'), true)
  assert.strictEqual(minAmount('12'), true)
  assert.strictEqual(minAmount('007'), false)
  assert.strictEqual(minAmount(''), false)
  assert.strictEqual(param('max_amount_raw').pattern, AMOUNT_RAW_PATTERN.source)
  // Vocabularies the server enforces, spelled from the shared constants.
  assert.deepStrictEqual(param('sort').enum, GIG_LIST_SORTS)
  // Same as the response field: shape, not a manifest listing (#126).
  assert.strictEqual(param('chain_id').enum, undefined)
  assert.ok(param('chain_id').pattern !== undefined)
  // A city is matched as sent; nothing checks it against the country.
  assert.doesNotMatch(byName.get('city')?.description ?? '', /belong/)
})

test('the schemas compile under a STRICT validator and the closure bites', () => {
  const validate = agentApiAjv().getSchema(`${COMPONENT_REF_PREFIX}UserRef`)
  assert.ok(validate !== undefined)
  const user = {
    id: '1c1e6a6e-9b1e-4e3a-8f4b-2b0f7d6b1a11',
    first_name: 'Ada',
    last_name: null,
    avatar_url: null,
    review_score: '4.80',
    is_seeker: false,
    is_agent: false,
    country: 'NG',
  }
  assert.strictEqual(validate(user), true)
  // is_agent is part of the closed contract now: a ref without it is refused.
  const { is_agent: _dropped, ...withoutAgent } = user
  assert.strictEqual(validate(withoutAgent), false)
  // One undocumented key is a failure, not a pass with a warning.
  assert.strictEqual(validate({ ...user, handle: '@ada' }), false)
  // A wrong type on a documented key is too.
  assert.strictEqual(validate({ ...user, review_score: 4.8 }), false)
})
