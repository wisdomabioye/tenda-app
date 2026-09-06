/**
 * RECORDED examples, attached inline to the slim agent document (#109).
 *
 * WHY THEY EXIST. Ten reviewers read this contract on 2026-09-05 and all ten
 * reported the same thing: they never called the endpoint, and the document
 * showed them no payload to reason about. It contained zero `example` keys —
 * measured, not estimated. That was the single most-repeated complaint in the
 * round, ahead of length.
 *
 * WHY THEY ARE RECORDED AND NOT WRITTEN. A hand-written sample is a second
 * implementation of the wire, and it begins drifting from the first the day it
 * is committed — which is the failure this whole document exists to avoid. The
 * values in ./recorded-exchange came out of one real exchange driven through
 * the real route against a real node, and
 * test/integration/agent-x402-recording.anvil.test.ts re-drives that exchange
 * on every run and fails when the shape no longer matches. The examples cannot
 * quietly rot; they can only fail loudly.
 *
 * WHY INLINE AND NEVER `$ref`. A reader whose fetch stops early must meet the
 * payload beside the endpoint, not in a tail it never reaches. That is also
 * why they go only in the SLIM document: the canonical one is for humans and
 * codegen, and every byte added there makes it more complete and less readable
 * to exactly the audience that complained.
 *
 * WHAT THE VALUES ARE. A real EIP-3009 authorization over a real ERC-20's own
 * domain separator, a nonce the escrow contract itself computed, and a
 * transaction the relayer really broadcast — captured on a local node that
 * presents itself as eip155:84532.
 *
 * TWO OF THE PUBLISHED VALUES ARE THE HARNESS'S, and they are named here rather
 * than left for a reader to trip over. The ADDRESSES are that node's, so they
 * are not Base Sepolia contracts anyone can look up. And `created.enqueued` is
 * FALSE, which is the degraded answer, not the normal one: the recorder runs
 * with no Redis (test/helpers/test-app/env.ts deletes REDIS_URL), so the
 * verify-tx enqueue throws and `recordTxAttempt` reports it — a deployment with
 * a queue answers true. Either way the attempt is durably recorded and the task
 * is verified, which is what the field's own description in the document now
 * says. Everything else — every shape, and every value the server derived
 * rather than the harness chose — is what production sends.
 */
import type { AgentTaskBody, AgentTaskCreated, AgentTaskPaymentRequired, RelayPaymentPayload, RelaySettlementResponse } from '@tenda/shared'
import { X_PAYMENT_HEADER, apiRoutes } from '@tenda/shared'
import { JSON_MEDIA_TYPE, type ExampleValue, type HttpStatus, type JsonContent, type OperationObject, type ResponseObject } from './paths'
import { RECORDED_EXCHANGE } from './recorded-exchange'
import type { OpenApiDocument } from './openapi'

/**
 * One captured one-shot, in the order it happened. Typed against the SHARED
 * wire types on purpose: the recording is checked by the compiler as well as
 * by its suite, so a renamed or removed field cannot be published — the build
 * breaks before anything is served.
 */
export interface RecordedExchange {
  /** The body posted, both times. */
  request: AgentTaskBody
  /** What came back with no X-PAYMENT header. */
  payment_required: AgentTaskPaymentRequired
  /** The envelope the resend carried, before base64. */
  payment_envelope: RelayPaymentPayload
  /** What came back on the resend. */
  created: AgentTaskCreated
  /** The decoded x-payment-response header of that resend. */
  settlement: RelaySettlementResponse
}

/**
 * A wire value as an inline example.
 *
 * The round trip is not a type escape: it is what serialisation does to the
 * value on the way out, so anything that would not survive being sent (an
 * `undefined`, a Date, a bigint) is either dropped here or throws here rather
 * than reaching a reader. The single cast is the JSON boundary, where the
 * checker has nothing left to go on.
 */
function asExample(value: object): ExampleValue {
  return JSON.parse(JSON.stringify(value)) as ExampleValue
}

/** The base64 an agent actually puts in the header, from the envelope beside it. */
export function recordedPaymentHeader(): string {
  return Buffer.from(JSON.stringify(RECORDED_EXCHANGE.payment_envelope)).toString('base64')
}

/**
 * The same media-type object with the recorded value beside its `$ref`. The
 * `schema` is carried through untouched, so the drift guard still compares it
 * against the canonical document.
 */
function withExample(content: JsonContent, value: object): JsonContent {
  return { [JSON_MEDIA_TYPE]: { ...content[JSON_MEDIA_TYPE], example: asExample(value) } }
}

/** One documented response with its recorded body, or nothing if it has no JSON content. */
function recordedResponse(
  responses: OperationObject['responses'],
  status: HttpStatus,
  value: object,
): Readonly<Record<string, ResponseObject>> {
  const response = responses[status]
  if (response?.content === undefined) return {}
  return { [status]: { ...response, content: withExample(response.content, value) } }
}

/** The POST /v1/agent/tasks operation with its request, 402 and 201 recorded. */
function taskOperation(post: OperationObject): OperationObject {
  return {
    ...post,
    ...(post.parameters !== undefined
      ? {
          parameters: post.parameters.map((parameter) =>
            parameter.name === X_PAYMENT_HEADER
              ? { ...parameter, example: recordedPaymentHeader() }
              : parameter,
          ),
        }
      : {}),
    ...(post.requestBody !== undefined
      ? { requestBody: { ...post.requestBody, content: withExample(post.requestBody.content, RECORDED_EXCHANGE.request) } }
      : {}),
    responses: {
      ...post.responses,
      ...recordedResponse(post.responses, '402', RECORDED_EXCHANGE.payment_required),
      ...recordedResponse(post.responses, '201', RECORDED_EXCHANGE.created),
    },
  }
}

/**
 * The slim document with the recorded exchange attached. Everything else is
 * carried through by reference, so the drift guard still compares the rest of
 * each path against the canonical document byte for byte.
 */
export function withRecordedExamples(doc: OpenApiDocument): OpenApiDocument {
  const tasks = doc.paths[apiRoutes.agent.tasks]
  if (tasks?.post === undefined) return doc
  return {
    ...doc,
    paths: { ...doc.paths, [apiRoutes.agent.tasks]: { ...tasks, post: taskOperation(tasks.post) } },
  }
}
