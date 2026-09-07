/**
 * The AGENT-ONLY document — the same contract, small enough to arrive whole.
 *
 * WHY IT EXISTS. Ten AskBots reviewers fetched `/v1/openapi.json` on
 * 2026-09-05 and every one of them stopped at the document: nobody reached the
 * task endpoint. Six of the ten described it as truncated. "Rate how usable
 * this is without asking a human" scored 5.6, the lowest of the three
 * questions, against 7.4 for clarity.
 *
 * WHERE THE CUT FALLS IS NOT KNOWABLE FROM THAT REPORT, and saying otherwise
 * cost this file two wrong docblocks. The three figures it offers disagree with
 * each other, checked against the document AS THE REVIEWERS FETCHED IT — it had
 * not changed since 2026-08-30 and measured 41,679 bytes, so those offsets are
 * the ones they saw; it has grown slightly since, which is why every number in
 * this paragraph is past tense. One reviewer says "truncated at 41639 bytes"
 * but quotes, as the text where their copy stopped, a string that sat at byte
 * 5,882; another says the capture "ends partway through ProofParams", which was
 * byte 15,831. A 41,639-byte cut of that document removed forty bytes of the
 * bearer description and NOTHING ELSE — every schema, `AgentTaskPaymentRequired`
 * included, was already present by then. These are LLM-written reports, not
 * instruments.
 *
 * So the honest claim is the weak one: the document was too long to arrive
 * whole for at least some readers, smaller is better, and no target size can be
 * derived. Their truncation is THEIR bug; it is also some fraction of 10 out of
 * 10 of the audience, so routing around it is ours.
 *
 * AND IT IS THE SECONDARY COMPLAINT. All ten answers to "could you call the
 * endpoint end to end" say no, and all ten ask for the same missing thing: the
 * real 402 terms, the real 201 body, concrete values. Length is what six of
 * them mentioned; ABSENT RUNTIME EVIDENCE is what all ten did. This document is
 * the container that makes those recorded examples fit (#109); it is not by
 * itself the answer to the score.
 *
 * WHAT IS IN IT is not a judgement call — it is the flow the reviewers
 * themselves described back to us, unprompted and near-identically: "register
 * → POST without x-payment → receive 402 terms and task_id → sign → resend the
 * same body with x-payment → receive 201 → poll GET /v1/gigs/{task_id} until
 * status open" — plus the demo door that flow needs first (#108), since a
 * reader with no wallet meets a 401 at every one of them otherwise. Those
 * paths, and the schemas they transitively reach.
 * The browse surface (`/v1/gigs`, `/facets`, `/featured`) is what an agent
 * posting work never calls, and it is most of the weight.
 *
 * AND THE RECORDED EXCHANGE (#109) — a real 402, the X-PAYMENT envelope that
 * answered it, and the 201 that came back, attached inline to the task
 * operation by ./examples. That is the complaint all ten reviewers actually
 * made, as against the six who mentioned length; this document is the container
 * that made those payloads affordable.
 *
 * DERIVED, NEVER HAND-MAINTAINED. `slimAgentDocument` picks paths out of the
 * canonical document and follows `$ref`s to closure; it authors nothing. A
 * second hand-written spec is a copy waiting to rot, and the whole complaint
 * being answered here is a document that did not match what the reader could
 * see. `/v1/openapi.json` is unchanged: complete, canonical, and honestly too
 * big for a bot — it is for humans and codegen.
 *
 * The guards are in test/unit/agent-api-slim.test.ts: every path and schema kept
 * here is byte-identical to the canonical one, no `$ref` is left dangling, the
 * serialised result stays under `AGENT_SLIM_MAX_BYTES` — and that ceiling is
 * itself pinned below the CANONICAL document's size, the one comparison that is
 * actually measurable. Without that last guard the size checks are vacuous:
 * raising the constant makes every assertion measured against it pass again.
 * That mutation survived the first sweep, which is why the pin is named here
 * rather than left as a number someone could quietly move.
 */
import { apiRoutes } from '@tenda/shared'
import { AGENT_API_DOCUMENT, AGENT_API_DOCUMENT_PATH, AGENT_API_POST, type OpenApiDocument } from './openapi'
import { withRecordedExamples } from './examples'
import { COMPONENT_REF_PREFIX, type ComponentName, type SchemaObject } from './schema-types'
import type { PathItem } from './paths'

/** Where the slim document is served. */
export const AGENT_SLIM_DOCUMENT_PATH = '/v1/agent/openapi.json'

