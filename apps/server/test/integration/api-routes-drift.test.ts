/**
 * `apiRoutes` ↔ the server's actual route table.
 *
 * The mapped type over `ApiContract` already makes a contract endpoint with no
 * path impossible to compile. It cannot check the path is CORRECT: the values
 * are plain strings, so `/v1/gig/:id/applications` (singular) type-checks
 * happily, serves nothing, and only shows up when a client 404s in production.
 *
 * Integration tests do not close this either — they use literal URLs, so a
 * typo'd constant and a working route coexist quite comfortably.
 *
 * This walks every declared path and asserts the server answers it on some
 * method. Gated on TEST_DATABASE_URL because it needs the real app.
 *
 * The second half of the file (#115) does the same job for the paths `apiRoutes`
 * cannot describe — the provider webhooks, the ops endpoints and the admin
 * dashboard API — and, in the other direction, refuses any path that nothing
 * declares at all. See the note above NON_CONTRACT_PATHS for why the filesystem
 * makes that necessary.
 *
 * The OTHER half of this subject is test/unit/route-autoload.test.ts, which
 * asserts no file beside a routes index.ts is left unregistered. Between them:
 * that one says every module is wired in, this one says every module is wired in
 * WHERE IT CLAIMS TO BE.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { apiRoutes } from '@tenda/shared'
import { TEST_DB_CONFIGURED, useTestApp } from '../helpers/test-app'

const skip = !TEST_DB_CONFIGURED
const getApp = useTestApp()

/**
 * The method lives in the contract TYPE, which is erased at runtime, so the
 * path is probed against every verb the API uses. Serving the path on any of
 * them is what distinguishes a real route from a typo.
 */
const METHODS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'] as const

function declaredPaths(): Array<{ key: string; path: string }> {
  const out: Array<{ key: string; path: string }> = []
  for (const [domain, endpoints] of Object.entries(apiRoutes)) {
    for (const [name, path] of Object.entries(endpoints)) {
      out.push({ key: `${domain}.${name}`, path })
    }
  }
  return out
}

test('every apiRoutes path is served by a registered route', { skip }, async () => {
  const app = getApp()
  const missing = declaredPaths().filter(
    ({ path }) => !METHODS.some((method) => app.hasRoute({ method, url: path })),
  )
  assert.deepStrictEqual(
    missing,
    [],
    `apiRoutes entries with no route behind them:\n${missing
      .map((m) => `  ${m.key} → ${m.path}`)
      .join('\n')}`,
  )
})

// Guards the guard: if `hasRoute` ever stopped discriminating, the assertion
// above would pass vacuously and this whole file would be theatre.
test('the check actually discriminates — a typo is not served', { skip }, async () => {
  const app = getApp()
  assert.strictEqual(
    METHODS.some((method) => app.hasRoute({ method, url: '/v1/gig/:id/applications' })),
    false,
  )
  assert.ok(declaredPaths().length > 40, 'the map should be substantial, not empty')
})

// ---------------------------------------------------------------------------
// The half `apiRoutes` cannot see (#115)
// ---------------------------------------------------------------------------

/**
 * Every path this server serves that NO client contract declares.
 *
 * WHY A LITERAL LIST. A route's URL is a function of the FILESYSTEM:
 * @fastify/autoload gives a DIRECTORY its name as a prefix, while a bare FILE
 * inherits only its parent's. Nothing in a route module's source says where it
 * will be mounted, so a module can end up served at a path nobody documented
 * and the only symptom is a 404 for whoever calls the documented one. That has
 * happened twice — `blockchain/transaction.ts` (the client-ping) and
 * `webhooks/helius.ts` (#106) — and both times the fix was an index.ts and a
 * hand-written test for that one directory.
 *
 * The case above closes this for the client surface, because `apiRoutes` is
 * what our clients call. It closes nothing for the surfaces they do not: the
 * provider webhooks, the ops endpoints, and the whole admin dashboard API.
 * Those are exactly the paths where a 404 is quietest — a webhook provider
 * retries into a void, and nobody is watching /v1/health until it matters.
 *
 * BOTH DIRECTIONS ARE ASSERTED, and the second is the one that makes this
 * self-enforcing. A list alone would only catch a path that DISAPPEARS; someone
 * adding a new non-client route has no reason to discover this file. Asserting
 * that nothing is served OUTSIDE `apiRoutes ∪ this list` means their new route
 * fails the suite at the URL it actually landed on, which is both the
 * introduction to this list and — when the URL is not the one they meant — the
 * bug report.
 *
 * Measured from the real route table, not transcribed from the tree.
 */
