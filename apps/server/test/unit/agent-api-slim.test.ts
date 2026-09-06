/**
 * The slim agent document: it must be a faithful SUBSET, and it must stay
 * small. Those are its only two properties, and each has a failure mode that
 * ships silently.
 *
 * A drifted subset is worse than no subset — an agent integrates against a
 * contract the server does not honour, and nothing errors. A subset that grows
 * back to the size of the canonical document is not a subset in any useful
 * sense: six of the ten reviewers on 2026-09-05 could not read that document to
 * the end. How far they got is NOT established — their own byte figures
 * disagree (see the note in slim.ts) — so these pin the direction, not a
 * target.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { apiRoutes } from '@tenda/shared'
import { AGENT_API_DOCUMENT, AGENT_API_DOCUMENT_PATH } from '@server/agent-api/openapi'
import {
  AGENT_SLIM_DOCUMENT,
  AGENT_SLIM_MAX_BYTES,
  AGENT_SLIM_PATHS,
  slimAgentDocument,
} from '@server/agent-api/slim'
import { COMPONENT_REF_PREFIX } from '@server/agent-api/schema-types'

const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value))

/**
 * The same value with every inline `example` removed.
 *
 * #109 attaches recorded examples to the slim document's task operation, which
 * is the ONE licensed difference from the canonical one. Stripping them here
 * keeps the drift guard as strict as it was: everything else — descriptions,
 * `$ref`s, statuses, security — must still match byte for byte, and a change
 * smuggled in beside an example fails exactly as it did before.
 */
function withoutExamples(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutExamples)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'example')
      .map(([key, child]) => [key, withoutExamples(child)]),
  )
}

/** Every `#/components/schemas/X` named anywhere in a serialised value. */
function referencedNames(value: unknown): string[] {
  const json = JSON.stringify(value)
  const pattern = new RegExp(`${COMPONENT_REF_PREFIX.replace(/[/#]/g, '\\$&')}([A-Za-z0-9_]+)`, 'g')
  return [...new Set([...json.matchAll(pattern)].map((m) => m[1]))]
}

// ---------- the DRIFT guard -------------------------------------------------

test('every path in the slim document is byte-identical to the canonical one, examples aside', () => {
  for (const path of Object.keys(AGENT_SLIM_DOCUMENT.paths)) {
    assert.deepStrictEqual(
      withoutExamples(AGENT_SLIM_DOCUMENT.paths[path]),
      AGENT_API_DOCUMENT.paths[path],
      `${path} drifted from ${AGENT_API_DOCUMENT_PATH}`,
    )
  }
})

test('examples are the ONLY difference — the canonical document gains nothing', () => {
  // Both halves matter. The first says the slim document adds only examples;
  // the second says they were added HERE and not to /v1/openapi.json, which is
  // the constraint #109 was given (the canonical document is for humans and
  // codegen, and every example there costs the audience that complained).
  assert.notDeepStrictEqual(
    AGENT_SLIM_DOCUMENT.paths[apiRoutes.agent.tasks],
    AGENT_API_DOCUMENT.paths[apiRoutes.agent.tasks],
    'the slim task path carries no example at all — #109 did not take effect',
  )
  assert.deepStrictEqual(withoutExamples(AGENT_API_DOCUMENT), AGENT_API_DOCUMENT, 'the canonical document grew an example')
})

test('every schema in the slim document is byte-identical to the canonical one', () => {
  const slim = AGENT_SLIM_DOCUMENT.components.schemas
  const names = Object.keys(slim)
  assert.ok(names.length > 0, 'no schemas kept — the comparison below would be vacuous')
  for (const name of names) {
    assert.deepStrictEqual(
      slim[name as keyof typeof slim],
      AGENT_API_DOCUMENT.components.schemas[name as keyof typeof slim],
      `schema ${name} drifted from ${AGENT_API_DOCUMENT_PATH}`,
    )
  }
})

test('the slim document carries the task-posting flow and nothing an agent never calls', () => {
  // The projection matches its declared list, in order. This CANNOT catch a
  // path removed from that list — both sides come from the same constant — and
  // the comment here used to claim it could. What catches a removal is the
  // named exclusion below (for a path that must stay out) and the pointer case
  // that follows (for one that must stay in).
  assert.deepStrictEqual(Object.keys(AGENT_SLIM_DOCUMENT.paths), [...AGENT_SLIM_PATHS])
  // The browse surface is the weight this exists to shed. Named, so quietly
  // re-adding the feed is a failing test.
  for (const path of ['/v1/gigs', '/v1/gigs/facets', '/v1/gigs/featured']) {
    assert.ok(AGENT_API_DOCUMENT.paths[path] !== undefined, `${path} should exist canonically`)
    assert.strictEqual(AGENT_SLIM_DOCUMENT.paths[path], undefined, `${path} must not be in the slim document`)
  }
})

