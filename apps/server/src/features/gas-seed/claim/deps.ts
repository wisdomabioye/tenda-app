/**
 * Live wiring for the claim surface — the only file here that knows about
 * Fastify, the queue or the notification path.
 *
 * Keeping it in one place is what lets `./service`, `./eligibility` and `./job`
 * be tested with plain objects, and it is where the feature's dependency on the
 * app (rather than the app's on the feature) is concentrated.
 */

import { chainById } from '@tenda/shared'
import { getChainSecrets } from '@server/chains/secrets'
import { getConfig } from '@server/config'
import { enqueueNotification } from '@server/lib/notify'
import type { QueueService } from '@server/plugins/queue'
import type { AppDatabase } from '@server/plugins/db'
import { drizzleGasSeedStore } from '../dispatch'
import { buildGasSeedFunders, buildGasSeedSenders, type GasSeedFunder } from '../senders'
import { drizzleGasSeedClaimStore } from './store'
import type { GasSeedClaimDeps, GasSeedClaimJob } from './service'
import type { GasSeedJobDeps, GasSeedGrantedNotice } from './job'

/**
 * What the claim surface needs from the app. A real FastifyInstance satisfies
 * it structurally, so the routes and the worker both pass `fastify` and neither
 * has to conjure an instance in a test.
 *
 * REDIS_URL is read from `getConfig()` inside rather than taken here, matching
 * `buildOtpDeps` one directory over — config is a process-wide fact, and
 * threading it through the host would let a caller supply a different answer
 * than the queue plugin itself acted on.
 */
export interface GasSeedClaimHost {
  db: AppDatabase
  queue: Pick<QueueService, 'enqueue'>
  log: GasSeedClaimDeps['log']
}

/**
 * How long a hot-wallet balance may be reused across availability reads.
 *
 * Availability is a per-user read that several clients poll, and the balance is
 * the only part of it that costs an RPC round trip. It also moves slowly and in
 * one direction — down, by one grant at a time — so a stale read is wrong only
 * in the seconds around the wallet running dry, where the claim's own failure
 * path already releases the slot and lets the user retry.
 *
 * Not a config value: it is a property of this read's cost, not of a
 * deployment, and a knob here would be a knob nobody could set correctly.
 */
const FUNDER_BALANCE_TTL_MS = 30_000

/**
 * Wrap each funder so repeated availability reads share one balance lookup.
 *
 * Per funder rather than one shared map entry, so a chain whose RPC is slow
 * cannot delay another chain's answer, and a failed read is not cached as a
 * success (the promise is dropped on rejection, so the next caller retries).
 */
export function cachedFunders(
  funders: ReadonlyMap<string, GasSeedFunder>,
  now: () => number = Date.now,
  ttl_ms: number = FUNDER_BALANCE_TTL_MS,
): ReadonlyMap<string, GasSeedFunder> {
  const cached = new Map<string, GasSeedFunder>()
  for (const [chain_id, funder] of funders) {
    let expires = 0
    let inflight: Promise<bigint> | null = null
    cached.set(chain_id, {
      address: funder.address,
      balance() {
        if (inflight !== null && now() < expires) return inflight
        expires = now() + ttl_ms
        const pending = funder.balance()
        inflight = pending
        // A rejection must not be cached, or one blip hides a healthy wallet
        // for the whole TTL. Cleared only if this attempt is still the current
        // one, so a later successful read is never discarded by an older failure.
        pending.catch(() => {
          if (inflight === pending) {
            inflight = null
            expires = 0
          }
        })
        return pending
      },
    })
  }
  return cached
}

/**
 * The funders, built ONCE for the process.
 *
 * Module state, and it has to be: `buildGasSeedClaimDeps` runs on every request
 * to these endpoints, so building the cache inside it produced a FRESH, empty
 * cache per call — every availability read paid its RPC round trip and the TTL
 * never once hit. The unit tests did not catch that, because they exercise
 * `cachedFunders` directly; only reading the call site does.
 *
 * Safe to hold for the process's lifetime because chain secrets are read from
 * the environment at boot and cannot change without a restart (#53c-1 decision
 * 5). The address inside each funder is derived locally from that same secret,
 * so nothing here goes stale that a restart would not already fix.
 */