const NON_CONTRACT_PATHS = [
  // Provider webhooks. Operators point third-party dashboards at these, so the
  // URL is a published integration contract with no client code behind it —
  // docs/production_setup_guide.md §4.5 is where an operator is told to enter
  // the Helius one, and the others are configured the same way.
  '/v1/webhooks/alchemy',
  '/v1/webhooks/helius',
  '/v1/webhooks/onrampmoney',
  '/v1/webhooks/yellowcard',

  // Ops. The platform's liveness/readiness probes and the realtime socket.
  '/v1/health',
  '/v1/health/ready',
  '/v1/ws',

  // The admin dashboard API. Not in `apiRoutes` because that map types the
  // mobile/web contract; the dashboard keeps its OWN map in
  // apps/admin/api/routes.ts, which this package cannot import — so from the
  // server's side these paths are undeclared, and a directory move here would
  // break the dashboard with nothing in this repo noticing. Checked while
  // writing this list: every path in that map is served today.
  '/v1/admin/announcements',
  '/v1/admin/announcements/:id',
  '/v1/admin/disputes',
  '/v1/admin/disputes/:id',
  '/v1/admin/disputes/:id/claim',
  '/v1/admin/disputes/:id/release',
  '/v1/admin/disputes/:id/resolution',
  '/v1/admin/escrows',
  '/v1/admin/escrows/:id',
  '/v1/admin/escrows/:id/dossier',
  '/v1/admin/escrows/:id/hidden',
  '/v1/admin/featured',
  '/v1/admin/featured/:id',
  '/v1/admin/fiat/intents',
  '/v1/admin/fiat/intents/:id',
  '/v1/admin/fiat/intents/:id/force-settle',
  '/v1/admin/fiat/intents/:id/refund',
  '/v1/admin/fiat/providers',
  '/v1/admin/fiat/providers/:id',
  '/v1/admin/finance/fees',
  '/v1/admin/finance/transactions',
  '/v1/admin/metrics',
  '/v1/admin/moderation/verdicts',
  '/v1/admin/moderation/verdicts/:id/override',
  '/v1/admin/platform-config',
  '/v1/admin/push/broadcast',
  '/v1/admin/reports',
  '/v1/admin/reports/:id',
  '/v1/admin/resolutions',
  '/v1/admin/resolutions/:id/broadcast',
  '/v1/admin/resolutions/:id/execute-build',
  '/v1/admin/resolutions/:id/reject',
  '/v1/admin/standing/:user_id',
  '/v1/admin/standing/:user_id/override',
  '/v1/admin/users',
  '/v1/admin/users/:id',
  '/v1/admin/users/:id/login-email',
  '/v1/admin/users/:id/role',
  '/v1/admin/users/:id/status',
  '/v1/auth/admin/send-email-otp',
  '/v1/auth/admin/verify-email-otp',

  // Served, and no caller found in web, mobile or admin — the announcements
  // feed reaches the clients folded into GET /v1/notifications, and the
  // per-escrow transaction list has no client route map entry anywhere. Listed
  // here so the set is complete; whether they should be in `apiRoutes`, or gone,
  // is #120 rather than a decision this file makes.
  '/v1/announcements',
  '/v1/escrows/:id/transactions',
] as const

/**
 * Every URL the app actually serves, from its own route table.
 *
 * `printRoutes` is the only public view of the table — fastify keeps the radix
 * tree private — so its TREE is parsed back into full paths: each line carries
 * one segment, its depth is the glyph prefix's width, and a line carrying
 * `(GET, POST, …)` is a real endpoint rather than an intermediate node. The
 * trailing `/` fastify prints for a prefixed plugin's own root is dropped, so
 * `/v1/gigs/` and `/v1/gigs` are one path.
 *
 * THE FORMAT IS READ FROM THE PRODUCER, not inferred from one sample:
 * find-my-way 9.5.0's lib/pretty-print.js emits a 4-character prefix per level
 * (`├── `/`└── ` for the node, `│   `/`    ` for its ancestors) and appends
 * ` (${methods})` to a leaf, merging verbs with ', '. It can append MORE after
 * that — a JSON blob when a route carries constraints — which is why the methods
 * group is not anchored to the end of the line. Anchoring it would make a
 * constrained route vanish from this set silently, and a guard that goes quiet
 * is the failure this whole file exists to prevent.
 *
 * A parser is a thing that can silently return nothing, which would make both
 * cases below pass vacuously — the case after them is what stops that.
 */