test('every path the slim document POINTS AT is a path it carries', () => {
  // #126 made `chain_id` shape-checked rather than enumerated and sent the
  // reader to the deployment's own list instead. If that list is not in the
  // projection, the pointer is a dead end one indirection further out — the
  // exact failure documenting the endpoint was meant to remove.
  //
  // MEASURED before this case existed: deleting `apiRoutes.platform.chains`
  // from AGENT_SLIM_PATHS left all 24 slim/drift cases green, because the
  // membership assertion above compares the document to the constant that
  // built it. The pointer is READ OUT of the description rather than restated,
  // so redirecting the text to another path checks THAT path is carried.
  // Top-level fields of each schema, which is where every pointer sits today;
  // a pointer buried in a nested object would not be seen here.
  const described = Object.values(AGENT_SLIM_DOCUMENT.components.schemas)
    .flatMap((schema) => Object.values(schema.properties ?? {}))
    .flatMap((field) => field.description?.match(/\/v1\/[\w/{}-]+/g) ?? [])
  const pointers = [...new Set(described)]
  assert.ok(pointers.length > 0, 'no schema field points at a path — #126 put a pointer on chain_id')
  // Only mentions that are actual path KEYS count. A description may name a
  // route this document does not define (`/v1/auth/verify`) or spell a
  // parameter for a human (`/v1/gigs/{task_id}` against the `{id}` template) —
  // that is prose, not a pointer into this document, and #128 tracks the one
  // case of it. What must hold is that a path this document DOES define, and
  // sends a reader to, travels with the subset.
  const canonical = new Set(Object.keys(AGENT_API_DOCUMENT.paths))
  for (const pointer of pointers.filter((path) => canonical.has(path))) {
    assert.ok(
      AGENT_SLIM_DOCUMENT.paths[pointer] !== undefined,
      `${pointer} is pointed at by a documented field but is not carried in this document`,
    )
  }
  // And the one #126 added is among them, by name.
  assert.ok(pointers.includes(apiRoutes.platform.chains), `${apiRoutes.platform.chains} is no longer pointed at`)
})

/**
 * The one that would otherwise ship the original defect under a smaller
 * payload: a `$ref` the reader cannot resolve is exactly what truncation looks
 * like from outside, and dropping a transitively-reached schema produces one.
 */
test('no $ref in the slim document dangles — the closure is complete', () => {
  const declared = new Set(Object.keys(AGENT_SLIM_DOCUMENT.components.schemas))
  const dangling = referencedNames(AGENT_SLIM_DOCUMENT).filter((name) => !declared.has(name))
  assert.deepStrictEqual(dangling, [], 'these $refs resolve to nothing in the slim document')
})

test('the 402 terms schema survives — the one the whole flow turns on', () => {
  // `AgentTaskPaymentRequired` is the body of the 402, `AgentTaskCreated` the
  // 201: the two payloads an agent cannot proceed without. MEASURED: both are
  // referenced DIRECTLY by /v1/agent/tasks (7 schemas are), so this is not a
  // closure check — the closure test above covers that. What it guards is the
  // pair surviving a reshape of that path: inlining either body, renaming
  // either schema, or dropping the 402 response leaves a document that still
  // passes every structural test here and is useless to an agent.
  assert.ok('AgentTaskPaymentRequired' in AGENT_SLIM_DOCUMENT.components.schemas)
  assert.ok('AgentTaskCreated' in AGENT_SLIM_DOCUMENT.components.schemas)
})

test('the subset POINTS AT the guarantees instead of repeating them', () => {
  // #127. x-tenda-stability is compatibility policy — what may change and how
  // you learn it — and at ~2.4 KB it was the largest single block in the one
  // document whose defining problem is size. It cost more than the whole
  // /v1/platform/chains surface #126 added. Everything in it a first call acts
  // on is structural here already, so the subset carries a pointer.
  const slim = AGENT_SLIM_DOCUMENT.info['x-tenda-stability']
  const canonical = AGENT_API_DOCUMENT.info['x-tenda-stability']
  assert.deepStrictEqual(slim.length, 1, 'the subset carries one pointer, not the policy')
  assert.ok(slim[0].includes(AGENT_API_DOCUMENT_PATH), 'the pointer must name the document that has them')
  // And the trim is the SUBSET's, not a deletion: the canonical document keeps
  // every line, which is the half of this that a reader depends on.
  assert.ok(canonical.length > 1, 'the canonical document lost its guarantees')
  for (const line of canonical) assert.ok(!slim.includes(line), `a guarantee leaked into the subset: ${line}`)
})

