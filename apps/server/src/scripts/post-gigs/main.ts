/**
 * Seed a gig book against a running API, as an AGENT.
 *
 *   pnpm --filter tenda-server post-gigs -- --api https://dev-api.tendahq.com \
 *     --chain eip155:16602 [--skip 1] [--limit 3] [--amount 1000000] [--dry-run]
 *
 * `--skip` RESUMES a partial run. Every post is funded and irreversible, so a
 * run that posted 7 of 20 must be continued, not restarted: each invocation
 * mints fresh `creation_operation_id`s, so re-running the whole book would
 * duplicate the 7 already on chain rather than deduplicate against them.
 *
 * Needs E2E_AGENT_KEY. The agent's wallet funds every escrow; the server's
 * RELAYER pays the gas, so the agent needs the token and no native balance.
 *
 * WHY THIS IS NOT `verify:agent-hire`. That script proves the whole hire loop
 * and settles it, which means it onboards a WORKER — and worker onboarding
 * falls back to a phone OTP read out of the server's log file. That works
 * against a local server and cannot work against a deployed one. Posting is
 * purely the agent side, and agents are wallet-born: `POST /v1/agent/register`
 * takes a wallet signature and no OTP. So this reuses that script's HTTP and
 * chain helpers and does only the half that a deployed environment allows.
 *
 * THE CHAIN AND ASSET ARE FLAGS, not constants. `verify:agent-hire` hardcodes
 * Galileo and its mock token; the same book has to seed 0G mainnet without a
 * second copy, so the asset is resolved from the shared manifest by chain id —
 * which also means a chain with no gig asset fails HERE with a clear message
 * rather than as a 422 mid-run.
 */

import 'dotenv/config'
import { privateKeyToAccount } from 'viem/accounts'
import {
  apiRoutes,
  chainById,
  gigAssetByChain,
  TENDA_RELAY_SCHEME,
  X402_VERSION,
  type AgentTaskBody,
} from '@tenda/shared'
import { stripTrailingSlash } from '@server/lib/env'
import { makeApi, newOperationId, registerAgent, type Api } from '../agent-hire-e2e/actors'
import { GIG_BOOK, type GigSeed } from './gigs'
import { withRateLimitRetry, type RetryOptions } from './rate-limit'
import { parseOnly, selectGigs } from './select'
import { appendReceipt, defaultReceiptPath } from './receipts'

interface Args {
  api: string
  chain: string
  skip: number
  limit: number
  only: readonly string[]
  amount: string | null
  dryRun: boolean
  out: string | null
}

function parseArgs(argv: readonly string[]): Args {
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag)
    return i === -1 ? undefined : argv[i + 1]
  }
  const api = get('--api')
  const chain = get('--chain')
  if (api === undefined || chain === undefined) {
    throw new Error('usage: post-gigs --api <base-url> --chain <caip2> [--only tok,tok] [--skip N] [--limit N] [--amount RAW] [--out FILE] [--dry-run]')
  }
  const limit = Number(get('--limit') ?? GIG_BOOK.length)
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer')
  const skip = Number(get('--skip') ?? 0)
  if (!Number.isInteger(skip) || skip < 0) throw new Error('--skip must be a non-negative integer')
  if (skip >= GIG_BOOK.length) {
    throw new Error(`--skip ${skip} passes the whole book of ${GIG_BOOK.length}; nothing would post`)
  }
  return {
    // The SAME normalisation the server applies to `API_BASE_URL`, because this
    // value is not only a request prefix: it is signed into the auth message's
    // `URI:` line and compared there BYTE FOR BYTE. `--api https://x/` would
    // otherwise fail registration with a URI mismatch that reads like a
    // signing bug rather than a stray slash.
    api: stripTrailingSlash(api),
    chain,
    skip,
    limit,
    only: parseOnly(get('--only')),
    out: get('--out') ?? null,
    amount: get('--amount') ?? null,
    dryRun: argv.includes('--dry-run'),
  }
}

