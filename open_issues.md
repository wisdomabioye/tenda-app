# Tenda Backend — Open Issues

> Issues identified through code review and audit sessions.
> Fixed issues are kept for historical reference.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔴 | Critical — fix before any real traffic |
| 🟠 | Significant — fix before production launch |
| 🟡 | Minor — fix before scaling or as time permits |
| ✅ | Resolved |

---

## Open

### 🔴 Critical

_None — all critical issues resolved._

### 🟠 Significant

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 22 | Module-level caches don't work across multiple server instances — `getPlatformConfig` 5-min cache and `batchExpireGigs` 60s throttle live in process memory; each pod has independent state | `lib/platform.ts`, `lib/gigs.ts` | Replace with Redis or Postgres advisory locks before horizontal scaling |
| 24 | No push notifications or webhooks — mobile client must poll to learn of status changes (proof submitted, gig approved, dispute raised) | Missing | Implement WebSockets, SSE, or a push notification service (FCM/APNs) |

### 🟡 Minor

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 25 | No full-text search on gig title/description — `GET /v1/gigs` supports location/category/price but no keyword search | `routes/v1/gigs/index.ts`, `db/schema.ts` | Add `q` query param; use Postgres `tsvector` + GIN index or `ILIKE` for MVP |
| 26 | Cloudinary upload signature doesn't constrain file size or type — server signs anything | `lib/cloudinary.ts` | Add `max_file_size` and `allowed_formats` to the signature params per upload type |
| 27 | Admin route response types not in shared contracts — a future admin web panel would need to type responses manually | `packages/shared/src/api/contracts/` | Add `AdminContract` to `@tenda/shared` when an admin panel is built |
| 39 | On-chain split dispute has 1-lamport dust when payment is odd — `payment_amount / 2` rounds down in Rust, leaving 1 lamport unaccounted | `tenda-escrow/…/resolve_dispute.rs` | Contract-level fix: send remainder to worker or platform; server can enforce even `payment_lamports` for split-eligible gigs |
| 64 | **`batchExpireGigs` runs in the request path** — on two pods the batch runs twice per minute; on a high-traffic instance it adds latency to every `GET /v1/gigs` response | `lib/gigs.ts` | Move to a dedicated cron job or pg_cron so it runs once regardless of pod count |
| 72 | **Cloudinary upload signature expires 10 minutes after generation** — `generateUploadSignature` bakes in the server timestamp; if the mobile client queues the upload (slow network, background processing) and more than 10 minutes pass, Cloudinary rejects the upload with a 401 | `lib/cloudinary.ts`, `apps/mobile/lib/upload.ts` | Fetch a fresh signature immediately before each `fetch(…/auto/upload)` call rather than caching it; or pass `eager_async=true` with a webhook |
| 80 | **CoinGecko rate-limit exposure from per-device polling** — every device calls the public unauthenticated CoinGecko API directly; the free tier allows ~10–30 req/min globally; 50 simultaneous app opens can exhaust the quota and cause `429` responses, causing all devices to fall back to the hardcoded default rate indefinitely | `stores/exchange-rate.store.ts` | Proxy the rate lookup through the backend (`GET /v1/config/exchange-rate` cached 5 min per server) so the RPC cost is O(1) per server rather than O(users); or obtain and bundle a CoinGecko API key |

---

## Resolved