function servedPaths(app: ReturnType<typeof getApp>): Set<string> {
  const stack: string[] = []
  const urls = new Set<string>()
  for (const line of app.printRoutes({ commonPrefix: false }).split('\n')) {
    const parsed = /^([│├└─\s]*)(.*)$/.exec(line)
    if (parsed === null || parsed[2] === '') continue
    const depth = Math.floor(parsed[1].length / 4)
    const endpoint = /^(.*?) \((?:[A-Z, ]+)\)/.exec(parsed[2])
    stack.length = depth
    stack[depth] = endpoint === null ? parsed[2] : endpoint[1]
    if (endpoint === null) continue
    const url = stack.join('')
    urls.add(url.length > 1 && url.endsWith('/') ? url.slice(0, -1) : url)
  }
  return urls
}

test('every non-client path is served too — webhooks, ops and the admin API', { skip }, async () => {
  const served = servedPaths(getApp())
  const missing = NON_CONTRACT_PATHS.filter((path) => !served.has(path))
  assert.deepStrictEqual(
    missing,
    [],
    `these paths are declared here but the server serves nothing at them.\n` +
      `A route module's URL comes from its position in src/routes, so this is\n` +
      `what a file/directory move looks like from the outside:\n  ${missing.join('\n  ')}`,
  )
})

test('nothing is served at a path neither the contract nor this file declares', { skip }, async () => {
  const declared = new Set<string>([...declaredPaths().map((d) => d.path), ...NON_CONTRACT_PATHS])
  const unexpected = [...servedPaths(getApp())].filter((path) => !declared.has(path)).sort()
  assert.deepStrictEqual(
    unexpected,
    [],
    `the server serves these, and nothing declares them:\n  ${unexpected.join('\n  ')}\n` +
      `If that is the URL you intended, add it to apiRoutes (client-facing) or to\n` +
      `NON_CONTRACT_PATHS above. If it is NOT, @fastify/autoload has mounted your\n` +
      `module somewhere you did not expect — a bare FILE takes its parent's prefix,\n` +
      `only a DIRECTORY contributes its own name.`,
  )
})

// Guards the two cases above: both compare against `servedPaths`, and a parser
// that returned an empty set would make each of them pass while asserting
// nothing at all.
test('the route-table parse produces real, whole paths', { skip }, async () => {
  const served = servedPaths(getApp())
  assert.ok(served.size > declaredPaths().length, `parsed ${served.size} paths`)
  // A deep, parameterised path: it can only be assembled by walking the tree,
  // so its presence says segments are being joined rather than read off a line.
  assert.ok(served.has('/v1/users/:id/transactions/summary'), 'a nested path is reassembled')
  assert.ok(!served.has('/v1/users/:id/transactions/summary/'), 'the plugin root `/` is folded away')
})

// The maintenance failure mode of a hand-written list, and the only one the two
// cases above cannot see: both are satisfied by a path listed TWICE, and by a
// path that has since earned a place in `apiRoutes` and been left here as well.
// Either leaves a reader unsure which map owns it.
test('the non-contract list is a set, and owns nothing apiRoutes already owns', { skip }, async () => {
  assert.strictEqual(
    new Set(NON_CONTRACT_PATHS).size,
    NON_CONTRACT_PATHS.length,
    'NON_CONTRACT_PATHS lists a path more than once',
  )
  const contract = new Set(declaredPaths().map((d) => d.path))
  assert.deepStrictEqual(
    NON_CONTRACT_PATHS.filter((path) => contract.has(path)),
    [],
    'these are declared in apiRoutes too — the case above already covers them, so drop them here',
  )
})
