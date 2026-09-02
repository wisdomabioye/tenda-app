/**
 * The background half of a claim: perform the transfer the endpoint promised.
 *
 * WHY IT IS A JOB. The claim endpoint answers 202 and returns immediately. A
 * seed transfer waits for a chain to confirm — 180s on a slow EVM chain before
 * viem gives up — and a user staring at a spinner for that long will tap again,
 * background the app, or decide the feature is broken. The slot is reserved
 * synchronously (that is what makes double-paying impossible); only the money
 * moves out of band.
 *
 * IDEMPOTENCE is the grant row, not the job id. The row was inserted before
 * this job existed, so a redelivered job finds a `pending:` row and re-sends —
 * which is why `finalizeGrant` and the release below are the only two ways out.
 */

import type { GasSeedSender, GasSeedStore } from '../dispatch'
import { PENDING_TX_REF_PREFIX } from '../dispatch'
import type { GasSeedClaimStore } from './store'
import type { GasSeedClaimJob } from './service'

/** What the transfer needs to tell the user it landed. */
export interface GasSeedGrantedNotice {
  user_id: string
  chain_id: string
  amount_raw: string
  tx_ref: string
}

export interface GasSeedJobDeps {
  seed: Pick<GasSeedStore, 'finalizeGrant' | 'releaseGrant'>
  claim: Pick<GasSeedClaimStore, 'findClaimedGrant'>
  senders: ReadonlyMap<string, GasSeedSender>
  /** Best-effort: a delivered seed the user is not told about is still delivered. */
  notify(notice: GasSeedGrantedNotice): Promise<void>
  log: { info(obj: object, msg: string): void; warn(obj: object, msg: string): void }
}

/** What became of one claim, for the worker's log and for tests to assert on. */
export type GasSeedJobOutcome =
  | 'granted'
  | 'no-claim'
  | 'already-finalized'
  | 'no-wallet'
  | 'sender-missing'
  | 'transfer-failed'
  | 'granted-not-recorded'

/**
 * Pay one claimed seed.
 *
 * NEVER THROWS on a transfer failure, and that is a decision rather than an
 * omission. Throwing would hand the job back to BullMQ, which retries — but the
 * slot has already been released by then, so the retry would find no claim and
 * do nothing, five times, with a `failed` log line each. Releasing and
 * returning says the same thing once, and leaves the user able to claim again.
 *
 * The cost is the window `../dispatch` documents in its header: a sender that
 * throws AFTER the chain accepted the transfer (a receipt timeout) releases a
 * slot whose money already left, and a later claim pays twice. That trade was
 * taken for the auto-send path and is taken again here for the same reason —
 * the alternative strands the user in `in_progress` with no way out.
 */
export async function handleGasSeedClaim(
  deps: GasSeedJobDeps,
  job: GasSeedClaimJob,
): Promise<GasSeedJobOutcome> {
  const { user_id, chain_id } = job
  const grant = await deps.claim.findClaimedGrant(user_id, chain_id)

  // The claim was released between enqueue and delivery (the endpoint's own
  // rollback, or an operator). Nothing was promised, so nothing is owed.
  if (grant === null) {
    deps.log.warn({ user_id, chain_id }, 'gas seed job: no claim to pay')
    return 'no-claim'
  }

  // A redelivered job for a grant that already landed. Paying again is exactly
  // what the primary key exists to prevent, and the finished tx_ref is the
  // record that it did.
  if (!grant.tx_ref.startsWith(PENDING_TX_REF_PREFIX)) {
    deps.log.info({ user_id, chain_id, tx_ref: grant.tx_ref }, 'gas seed job: already finalized')
    return 'already-finalized'
  }

  // Both of these are reachable only if the world changed after the claim was
  // accepted — the wallet was unlinked, or the chain's key was pulled. Release
  // rather than hold: there is nothing to pay to, or nothing to pay with.
  if (grant.wallet_address === null) {
    await deps.seed.releaseGrant(user_id, chain_id)
    deps.log.warn({ user_id, chain_id }, 'gas seed job: claim has no wallet, released')
    return 'no-wallet'
  }
  const sender = deps.senders.get(chain_id)
  if (sender === undefined) {
    await deps.seed.releaseGrant(user_id, chain_id)
    deps.log.warn({ user_id, chain_id }, 'gas seed job: no sender configured, released')
    return 'sender-missing'
  }

  let tx_ref: string
  try {
    ;({ tx_ref } = await sender.send({
      to_address: grant.wallet_address,
      amount_raw: grant.amount_raw,
    }))
  } catch (err) {
    await deps.seed.releaseGrant(user_id, chain_id)
    deps.log.warn({ err, user_id, chain_id }, 'gas seed job: transfer failed, claim released')
    return 'transfer-failed'
  }

  try {
    await deps.seed.finalizeGrant(user_id, chain_id, tx_ref)
  } catch (err) {
    // The money HAS left the hot wallet and only the stamp failed. The slot
    // stays taken — releasing here is what would pay a second time — leaving a
    // `pending:` row that `verify-gas-seed.ts` reports and an operator repairs.
    deps.log.warn(
      { err, user_id, chain_id, tx_ref },
      'gas seed job: transferred but not stamped — claim deliberately NOT released',
    )
    return 'granted-not-recorded'
  }

  deps.log.info({ user_id, chain_id, tx_ref }, 'gas seed job: granted')
  // After the stamp, never before: a notification promising gas the user does
  // not have is worse than a late one.
  await deps.notify({ user_id, chain_id, amount_raw: grant.amount_raw, tx_ref })
  return 'granted'
}