/**
 * The paths an agent needs to post one task and watch it land, in the order
 * the flow runs. NAMED rather than pattern-matched on `/v1/agent/`, because TWO
 * of them sit outside that prefix — `/v1/platform/chains`, which says what this
 * deployment settles on, and `/v1/gigs/{id}`, the polling step every reviewer
 * described — and a prefix rule would silently drop both.
 */
export const AGENT_SLIM_PATHS = [
  // The two DOORS first, and they are alternatives, not steps: the demo bearer
  // for a reader with no wallet (#108), or registration for one who has a key.
  // The task POST answers 401 until one of them has been used; the two reads
  // below it need no bearer at all, which is why they can come after.
  apiRoutes.agent.demoSession,
  // The nonce comes BEFORE registration because registration cannot be
  // attempted without it: its body carries a message signed over one (#130).
  // Leaving it out is what made the wallet door undocumented while the
  // keyless one worked — the subset described the second step of a flow whose
  // first step it never defined, and a reviewer stopped there on 2026-09-07.
  apiRoutes.auth.nonce,
  apiRoutes.agent.register,
  // Signing an EXISTING agent back in. Last of the doors because it is the
  // only one a first-time reader does not need, and the only one registration
  // itself points forward to.
  apiRoutes.auth.verify,
  // Then the CHOICE, before the post that depends on it: `chain_id` on the task
  // body is shape-checked and NOT enumerated (#126) and `asset` is a bare
  // string, so a document that cannot know which chains a deployment settles on
  // has to carry the endpoint that does — or the reader it was written for is
  // left guessing the two fields the whole post turns on.
  apiRoutes.platform.chains,
  apiRoutes.agent.tasks,
  // The document spells a path parameter the OpenAPI way and the route map the
  // Fastify way — the same transform ./paths applies to build the key it is
  // looked up by. Spelled from the shared map like every sibling in this
  // directory, and not as a literal: a renamed route would otherwise leave the
  // strings here matching nothing, and since AGENT_SLIM_DOCUMENT is built at
  // module load the first symptom would be a server that does not boot.
  apiRoutes.gigs.get.replace(':id', '{id}'),
] as const

/**
 * The ceiling — A POLICY NUMBER, not a measurement, and labelled as one because
 * the first version of this comment claimed otherwise.
 *
 * It cannot be derived: see the note above on why the reviewers' byte figures
 * contradict each other. What it can do is stop the document drifting back
 * toward the size that caused the complaint.
 *
 * RAISED ONCE, 2026-09-07, from 40,000 (#130). The instruction this comment
 * used to carry — treat a size failure as a prompt to remove weight, the room
 * being `x-tenda-stability` — was followed and then spent: #127 took that
 * ~2.4 KB, and the projection sat ~1.4 KB under the ceiling with nothing left
 * to trim. What arrived next was not weight but a MISSING step: a reviewer
 * with a wallet could not authenticate, because registration named
 * /v1/auth/nonce and /v1/auth/verify and neither document defined them. Two
 * operations do not fit in 1.4 KB, and no trim creates that room without
 * deleting something a reader needs.
 *
 * So the trade was made the other way round, deliberately and on the record: a
 * document a few KB larger is a far cheaper failure than a document an agent
 * cannot start from. The ceiling still binds — it is still checked, and still
 * pinned below the canonical document by the guard below, which is the
 * property that stops it going vacuous.
 *
 * The current sizes are DELIBERATELY not spelled out here. Both live figures
 * this comment used to carry went stale within two days of being written, once
 * when the examples landed and once when a field gained a description; they are
 * measured by agent-api-slim.test.ts, which is where a number that must stay
 * true belongs.
 *
 * The guard that matters is not this number but the test that the number stays
 * below the canonical document's size. Without it the size checks are vacuous —
 * raising this constant makes every assertion measured against it pass again,
 * which a mutation sweep proved by moving it to 90,000 and breaking nothing.
 * If the document is ever shown to need to be smaller, lower this; it is meant
 * to be moved deliberately and never quietly.
 */
export const AGENT_SLIM_MAX_BYTES = 46_000

/** Every `$ref` target named anywhere inside a value, at any depth. */
function refsIn(value: unknown, found: Set<ComponentName>): void {
  if (Array.isArray(value)) {
    for (const item of value) refsIn(item, found)
    return
  }
  if (typeof value !== 'object' || value === null) return
  for (const [key, child] of Object.entries(value)) {
    if (key === '$ref' && typeof child === 'string' && child.startsWith(COMPONENT_REF_PREFIX)) {
      found.add(child.slice(COMPONENT_REF_PREFIX.length) as ComponentName)
      continue
    }
    refsIn(child, found)
  }
}

