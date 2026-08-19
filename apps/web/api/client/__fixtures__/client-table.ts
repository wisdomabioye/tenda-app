/**
 * Harness for the endpoint-description suites in `api/client/__tests__`.
 *
 * Each of those modules is a table of "verb + route constant + what to pass
 * through", and that is precisely the kind of code that drifts from the server
 * without anything noticing — the `/v1/fiat/bank-accounts` vs
 * `/v1/bank-accounts` mistake was caught by hand during #19. So the suites
 * assert the exact `request(...)` call rather than a response shape.
 *
 * WHAT THIS LAYER DOES NOT OWN: turning `/v1/gigs/:id` plus `{ id }` into a
 * URL. That is `request`'s job and `api/__tests__/request.test.ts` proves it
 * (params substituted, arrays comma-joined, null/undefined dropped). Asserting
 * it again here would test the same code twice and pin nothing new.
 */
import { expect } from 'vitest'
import { apiRoutes } from '@tenda/shared'

/** Every route constant the client may legitimately reach for. */
const KNOWN_PATHS = new Set(
  Object.values(apiRoutes).flatMap((group) => Object.values(group as Record<string, string>)),
)

export interface ClientCase {
  /** What the method is for, in the failure message. */
  readonly name: string
  /** Invoke the client method. */
  readonly call: () => Promise<unknown>
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  readonly path: string
  /** The options object, omitted when the method passes none. */
  readonly options?: Record<string, unknown>
}

/**
 * Assert one case, plus the invariant that holds for every one of them: the
 * path came from `apiRoutes`. A hand-typed string type-checks happily, serves
 * nothing, and only shows up when a client 404s — which is the same hole the
 * server's `api-routes-drift` suite closes from its side.
 */
export async function expectClientCall(
  requestMock: { mock: { calls: unknown[][] } },
  testCase: ClientCase,
): Promise<void> {
  await testCase.call()
  const expected =
    testCase.options === undefined
      ? [testCase.method, testCase.path]
      : [testCase.method, testCase.path, testCase.options]
  expect(requestMock.mock.calls.at(-1), testCase.name).toEqual(expected)
  expect(KNOWN_PATHS.has(testCase.path), `${testCase.name}: path is not in apiRoutes`).toBe(true)
}