| # | Issue | Resolved in |
|---|-------|-------------|
| 1 | No rate limiting | Added global 100 req/min + 10 req/min on `/auth/wallet` |
| 2 | `winner` field unvalidated in `resolve.ts` | Validated against `['poster', 'worker', 'split']` |
| 3 | Suspended users keep JWT valid up to 7 days | 60s in-process status cache added to `authenticate` |
| 4 | No pagination `limit` cap | Clamped to `MAX_PAGINATION_LIMIT = 100` on all paginated endpoints |
| 5 | Grace period not enforced in worker submission window | `submit.ts` now allows submission within `completion_deadline + grace_period_seconds`; returns `GRACE_PERIOD_EXPIRED` after |
| 6 | `reputation_score` race condition under concurrent reviews | Single atomic `UPDATE … SET = (SELECT ROUND(AVG …))` |
| 7 | No admin routes | Added `GET /disputes`, `PATCH /users/:id/status`, `GET/PATCH /platform-config` |
| 8 | Role changes don't propagate until JWT expiry | Partially mitigated — cache-miss forces DB status re-check; full fix tracked in #15 |
| 9 | No health check endpoint | Added `GET /health → { status, uptime }` |
| 10 | Cloudinary URL not validated on receipt | `isCloudinaryUrl()` applied to `avatar_url` and proof URLs |
| 11 | Lazy expiry only ran on single-record GET | `batchExpireGigs()` with 60s throttle called at top of `GET /v1/gigs` |
| 12 | Full gig financial history publicly visible per user | Optional auth on `GET /v1/users/:id/gigs`; non-owners see public statuses only |
| 13 | `any` used in `lib/gigs.ts` and `lib/platform.ts` | Replaced with `AppDatabase = PostgresJsDatabase<typeof schema>` |
| 14 | Rate limit keys on proxy IP, not client IP | Set `trustProxy: true` on the Fastify instance in `server.ts` |
| 28 | TOCTOU race on gig accept/approve/dispute/submit — UPDATE had no status guard in WHERE clause | Added `eq(gigs.status, expectedStatus)` to UPDATE WHERE in all four routes; 0 rows returned → 409 |
| 15 | Role not reflected until JWT expiry | Acceptable — promoted users re-login to get updated role in JWT |
| 16 | CORS wide open (`origin: true`) | `CORS_ORIGIN` env var; falls back to `true` in dev |
| 18 | Duplicate on-chain signatures writable to `gig_transactions` | `uniqueIndex` on `gig_transactions.signature`; 23505 → 409 `DUPLICATE_SIGNATURE` in publish, approve, resolve |
| 19 | No API to promote user to admin | Added `PATCH /v1/admin/users/:id/role`; self-demotion guarded; role change logged |
| 29 | `createEscrowInstruction` used env-var fee instead of DB fee | `feeBps` param added; caller passes `getPlatformConfig().fee_bps` |
| 30 | `createEscrowInstruction` built a plain `SystemProgram.transfer` — GigEscrow account never initialised | Replaced with `buildCreateGigEscrowInstruction` using real Anchor discriminator + borsh-encoded args |
| 31 | Graceful shutdown commented out | Uncommented `server.close()` on SIGTERM/SIGINT |
| 40 | No server endpoint to build `approve_completion` unsigned tx | Added `POST /v1/blockchain/approve-escrow`; `accept.ts` + `submit.ts` now require on-chain signature |
| 41 | No server endpoint to build `cancel_refund` unsigned tx | Added `POST /v1/blockchain/cancel-escrow`; mobile calls `DELETE /v1/gigs/:id` with signature |
| 42 | No blockchain endpoints for `accept_gig`, `submit_proof`, `refund_expired` | Added `POST /v1/blockchain/accept-gig`, `submit-proof`, `refund-expired`; `POST /v1/gigs/:id/refund` records expired_refund transaction |
| 43 | **On-chain signature not tied to gig or action** | `lib/solana.ts`: exported 6 discriminator constants; `verifyTransactionOnChain` now accepts `expectedDiscriminator?` and fetches the full tx to assert programId + discriminator match. Each route (`publish`, `accept`, `submit`, `approve`, `refund`) passes its discriminator. |
| 44 | **No unique constraint on `(gig_id, reviewer_id)` in reviews** | `db/schema.ts:194` already has `uniqueIndex('reviews_gig_reviewer_unique')`; `review.ts:107–122` already catches 23505 → 409. No code change needed. |
| 45 | **Draft gig with a past `accept_deadline` can be published** | `publish.ts`: added pre-publish check — rejects with `ACCEPT_DEADLINE_PASSED` if `accept_deadline <= now()`. |
| 46 | **`checkAndExpireGig` not called before refund-expired routes** | `gigs/_id/refund.ts` and `blockchain/refund-expired.ts`: both now call `checkAndExpireGig()` before the status guard, so a poster hitting either endpoint directly gets the correct `expired` status. |
| 47 | **`recentBlockhash` not set on any unsigned transaction** | All 6 `buildX` functions in `lib/solana.ts` are now `async` and set `transaction.recentBlockhash` from `getLatestBlockhash('confirmed')` before serializing. Blockchain route handlers updated to `await` the calls. |
| 48 | **Proof `type` field not validated as enum before DB insert** | `submit.ts`: validates each proof's `type` against `['image', 'video', 'document']` before the URL check; returns 400 `VALIDATION_ERROR` for any other value. |
| 49 | **`submitProof`/`acceptGig` store merge corrupts `GigDetail`** | `gigs.store.ts`: both `acceptGig` and `submitProof` now call `fetchGigDetail(id)` after the API call instead of spreading the raw response over `selectedGig`. |
| 50 | **Concurrent blockchain flows overwrite each other's state** | `GigCTABar.tsx`: added `txInProgress: boolean` prop — when true, renders a "Transaction in progress" warning instead of any CTA. `gig/[id].tsx`: passes `txInProgress={pendingSignature !== null}`. |
| 51 | **Cloudinary URL validation uses substring match** — `res.cloudinary.com.evil.com` passed a naive `startsWith` check | `shared/src/utils/validation.ts`: replaced with `new URL(url).hostname === 'res.cloudinary.com'` |
| 52 | **No rate limit on `/dispute`, `/review`, `/refund`** — only global 100/min applied | Added `config.rateLimit`: dispute 5/min, review 10/min, refund 3/min |
| 53 | **Pending-sync queue persists across logout** | `pending-sync.store.ts`: added `clear()` action; `auth.store.ts` logout calls `clear()` before `clearAuthStorage()` |
| 54 | **No SOL balance check before publish** | `gig/[id].tsx:handlePublish`: pre-flight `getBalance` check; shows Alert if insufficient; requires new `GET /v1/platform/config` endpoint |
| 55 | **`computePlatformFee` integer overflow** — `bigint × number` throws TypeError | Moved to `shared/src/utils/fees.ts` using BigInt arithmetic; all server callers updated; `SOLANA_TX_FEE_LAMPORTS` added to `shared/src/constants/solana.ts` |
| 56 | **Wallet screen made O(n) API calls** — one per gig | Added `GET /v1/users/:id/transactions` (single JOIN); wallet screen now makes one call |
| 57 | **`poster` had `isSigner: false` in `refund_expired` instruction** | `lib/solana.ts:buildRefundExpiredInstruction`: changed to `isSigner: true` |
| 67 | **Auth upsert TOCTOU race → 500 on concurrent first-logins** | `auth/index.ts`: replaced SELECT + conditional INSERT with `INSERT … ON CONFLICT DO UPDATE … RETURNING` |
| 68 | **Auth message had no nonce/expiry — replayable indefinitely** | Mobile: timestamp appended to message; server: validates timestamp within ±5 min / 30 s window |
| 69 | **Submit-proof had no pending-sync retry path** | `pending-sync.store.ts`: added `'submit'` action with `proofs` field; `gig/[id].tsx:handleProofsReady`: adds to pending-sync with signature + proofs |
| 70 | **`loadSession` cleared JWT on any error including network failures** | `api/client.ts`: exported `ApiClientError`; `auth.store.ts`: only clears storage on 401/403, preserves credentials on network errors |
| A1 | **`resolve.ts` accepted any confirmed Solana tx** — no discriminator passed to `verifyTransactionOnChain` | Added `DISCRIMINATOR_RESOLVE_DISPUTE` to `lib/solana.ts`; now passed alongside all other routes |
| A2 | **`resolve.ts` UPDATE had no status guard** — concurrent resolves could insert duplicate transaction records | Added `eq(gigs.status, 'disputed')` to WHERE; null result returns 409 |
| A3 | **`publish.ts` UPDATE had no status guard** — inconsistent with all other state-transition routes | Added `eq(gigs.status, 'draft')` to WHERE; null result returns 409 |
| A4 | **Auth message `Chain:` line not validated** — devnet-signed messages accepted by production server | Added `solanaChainId(network)` helper to `shared/constants/solana.ts`; server verifies chain; mobile uses same helper |
| A5 | **lat/lng not range-validated on profile update or gig creation** | `isValidLatitude`/`isValidLongitude` added to `@tenda/shared`; applied in `users/_id/index.ts` and `gigs/index.ts` |
| A6 | **Network error in `loadSession` left in-memory auth state blank** — false login screen shown | Credentials read into outer-scope `let` vars; committed to state in network-error branch |
| A7 | **`review.ts` + `dispute.ts` used inline 23505 check** instead of `isPostgresUniqueViolation()` helper | Replaced with helper in both files |
| A8 | **Review comment length not validated before DB insert** — DB threw cryptic 500 on >1000 chars | Added `MAX_REVIEW_COMMENT_LENGTH` constant to shared; validated in `review.ts` before insert |
| A9 | **Public `GET /v1/platform/config` had no explicit rate limit** | Added `config: { rateLimit: { max: 30, timeWindow: '1 minute' } }` |
| A10 | **statusCache eviction ran O(n) on every cache miss** | Replaced inline sweep with `setInterval` every 5 min (`.unref()` so it doesn't block test teardown) |
| A11 | **min/max payment filter in GET /gigs not validated** — negative values or min > max silently returned wrong results | Validates both are non-negative integers and min ≤ max; haversine SQL refactored to use typed numeric locals |
| A12 | **MWA error helpers used `any` type** | Introduced `MwaError` interface + `isMwaError` type guard; `catch` block changed to `unknown` |
| A13 | **`replayAll` overwrote in-memory queue from disk** — unsaved in-memory items dropped on merge | Merges disk items into in-memory queue using Set deduplication by id |
| 17 | **`statusCache` grew indefinitely** — no eviction of expired entries | `plugins/auth.ts`: added eviction sweep on every cache miss |
| 20 | **`GET /admin/platform-config` returned empty body if table unseeded** | Returns 404 with clear error message |
| 21 | **No upper bound on `grace_period_seconds`** — could be set to an arbitrary value | Capped at 30 days (2,592,000 s) with validation error on exceeded value |
| 23 | **No readiness probe** — `GET /health` skips DB; k8s can't detect broken DB connection | Added `GET /health/ready` running `SELECT 1`; returns 503 on failure. Both health routes rate-limited (60/min liveness, 30/min readiness) |
| 32 | **PATCH draft gig skipped deadline re-validation** — past `accept_deadline` accepted | `routes/v1/gigs/_id/index.ts`: calls `validateGigDeadlines` with effective post-PATCH values |
| 33 | **`requireRole` called `jwtVerify()` redundantly** — token already verified by `authenticate` | `lib/guards.ts`: removed redundant `jwtVerify()` call |
| 34 | **`GET /gigs/:id` fetched poster and worker sequentially** | Wrapped poster + worker + proofs + dispute in a single `Promise.all` |
| 35 | **`pino-pretty` and `level: 'debug'` hardcoded in production** | `server.ts`: conditionally applies pino-pretty and `debug` level only when `NODE_ENV !== 'production'` |
| 36 | **`getConnection()` created a new Solana `Connection` on every call** | `lib/solana.ts`: module-level singleton; `getConnection()` returns cached instance |
| 37 | **`SOLANA_PROGRAM_ID` had a placeholder fallback** — wrong program ID used silently if env missing | Moved to `REQUIRED_ENV_VARS`; startup validates base58 format |
| 38 | **`GET /blockchain/transaction/:signature` was unauthenticated** — any caller could drain RPC quota | Added `preHandler: [fastify.authenticate]` |
| 58 | **`startBlockchainFlow` could leave state partially set on signing error** | Wrapped in try/catch; clears `pendingSignature`, `pendingAction`, `pendingSyncId` in catch before re-throwing |
| 59 | **`mwaAuthToken` null tap was a silent no-op** | Shows toast "Wallet not connected — please reconnect and try again" before returning |
| 60 | **Proof upload failure silently lost all selected files** | Upload loop returns on first failure; per-file toast names the failing file; `proofFiles` retained for retry |
| 61 | **Dispute/review form state persisted across sheet opens** | `handleClose` resets `disputeReason`, `reviewScore`, and `reviewComment` before calling `onClose()` |
| 62 | **No confirm modal before "Claim Refund"** — blockchain tx fired immediately | Added confirm modal (same pattern as cancel/approve) with `ActiveSheet = 'refund'` |
| 63 | **`accept_deadline` displayed without time when < 24 h away** | `lib/gig-display.ts:formatDeadline`: uses `toLocaleString` with hour/minute when deadline < 24 h |
| 65 | **Review score range not enforced server-side** — score 0 or 6 could corrupt AVG | `review.ts`: `isValidReviewScore` helper rejects values outside 1–5 with 400 |
| 66 | **Gig UUID not asserted before borsh encoding** — multi-byte chars silently malformed instruction | `lib/solana.ts:encodeBorshCreateGigArgs`: UUID regex assertion throws on invalid input |
| 71 | **`solToNgn` division-by-zero if CoinGecko returns 0** — rendered `Infinity`/`NaN` | `lib/currency.ts`: guards `solToNgn <= 0`; returns `naira: 0` safely |
| 73 | **No index on `gigs.accept_deadline`** — batch expiry degraded to sequential scan | `db/schema.ts`: added `index('gigs_accept_deadline_idx').on(t.accept_deadline)` |
| 74 | **Admin could suspend another admin** — no cross-admin guard on status update | Fetches target role before update; returns 403 if target is admin |
| 75 | **No audit log for user suspension/reinstatement** | `fastify.log.info({ adminId, targetId, newStatus }, 'User status changed')` added after successful update |
| 76 | **`PATCH /admin/platform-config` silently returned empty body when config row missing** | Added `if (!updated)` check returning 404 |
| 77 | **No server-side limit on proof count in `POST /gigs/:id/submit`** | Returns 400 if `proofs.length > 10` |
| 78 | **Haversine filter parameters not range-validated** — `lat=999` silently passed to Postgres | Validates `lat ∈ [−90, 90]`, `lng ∈ [−180, 180]`, `radius_km ∈ (0, 20 000]`; returns 400 on invalid |
| 79 | **`uploadToCloudinary` had no timeout** — hangs indefinitely on slow network/outage | Wrapped in `AbortController` with 120 s timeout; `AbortError` surfaced as user-friendly toast |
