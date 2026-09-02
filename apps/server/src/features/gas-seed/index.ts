/**
 * First-link native-gas seed — the whole feature, in one directory.
 *
 * WHAT IT IS. A one-time native-token grant that lets a new user post, accept
 * and settle without first hunting for gas. Which chains qualify, how much, and
 * which hot wallet pays are all configuration (the shared CHAIN_MANIFEST plus
 * `CHAIN_<ID>_GAS_SEED_KEY`); this directory is the mechanism.
 *
 * TWO TRIGGERS, one mechanism. `./trigger` fires automatically on wallet-link
 * and phone-verify (#53a); `./claim` is the user-initiated endpoint (#53c-1),
 * which is what auto-send is being REPLACED by — sending crypto nobody asked
 * for has gray area a claim does not. Both take the same slot, through the same
 * `(user_id, chain_id)` primary key, so they cannot double-pay each other.
 * `./trigger` and its two call sites disappear with #53c-2.
 *
 * WHY IT LIVES IN ONE PLACE. The seed must be removable without unpicking it
 * from a dozen files — the same property `features/alerts` and
 * `features/fiat-rails` have, and for the same reason: a subsidy is exactly the
 * kind of thing a business turns off.
 *
 * REMOVAL RECIPE — keep this true:
 *   1. delete this directory;
 *   2. delete `src/routes/v1/wallet/gas-seed/` (autoloaded, so the folder IS
 *      the registration for both endpoints);
 *   3. delete the three registry lines: the `'gas-seed'` payload in
 *      `plugins/queue/payloads.ts`, its processor in `workers/processors.ts`,
 *      and its `WORKER_CONCURRENCY` entry in `plugins/workers.ts` — that last
 *      one is not optional, the map is `Record<JobName, number>` and omitting
 *      it fails the type check;
 *   4. delete the two call sites of `fireRetroactiveGasSeed` (auth/link-wallet,
 *      auth/verify) — these disappear anyway with #53c-2;
 *   5. delete the `GAS_SEED_SUPPORT` import in `db/seed/rows.ts` and let the
 *      gas columns seed NULL;
 *   6. optionally delete `packages/shared/src/db/schema/gas-seed.ts` (both
 *      tables live there, and only there) plus the two gas columns on `chains`,
 *      in a generated migration. NOT required — an unread table costs nothing,
 *      and the grant history is worth keeping even after the feature stops.
 * Nothing else knows this feature exists. Three things deliberately stay behind
 * because they are NOT part of it: `chains/evm/hot-wallet.ts` (the relayer uses
 * the same clients), `resolvePrimaryWalletAddress`'s deterministic ordering
 * (a fix to shared auth code, good on its own merits, and six modules depend on
 * it), and the session client stamp on the auth token (a generic session fact —
 * see shared constants/session.ts — not a seed hook).
 *
 * IMPORT THIS BARREL FROM `src/`, not the files behind it — reaching past it is
 * what turns a removable feature back into a clustered one, and it is `src/`
 * that the removal recipe has to survive. Tests may address a module directly
 * to reach an internal the barrel does not publish (the sender constructors and
 * their port, for instance); the source-scan guard in
 * test/unit/gas-seed-module-boundary.test.ts therefore asserts the rule over
 * `src/` only.
 */

export {
  dispatchGasSeeds,
  drizzleGasSeedStore,
  pendingTxRef,
  PENDING_TX_REF_PREFIX,
  type GasSeedDeps,
  type GasSeedResult,
  type GasSeedSender,
  type GasSeedStore,
  type SeedableChain,
} from './dispatch'

export {
  buildGasSeedSenders,
  buildGasSeedFunders,
  GAS_SEED_SUPPORT,
  type GasSeedFunder,
} from './senders'

/**
 * Namespace-specific, but public on purpose: `scripts/verify-gas-seed.ts`
 * derives the funder from the configured secret to check it against what the
 * seeder recorded. Exported HERE rather than imported from `senders/solana`
 * directly, so the removal recipe above stays a directory delete plus known
 * lines — a reach past this barrel is the thing that would break it.
 */
export { gasSeedAddressFromSecret } from './senders/solana'

export { buildGasSeedDeps, fireRetroactiveGasSeed, type GasSeedHost } from './trigger'

// ---------- the claim surface (#53c-1) ------------------------------------------

export {
  claimGasSeed,
  gasSeedAvailability,
  type ClaimIdentity,
  type GasSeedClaimDeps,
  type GasSeedClaimJob,
} from './claim/service'

export {
  claimRefusal,
  evaluateClaim,
  grantState,
  type ChainClaimFacts,
  type ClaimantFacts,
  type GrantFacts,
} from './claim/eligibility'

export { drizzleGasSeedClaimStore, type GasSeedClaimStore } from './claim/store'

export {
  handleGasSeedClaim,
  type GasSeedGrantedNotice,
  type GasSeedJobDeps,
  type GasSeedJobOutcome,
} from './claim/job'

export {
  buildGasSeedClaimDeps,
  buildGasSeedJobDeps,
  cachedFunders,
  gasSeedJobId,
  resetGasSeedFunderCache,
  type GasSeedClaimHost,
} from './claim/deps'