// ---------- the SIZE guard --------------------------------------------------

test('the slim document fits, with the headroom #109 needs for recorded examples', () => {
  const size = bytes(AGENT_SLIM_DOCUMENT)
  assert.ok(
    size < AGENT_SLIM_MAX_BYTES,
    `slim document is ${size} bytes, ceiling ${AGENT_SLIM_MAX_BYTES}`,
  )
  // And under the CANONICAL document, not merely under our own ceiling. That
  // comparison is measurable; "under the fetchers' cut" is not, because the
  // report's byte figures contradict each other.
  assert.ok(
    size < bytes(AGENT_API_DOCUMENT),
    `slim document is ${size} bytes, canonical is ${bytes(AGENT_API_DOCUMENT)}`,
  )
})

test('the CEILING itself stays below the canonical document — the guard cannot go vacuous', () => {
  // Without this the size checks are vacuous: raising AGENT_SLIM_MAX_BYTES
  // makes every assertion measured against it pass again. That mutation
  // survived the first sweep — 40_000 -> 90_000 broke nothing.
  //
  // Pinned to the CANONICAL SIZE rather than to a reviewer's byte figure. The
  // first version of this test used 41,639 and called it "where a fetcher
  // stopped"; the report's numbers turned out to disagree with each other, so
  // that basis was withdrawn. A ceiling at or above the canonical document
  // would permit a "slim" document that saves nothing, which is a claim the
  // published path would then be making falsely.
  assert.ok(
    AGENT_SLIM_MAX_BYTES < bytes(AGENT_API_DOCUMENT),
    `the ceiling is ${AGENT_SLIM_MAX_BYTES}, at or above the canonical ${bytes(AGENT_API_DOCUMENT)} — it would permit a subset that saves nothing`,
  )
})

test('it is genuinely smaller than the canonical document', () => {
  // The control: a "slim" document that kept everything would pass the ceiling
  // the day the canonical one happens to fit, and silently stop being a subset.
  assert.ok(bytes(AGENT_SLIM_DOCUMENT) < bytes(AGENT_API_DOCUMENT))
})

// ---------- the projection itself -------------------------------------------

test('slimAgentDocument follows refs to CLOSURE, not just one level', () => {
  // GigDetail reaches EscrowProof/Dispute/Review/... only through its own
  // properties, so a one-level implementation keeps GigDetail and drops them.
  const oneGigPath = slimAgentDocument(AGENT_API_DOCUMENT, ['/v1/gigs/{id}'])
  const kept = Object.keys(oneGigPath.components.schemas)
  assert.ok(kept.includes('GigDetail'), 'the directly referenced schema')
  assert.ok(kept.includes('EscrowProof'), 'reached only VIA GigDetail')
  assert.ok(kept.includes('UserRef'), 'reached only VIA GigDetail')
  const declared = new Set(kept)
  assert.deepStrictEqual(referencedNames(oneGigPath).filter((n) => !declared.has(n)), [])
})

test('slimAgentDocument refuses a path the canonical document does not have', () => {
  // A renamed or dropped path must not quietly shrink the agent's document to
  // one that omits a step of the flow.
  assert.throws(
    () => slimAgentDocument(AGENT_API_DOCUMENT, ['/v1/agent/tasks', '/v1/agent/nope']),
    /has no path\(s\) \/v1\/agent\/nope/,
  )
})

test('the metadata and security schemes ride along — a subset is still a usable document', () => {
  assert.strictEqual(AGENT_SLIM_DOCUMENT.openapi, AGENT_API_DOCUMENT.openapi)
  assert.strictEqual(AGENT_SLIM_DOCUMENT.info.version, AGENT_API_DOCUMENT.info.version)
  assert.deepStrictEqual(
    AGENT_SLIM_DOCUMENT.components.securitySchemes,
    AGENT_API_DOCUMENT.components.securitySchemes,
  )
  // It says what it is and where the whole contract lives, so a reader who
  // needs the browse surface is not left guessing.
  assert.match(AGENT_SLIM_DOCUMENT.info.description, /AGENT-ONLY SUBSET/)
  assert.match(AGENT_SLIM_DOCUMENT.info.description, /\/v1\/openapi\.json/)
})
