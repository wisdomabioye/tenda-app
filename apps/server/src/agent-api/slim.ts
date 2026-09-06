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
 * each other, checked against the document itself (unchanged since 2026-08-30,
 * so the offsets are the ones the reviewers saw): one reviewer says "truncated
 * at 41639 bytes" but quotes, as the text where their copy stopped, a string
 * that sits at byte 5,882; another says the capture "ends partway through
 * ProofParams", which is byte 15,831. A 41,639-byte cut of a 41,679-byte
 * document removes forty bytes of the bearer description and NOTHING ELSE —
 * every schema, `AgentTaskPaymentRequired` included, is already present by then.
 * These are LLM-written reports, not instruments.
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
 * status open". Those three paths, and the schemas they transitively reach.
 * The browse surface (`/v1/gigs`, `/facets`, `/featured`) is what an agent
 * posting work never calls, and it is most of the weight.
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
import { AGENT_API_DOCUMENT, AGENT_API_DOCUMENT_PATH, type OpenApiDocument } from './openapi'
import { COMPONENT_REF_PREFIX, type ComponentName, type SchemaObject } from './schema-types'
import type { PathItem } from './paths'

/** Where the slim document is served. */
export const AGENT_SLIM_DOCUMENT_PATH = '/v1/agent/openapi.json'

/**
 * The paths an agent needs to post one task and watch it land, in the order
 * the flow runs. Named here rather than pattern-matched on `/v1/agent/`
 * because `/v1/gigs/{id}` belongs to the flow and does not match, and a
 * prefix rule would silently drop it — the polling step every reviewer
 * described.
 */
export const AGENT_SLIM_PATHS = [
  '/v1/agent/register',
  '/v1/agent/tasks',
  '/v1/gigs/{id}',
] as const

/**
 * The ceiling — A POLICY NUMBER, not a measurement, and labelled as one because
 * the first version of this comment claimed otherwise.
 *
 * It cannot be derived: see the note above on why the reviewers' byte figures
 * contradict each other. What it can do is stop the document drifting back
 * toward the size that caused the complaint. 40,000 sits below the canonical
 * document (41,679) with room for `#109`'s recorded 402/201 examples to land in
 * the ~8.7KB between here and today's 31,239.
 *
 * The guard that matters is not this number but the test that the number stays
 * below the canonical document's size. Without it the size checks are vacuous —
 * raising this constant makes every assertion measured against it pass again,
 * which a mutation sweep proved by moving it to 90,000 and breaking nothing.
 * If the document is ever shown to need to be smaller, lower this; it is meant
 * to be moved deliberately and never quietly.
 */
export const AGENT_SLIM_MAX_BYTES = 40_000

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
      description:
        `${doc.info.description} THIS IS THE AGENT-ONLY SUBSET: the task-posting flow ` +
        `(${AGENT_SLIM_PATHS.join(', ')}) and every schema those reach, published separately ` +
        `so a reader that cannot take the whole contract at once can still take this. ` +
        `The complete contract is at ${AGENT_API_DOCUMENT_PATH}.`,
    },
    paths,
    components: { ...doc.components, schemas },
  }
}

/** The served document. */
export const AGENT_SLIM_DOCUMENT: OpenApiDocument = slimAgentDocument(AGENT_API_DOCUMENT)
