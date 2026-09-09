/**
 * Sending a documented request for real, from the page that documents it.
 *
 * The whole flow an agent has to trust is a 402 and a resend, and every
 * reviewer who evaluated this API asked to SEE that exchange. The recorded
 * examples answer it on paper; this answers it live, against whichever
 * deployment the build points at.
 *
 * NO WALLET IS NEEDED. A bearer-scoped operation mints one first from
 * `POST /v1/agent/demo-session`, the keyless demo credential the API already
 * publishes for exactly this reader. The console therefore never asks for a
 * key and never holds one.
 *
 * Kept out of the component so it can be driven by a test with a fake fetch:
 * a console whose only proof is a screenshot is the kind that breaks quietly.
 */
import { apiRoutes } from '@tenda/shared/api-routes'
import type { ExampleValue, OperationObject } from '@tenda/api-doc'
import { asRecord } from './sample'

export interface RunResult {
  status: number
  /** Round trip in milliseconds, rounded — the 402 is fast and it is worth seeing. */
  ms: number
  body: ExampleValue
}

export interface RunFailure {
  /** What to do about it, not just what broke. */
  message: string
}

export type RunOutcome = { ok: true; result: RunResult } | { ok: false; failure: RunFailure }

/** A path the console can send as it stands — one with no `{param}` left to fill. */
export function isRunnable(path: string): boolean {
  return !path.includes('{')
}

/** Does this operation demand a token? `security` absent means anonymous. */
const needsBearer = (operation: OperationObject): boolean => (operation.security ?? []).length > 0

async function readJson(response: Response): Promise<ExampleValue> {
  const text = await response.text()
  if (text === '') return null
  try {
    return JSON.parse(text) as ExampleValue
  } catch {
    // A proxy or an error page can answer HTML; show it rather than throwing.
    return text
  }
}

/**
 * Run one documented operation.
 *
 * `fetchImpl` and `now` are parameters so the whole thing is testable without
 * a network or a clock.
 */
export async function runOperation(args: {
  api: string
  method: 'GET' | 'POST'
  path: string
  operation: OperationObject
  fetchImpl?: typeof fetch
  now?: () => number
}): Promise<RunOutcome> {
  const { api, method, path, operation } = args
  const send = args.fetchImpl ?? fetch
  const clock = args.now ?? (() => Date.now())
  const started = clock()

  try {
    const headers: Record<string, string> = { accept: 'application/json' }

    if (needsBearer(operation)) {
      const session = await send(`${api}${apiRoutes.agent.demoSession}`, { method: 'POST' })
      const minted = asRecord(await readJson(session))
      const token = typeof minted?.token === 'string' ? minted.token : null
      if (token === null) {
        return {
          ok: false,
          failure: {
            message: `The demo session at ${apiRoutes.agent.demoSession} answered ${session.status} with no token, so there is nothing to authorise with.`,
          },
        }
      }
      headers.authorization = `Bearer ${token}`
    }

    const example = operation.requestBody?.content['application/json'].example
    if (method === 'POST' && example !== undefined) headers['content-type'] = 'application/json'

    const response = await send(`${api}${path}`, {
      method,
      headers,
      body: method === 'POST' && example !== undefined ? JSON.stringify(example) : undefined,
    })

    return {
      ok: true,
      result: { status: response.status, ms: Math.round(clock() - started), body: await readJson(response) },
    }
  } catch {
    // A cross-origin refusal reaches the browser as a bare network error, so
    // the message names the likeliest cause rather than saying "failed".
    return {
      ok: false,
      failure: {
        message: `Could not reach ${api}. If it is deployed, it needs to allow this origin (CORS); if it is local, check the server is running.`,
      },
    }
  }
}