/**
 * How many times one leg may be re-sent through the limiter. Five covers a
 * handful of consecutive windows, which is what a twenty-gig book needs against
 * a route that admits five gigs a minute; beyond that the run is not being
 * throttled, something is wrong and the operator should see the server's words.
 */
const RETRY_ATTEMPTS = 5

/** 6-decimal base units as a human amount. The asset symbol is printed once, in the header. */
const usd = (raw: string): string => (Number(raw) / 1e6).toFixed(6)

/** What the CONTRACT will pay out, by its own arithmetic: floor division. */
function projectPayout(amountRaw: string, feeBps: number): { fee: bigint; payout: bigint } {
  const amount = BigInt(amountRaw)
  const fee = (amount * BigInt(feeBps)) / 10_000n
  return { fee, payout: amount - fee }
}

interface Posted {
  title: string
  taskId: string
  txRef: string
  amountRaw: string
}

/**
 * One listing: quote (402) → sign the authorization → resend with X-PAYMENT.
 *
 * The body is sent TWICE, byte-identical. That is the contract of the one-shot
 * endpoint: the first call mints (or finds) the draft and quotes terms bound to
 * it, the second presents payment for those terms. A body that differed between
 * the two would be quoting one draft and paying for another.
 *
 * BOTH legs wait out a 429. The route admits ten requests a minute and each gig
 * spends two of them, so any book longer than five gigs WILL be rate-limited
 * mid-run — see `rate-limit.ts`. Retrying the quote is free; retrying the paid
 * leg is safe because a 429 is refused by the limiter before the handler runs,
 * so nothing was charged and nothing was broadcast.
 */
async function postOne(
  api: Api,
  token: string,
  account: ReturnType<typeof privateKeyToAccount>,
  body: AgentTaskBody,
  retry: RetryOptions,
): Promise<Posted> {
  const quote = await withRateLimitRetry(
    () => api(apiRoutes.agent.tasks, { method: 'POST', token, body }),
    retry,
  )
  if (quote.status !== 402) {
    throw new Error(`expected 402 with terms, got ${quote.status} — ${JSON.stringify(quote.json)}`)
  }
  const terms = quote.json as unknown as {
    task_id: string
    accepts: [{ payment: { typed_data: Record<string, unknown> } }]
  }
  const typed = terms.accepts[0].payment.typed_data as Parameters<typeof account.signTypedData>[0]
  const signature = await account.signTypedData(typed)

  const header = Buffer.from(
    JSON.stringify({
      x402Version: X402_VERSION,
      scheme: TENDA_RELAY_SCHEME,
      network: body.chain_id,
      payload: {
        signature,
        authorization: (typed as unknown as { message: unknown }).message,
      },
    }),
  ).toString('base64')

  const created = await withRateLimitRetry(
    () => api(apiRoutes.agent.tasks, { method: 'POST', token, body, headers: { 'x-payment': header } }),
    retry,
  )
  if (created.status !== 201) {
    throw new Error(`expected 201, got ${created.status} — ${JSON.stringify(created.json)}`)
  }
  return {
    title: body.title,
    taskId: terms.task_id,
    txRef: (created.json as { tx_ref: string }).tx_ref,
    amountRaw: body.amount_raw,
  }
}