/**
 * The schemas the given paths reach, to CLOSURE — a schema that refs another
 * pulls it in too.
 *
 * The closure is the whole correctness argument. Keeping only the names the
 * paths mention directly would leave `$ref`s pointing at schemas the reader
 * cannot resolve, which is precisely what a truncated document looks like from
 * the outside: this would have shipped the same failure under a smaller
 * payload. `agent-api-slim.test.ts` asserts no dangling ref survives.
 */
function reachableSchemas(
  paths: Readonly<Record<string, PathItem>>,
  schemas: Readonly<Record<ComponentName, SchemaObject>>,
): Set<ComponentName> {
  const reached = new Set<ComponentName>()
  refsIn(paths, reached)
  // Fixed point: each newly reached schema may name more.
  for (let frontier = [...reached]; frontier.length > 0; ) {
    const next = new Set<ComponentName>()
    for (const name of frontier) refsIn(schemas[name], next)
    frontier = [...next].filter((name) => !reached.has(name))
    for (const name of frontier) reached.add(name)
  }
  return reached
}

/**
 * The agent-only projection of a document. Pure, and takes the document as a
 * parameter so the guards can run it over a fixture as well as over the real
 * one.
 *
 * Values are carried across by REFERENCE, never rebuilt — that is what makes
 * "byte-identical to the canonical document" true by construction rather than
 * by a copy someone has to keep in step.
 */
export function slimAgentDocument(
  doc: OpenApiDocument,
  keep: readonly string[] = AGENT_SLIM_PATHS,
): OpenApiDocument {
  const missing = keep.filter((path) => doc.paths[path] === undefined)
  if (missing.length > 0) {
    // A renamed or dropped path must not quietly shrink the agent's document
    // to one that omits the step. Loud at import, like the manifest guards.
    throw new Error(`slimAgentDocument: canonical document has no path(s) ${missing.join(', ')}`)
  }
  const paths = Object.fromEntries(keep.map((path) => [path, doc.paths[path]]))
  const reached = reachableSchemas(paths, doc.components.schemas)
  const schemas = Object.fromEntries(
    // Canonical order, not discovery order: the slim document should read as a
    // subsequence of the one it came from.
    Object.keys(doc.components.schemas)
      .filter((name) => reached.has(name as ComponentName))
      .map((name) => [name, doc.components.schemas[name as ComponentName]]),
  ) as Record<ComponentName, SchemaObject>

  return {
    ...doc,
    info: {
      ...doc.info,
      // #127. The guarantees are COMPATIBILITY policy — what may change and how
      // you learn it — and they cost ~2.4 KB in the one document whose defining
      // problem is size. Everything in them that a first call acts on is already
      // structural here: who may call what is the security scheme, the one-shot
      // is the operation description, the refusal shapes are the responses, and
      // the chain rule is the chain_id description plus the 422. So this carries
      // a pointer and the canonical document keeps the text, which is the split
      // the two documents exist for.
      'x-tenda-stability': [
        `Compatibility guarantees are not repeated in this subset — read x-tenda-stability at ${AGENT_API_DOCUMENT_PATH} before depending on this contract.`,
      ],
      // NOT `doc.info.description` (#136): that line promises the public feed,
      // and this document carries no feed. The subset says what IT does — the
      // post, and the read-back of the task it posted — from the same half the
      // canonical line is built from, so the two cannot describe the post
      // differently.
      description:
        `The gig surface of Tenda for agents: ${AGENT_API_POST}, and read the task back with the proof it will demand. ` +
        `THIS IS THE AGENT-ONLY SUBSET: the task-posting flow ` +
        `(${AGENT_SLIM_PATHS.join(', ')}) and every schema those reach, published separately ` +
        `so a reader that cannot take the whole contract at once can still take this. ` +
        `The complete contract is at ${AGENT_API_DOCUMENT_PATH}.`,
    },
    paths,
    components: { ...doc.components, schemas },
  }
}

/**
 * The served document: the projection above, plus the RECORDED 402/201
 * exchange attached inline (#109).
 *
 * The examples are the answer to the complaint all ten reviewers actually
 * made — that they never saw a payload — and this is the only document that
 * carries them, for the reason in ./examples. Everything else here is
 * untouched, so the drift guard still holds every path and schema against the
 * canonical one.
 */
export const AGENT_SLIM_DOCUMENT: OpenApiDocument = withRecordedExamples(slimAgentDocument(AGENT_API_DOCUMENT))