let funderCache: ReadonlyMap<string, GasSeedFunder> | null = null

/**
 * Drop the process-wide funder cache.
 *
 * Mirrors `invalidatePlatformConfigCache` in lib/platform.ts, and exists for
 * the same reason: module state that survives between tests makes the second
 * test depend on the first. Not called in production — the cache's contents
 * only change with the secrets, which only change with a restart.
 */
export function resetGasSeedFunderCache(): void {
  funderCache = null
}

/**
 * The process-wide funder map — the ONLY way to get one.
 *
 * Exported because the claim surface is no longer the only reader: #53b's
 * hot-wallet monitor reads the same balances every 15 minutes, and building its
 * own map would mean a second set of RPC clients per chain and a second
 * balance-cache TTL. Two caches for one fact is how the availability endpoint
 * and the monitor come to disagree about what a wallet holds — which is exactly
 * the disagreement the alert would be reporting on.
 */
export function gasSeedFunders(): ReadonlyMap<string, GasSeedFunder> {
  funderCache ??= cachedFunders(buildGasSeedFunders(getChainSecrets()))
  return funderCache
}

/**
 * The queue's de-duplication key for one claim.
 *
 * Derived from the grant's PRIMARY KEY, so two jobs for the same (user, chain)
 * collapse into one. The key is not what makes the seed safe — the grant row is,
 * and the handler refuses a redelivery that finds a finished tx_ref — it just
 * saves the duplicate the round trip of discovering that.
 *
 * A named function rather than an inline template, because the closure it came
 * out of is unreachable from the suite: the test harness runs the app WITHOUT
 * Redis, so `enqueue` is null there and the format nothing else asserts would
 * have shipped unchecked.
 */
export function gasSeedJobId(job: GasSeedClaimJob): string {
  return `gas-seed:${job.user_id}:${job.chain_id}`
}

export function buildGasSeedClaimDeps(host: GasSeedClaimHost): GasSeedClaimDeps {
  return {
    seed: drizzleGasSeedStore(host.db),
    claim: drizzleGasSeedClaimStore(host.db),
    funders: gasSeedFunders(),
    // No Redis means no worker, and a claim whose transfer nothing will run is
    // worse than a refused one — see `GasSeedClaimDeps.enqueue`.
    enqueue:
      getConfig().REDIS_URL === null
        ? null
        : async (job) => {
            await host.queue.enqueue('gas-seed', job, { job_id: gasSeedJobId(job) })
          },
    log: host.log,
  }
}

/**
 * The delivered-seed notice.
 *
 * NO AMOUNT IN THE COPY, deliberately. The manifest describes a chain's native
 * gas only as `gasSeedAmountRaw` — there is no native symbol or decimals on a
 * manifest entry — so rendering "0.01 OG" would mean either inventing those
 * fields or hardcoding a scale per chain, and a seed announced in the wrong
 * magnitude is worse than one announced without a number. The wallet screen
 * shows the balance, which is the honest place for it.
 */
function grantedNotice(chain_id: string): { title: string; body: string } {
  return {
    title: 'Gas is on us',
    body: `Your one-time gas grant landed on ${chainById(chain_id).displayName}. You are ready to transact.`,
  }
}

export function buildGasSeedJobDeps(host: GasSeedClaimHost): GasSeedJobDeps {
  return {
    seed: drizzleGasSeedStore(host.db),
    claim: drizzleGasSeedClaimStore(host.db),
    senders: buildGasSeedSenders(getChainSecrets()),
    notify: (notice: GasSeedGrantedNotice) =>
      enqueueNotification(host.queue, {
        user_id: notice.user_id,
        ...grantedNotice(notice.chain_id),
        // No `screen`: NOTIFICATION_SCREEN carries no wallet destination, and
        // inventing one here would deep-link the app somewhere it cannot route.
        // #53c-2 owns where a tap should land, and adds it with the surface.
        data: { kind: 'gas_seed', chain_id: notice.chain_id, tx_ref: notice.tx_ref },
      }),
    log: host.log,
  }
}