function bodyFor(seed: GigSeed, args: Args, asset: string): AgentTaskBody {
  return {
    ...seed,
    ...(args.amount !== null ? { amount_raw: args.amount } : {}),
    creation_operation_id: newOperationId(),
    chain_id: args.chain,
    asset,
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const key = process.env['E2E_AGENT_KEY']
  if (key === undefined || key === '') throw new Error('E2E_AGENT_KEY is not set')

  const entry = chainById(args.chain)
  const asset = gigAssetByChain(args.chain)
  if (asset === null) throw new Error(`${args.chain} declares no gig asset in the manifest`)

  const account = privateKeyToAccount(key as `0x${string}`)
  const book = selectGigs(GIG_BOOK, args)

  console.log(`API    : ${args.api}`)
  console.log(`Chain  : ${entry.displayName} (${args.chain})  asset ${asset}`)
  console.log(`Agent  : ${account.address}`)
  console.log(
    `Gigs   : ${book.length}${args.skip > 0 ? ` (skipping the first ${args.skip})` : ''}` +
      `${args.amount !== null ? ` · all at ${usd(args.amount)}` : ''}`,
  )

  // The projection, printed BEFORE anything is posted: on a real chain this is
  // the last cheap moment to notice that the book costs more than intended.
  const total = book.reduce((sum, g) => sum + BigInt(args.amount ?? g.amount_raw), 0n)
  console.log(`Funding: ${usd(total.toString())} from the agent wallet\n`)

  if (args.dryRun) {
    for (const [i, seed] of book.entries()) {
      const raw = args.amount ?? seed.amount_raw
      const { fee, payout } = projectPayout(raw, 250)
      console.log(
        `${String(i + 1).padStart(2)}. ${usd(raw)} → worker ${usd(payout.toString())} (fee ${usd(fee.toString())})  ${seed.title}`,
      )
    }
    console.log('\n--dry-run: nothing was posted.')
    return
  }

  // Enough attempts to outlast a few windows: the route admits five gigs a
  // minute, so a full book spends most of its wall-clock waiting by design.
  const retry: RetryOptions = {
    attempts: RETRY_ATTEMPTS,
    onWait: (waitMs, attempt) =>
      console.log(`      rate limited — waiting ${Math.round(waitMs / 1000)}s (attempt ${attempt})`),
  }

  // Keyed by host so a mainnet run can never append into a preview file.
  const receiptPath = args.out ?? defaultReceiptPath(args.api)
  console.log(`Receipts: ${receiptPath} (written as each gig lands)\n`)

  const api = makeApi(args.api)
  const reg = await registerAgent(api, account, args.chain, 'Tenda seed agent', args.api)
  console.log(`registered agent → ${reg.token.slice(0, 12)}…\n`)

  const posted: Posted[] = []
  const failed: { title: string; why: string }[] = []
  for (const [i, seed] of book.entries()) {
    const label = `${String(i + 1).padStart(2)}/${book.length}`
    try {
      const body = bodyFor(seed, args, asset)
      const p = await postOne(api, reg.token, account, body, retry)
      // BEFORE the next gig: this escrow is funded and irreversible, and its id
      // is the only handle for cancelling it later. A run cut short by the rate
      // limiter must still leave an exact record of what it committed.
      appendReceipt(receiptPath, {
        at: new Date().toISOString(),
        api: args.api,
        chain_id: args.chain,
        task_id: p.taskId,
        tx_ref: p.txRef,
        title: p.title,
        amount_raw: p.amountRaw,
        requires_approval: body.requires_approval === true,
      })
      posted.push(p)
      console.log(`${label} ✓ ${usd(p.amountRaw)} ${p.taskId}  ${p.title}`)
    } catch (err) {
      // One bad listing must not abandon the rest — and on a funded chain the
      // ones already posted are real, so the run has to report them either way.
      const why = err instanceof Error ? err.message : String(err)
      failed.push({ title: seed.title, why })
      console.log(`${label} ✗ ${seed.title}\n      ${why}`)
    }
  }

  console.log(`\nposted ${posted.length}/${book.length}`)
  for (const p of posted) console.log(`  ${p.taskId}  tx ${p.txRef}`)
  if (failed.length > 0) {
    console.log(`\nfailed ${failed.length}:`)
    for (const f of failed) console.log(`  ${f.title}\n    ${f.why}`)
    process.exitCode = 1
  }
}

// Only when run directly, so importing this module cannot post a gig book.
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(`\n✗ ${err instanceof Error ? err.message : String(err)}`)
    process.exitCode = 1
  })
}

export { projectPayout, bodyFor, parseArgs }
