/**
 * Recording `fetch` double, for the outbound HTTP this server does.
 *
 * Two suites had grown their own copy — lib/slack's transport tests and the
 * Slack alert channel's — and the second was written by copying the first, so
 * they also shared its one flaw.
 *
 * That flaw: both returned an object LITERAL asserted `as Response`. Two
 * problems with it. `ok` and `status` were independently settable, so a fixture
 * could describe `{ ok: true, status: 500 }` — a response that cannot exist,
 * and a test written against it proves nothing about real behaviour. And the
 * assertion is a claim the compiler cannot check: a partial stand-in passes
 * until the code under test reaches for a field nobody stubbed, which surfaces
 * as `undefined is not a function` somewhere unrelated.
 *
 * This returns a REAL `Response`. `ok` derives from `status` the way the
 * platform derives it, every other member genuinely exists, and no cast is
 * needed anywhere.
 */

/** Captured once at module load, before any test can replace it. */
const realFetch = globalThis.fetch

export interface CapturedRequest {
  url: string
  init: RequestInit
}

export interface StubResponse {
  /** `ok` is DERIVED from this, never set beside it. */
  status: number
  body?: string
  /**
   * Make reading the body fail — a connection dropped mid-response, which is
   * how the transport's error path can be reached without a readable reason.
   */
  bodyUnreadable?: boolean
}

/** A body whose stream is already errored, so `.text()` rejects. */
function unreadableBody(): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.error(new Error('stream closed'))
    },
  })
}

/**
 * Replace `fetch` with one that records every call and answers with `res`.
 * Returns the array it records into — it fills as calls arrive.
 *
 * Callers must `restoreFetch()` afterwards, normally in an `afterEach`.
 */
export function stubFetch(res: StubResponse = { status: 200 }): CapturedRequest[] {
  const calls: CapturedRequest[] = []
  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init: init ?? {} })
    return new Response(res.bodyUnreadable === true ? unreadableBody() : (res.body ?? ''), {
      status: res.status,
    })
  }
  return calls
}

/**
 * Replace `fetch` with one that REJECTS — a DNS failure, a refused connection,
 * an abort. Distinct from a non-2xx: the transport's contract says those two
 * surface differently, so a caller that only handles one is only half guarded.
 */
export function stubFetchRejecting(error: Error): void {
  globalThis.fetch = async () => {
    throw error
  }
}

export function restoreFetch(): void {
  globalThis.fetch = realFetch
}
