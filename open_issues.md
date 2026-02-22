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
| 17 | `statusCache` Map in `authenticate` grows indefinitely — no eviction of expired entries | `plugins/auth.ts` | Add periodic cleanup sweep or replace with a small LRU cache library |
| 20 | `GET /v1/admin/platform-config` returns empty if the table is unseeded | `routes/v1/admin/index.ts` | Fall back to env defaults (mirroring `getPlatformConfig`) or return a clear 404 |
| 21 | No upper bound on `grace_period_seconds` in admin update — can be set to an arbitrarily large value | `routes/v1/admin/index.ts` | Cap at 30 days (2,592,000 seconds) |
| 23 | No readiness probe — `GET /health` skips DB check; k8s can't distinguish a healthy pod from one with a broken DB connection | `routes/health.ts` | Add `GET /health/ready` that runs `SELECT 1` for use as a k8s readiness probe |
| 25 | No full-text search on gig title/description — `GET /v1/gigs` supports location/category/price but no keyword search | `routes/v1/gigs/index.ts`, `db/schema.ts` | Add `q` query param; use Postgres `tsvector` + GIN index or `ILIKE` for MVP |
| 26 | Cloudinary upload signature doesn't constrain file size or type — server signs anything | `lib/cloudinary.ts` | Add `max_file_size` and `allowed_formats` to the signature params per upload type |
| 27 | Admin route response types not in shared contracts — a future admin web panel would need to type responses manually | `packages/shared/src/api/contracts/` | Add `AdminContract` to `@tenda/shared` when an admin panel is built |
| 32 | PATCH draft gig skips deadline re-validation — `accept_deadline` can be set to a past date; the gig publishes but becomes immediately un-acceptable | `routes/v1/gigs/_id/index.ts` | Call `validateGigDeadlines` in the PATCH handler when `accept_deadline` is present |
| 33 | `requireRole` calls `jwtVerify()` redundantly — token already verified by `authenticate`; second call is a no-op but misleading | `lib/guards.ts` | Remove `jwtVerify()` call; just check `request.user.role` directly |
| 34 | `GET /v1/gigs/:id` fetches poster and worker in sequential queries — worker fetch is a separate `await` after poster | `routes/v1/gigs/_id/index.ts` | Wrap poster + worker fetches in `Promise.all` |
| 35 | `pino-pretty` and `level: 'debug'` hardcoded — slow in production; verbose logs pollute aggregators | `server.ts` | Conditionally apply pino-pretty and set level based on `NODE_ENV` |
| 36 | `getConnection()` creates a new Solana `Connection` on every call — wastes websocket/HTTP connections and slows RPC | `lib/solana.ts` | Create a singleton connection, re-use across calls |
| 37 | `SOLANA_PROGRAM_ID` has a placeholder fallback — if env var is missing, `deriveEscrowAddress` silently uses the wrong program ID | `config.ts` | Move `SOLANA_PROGRAM_ID` to `REQUIRED_ENV_VARS`; remove placeholder default. Also validate with `new PublicKey(SOLANA_PROGRAM_ID)` inside `loadConfig` to catch malformed values at startup |
| 38 | `GET /v1/blockchain/transaction/:signature` is unauthenticated — any caller can exhaust the Solana RPC quota | `routes/v1/blockchain/transaction.ts` | Add `preHandler: [fastify.authenticate]` |
| 39 | On-chain split dispute has 1-lamport dust when payment is odd — `payment_amount / 2` rounds down in Rust, leaving 1 lamport unaccounted | `tenda-escrow/…/resolve_dispute.rs` | Contract-level fix: send remainder to worker or platform; server can enforce even `payment_lamports` for split-eligible gigs |
| 58 | **`startBlockchainFlow` can leave state partially set on signing error** — if `signAndSendTransactionWithWallet` throws after the outer handler passes control, `pendingAction`/`pendingSignature` are never set but error toast fires correctly; however if it throws mid-function state is inconsistent | `app/gig/[id].tsx:startBlockchainFlow` | Wrap the entire body in try/catch; call `setPendingSignature(null)` + `setPendingAction(null)` in the catch before re-throwing to the caller |
| 59 | **`mwaAuthToken` null tap is a silent no-op** — tapping any blockchain CTA when the wallet is disconnected returns immediately with no feedback | `app/gig/[id].tsx` — all `handleX` functions | Show a toast: "Wallet not connected — open your wallet app to proceed" before returning |
| 60 | **Proof upload failure loses selected files** — if upload fails on file 3 of 5, `onProofsReady` is never called and `proofFiles` is cleared, losing all selections | `app/gig/_components/GigActionSheets.tsx:handleSubmitProof` | On failure, retain `proofFiles`; show per-file error state and allow retry of failed files only |
| 61 | **Dispute/review form state not reset on sheet dismiss** — text/score typed before dismissing persists when the sheet is reopened | `app/gig/_components/GigActionSheets.tsx` | Reset `disputeReason`, `reviewScore`, and `reviewComment` in the `onClose` handler |
| 62 | **No confirm modal before "Claim Refund"** — button fires a blockchain tx directly with no explanation of gas cost | `app/gig/_components/GigCTABar.tsx` | Add a confirm modal (same pattern as cancel/approve) explaining "This will trigger an on-chain transaction" |
| 63 | **`accept_deadline` shown without time component** — if deadline is in 3 hours, user sees only the date | `app/gig/[id].tsx:formatDate` | Use `toLocaleString` with `hour`/`minute` options when deadline is < 24 h away |
| 64 | **`batchExpireGigs` runs in the request path** — on two pods the batch runs twice per minute; on a high-traffic instance it adds latency to every `GET /v1/gigs` response | `lib/gigs.ts` | Move to a dedicated cron job or pg_cron so it runs once regardless of pod count |
| 65 | **`isValidReviewScore` range not visibly enforced server-side** — if the helper only type-checks, a score of 0 or 6 can corrupt the `reputation_score` AVG | `routes/v1/gigs/_id/review.ts` | Add explicit: `if (score < 1 \|\| score > 5 \|\| !Number.isInteger(score)) return 400` |
| 66 | **Gig UUID not asserted to be ASCII before borsh encoding** — `encodeBorshCreateGigArgs` uses byte length as UTF-8 length; if any gig ID ever contains multi-byte characters the instruction data is silently malformed | `lib/solana.ts:encodeBorshCreateGigArgs` | Add: `if (!/^[0-9a-f-]{36}$/.test(gigId)) throw new Error('gig_id must be a UUID')` |
| 71 | **`solToNgn` division-by-zero if CoinGecko returns 0** — `toPaymentDisplay` divides lamports by `solToNgn` to compute naira; if the API returns `0` or the property is missing the result is `Infinity` / `NaN`, which renders as blank or crashes `MoneyText` | `stores/exchange-rate.store.ts`, `lib/currency.ts` | Guard in `toPaymentDisplay`: `if (!solToNgn \|\| solToNgn <= 0) return { sol: ..., naira: 0 }`; also validate the CoinGecko response before updating the store |
| 72 | **Cloudinary upload signature expires 10 minutes after generation** — `generateUploadSignature` bakes in the server timestamp; if the mobile client queues the upload (slow network, background processing) and more than 10 minutes pass, Cloudinary rejects the upload with a 401 | `lib/cloudinary.ts`, `apps/mobile/lib/upload.ts` | Fetch a fresh signature immediately before each `fetch(…/auto/upload)` call rather than caching it; or pass `eager_async=true` with a webhook |
| 73 | **No index on `gigs.accept_deadline`** — `batchExpireGigs` filters `status = 'open' AND accept_deadline IS NOT NULL AND accept_deadline < now()`; without an index on `accept_deadline` this degrades to a sequential scan once the gigs table grows | `packages/shared/src/db/schema.ts` | Add `index('gigs_accept_deadline_idx').on(t.accept_deadline)` inside the gigs table definition |
| 74 | **Admin can suspend another admin** — `PATCH /v1/admin/users/:id/status` guards only against self-demotion on role changes; no equivalent guard prevents admin A from suspending admin B, potentially causing a denial-of-service against platform operators | `routes/v1/admin/index.ts:61-90` | Fetch the target user's current role; return 400 `FORBIDDEN` if `targetUser.role === 'admin'` and the caller is not a designated super-admin (or at minimum prevent cross-admin suspension) |
| 75 | **No audit log for user suspension / reinstatement** — `PATCH /users/:id/role` emits a `fastify.log.info` entry but `PATCH /users/:id/status` does not; suspension events are invisible to auditors and log aggregators | `routes/v1/admin/index.ts:74-89` | Add `fastify.log.info({ adminId: request.user.id, targetId: id, newStatus: status }, 'User status changed')` immediately after the successful update |
| 76 | **`PATCH /v1/admin/platform-config` silently returns `undefined` if the config row was never seeded** — `WHERE id = 1` matches no rows, `updated` is `undefined`, Fastify serialises it as an empty body without an error status | `routes/v1/admin/index.ts:189-199` | After the update, check `if (!updated)` and return 404 or 500; also ensure the migration seeds a row with defaults so this path is never hit |
| 77 | **No server-side limit on proof count in `POST /gigs/:id/submit`** — the mobile `FilePicker` caps at 5 files, but the API imposes no upper bound on `proofs.length`; a crafted request can insert an arbitrary number of rows into `gig_proofs` | `routes/v1/gigs/_id/submit.ts:86-93` | Add `if (proofs.length > 10) return reply.code(400).send({ ..., code: ErrorCode.VALIDATION_ERROR })` before the URL validation loop |
| 78 | **Haversine filter query parameters not range-validated** — `lat`, `lng`, and `radius_km` are read from the query string and cast with `Number()`; values like `lat=999` or `radius_km=-1` are silently passed into the Postgres `acos/cos` call, producing `NaN` or silently empty results | `routes/v1/gigs/index.ts:59-68` | Validate before the query: `if (lat < -90 \|\| lat > 90 \|\| lng < -180 \|\| lng > 180 \|\| radius_km <= 0) return reply.code(400)…` |
| 79 | **`uploadToCloudinary` has no timeout** — the bare `fetch(…/auto/upload)` call has no `AbortController`; large video files or a Cloudinary outage can hang the proof-submission bottom sheet indefinitely with no way to dismiss | `apps/mobile/lib/upload.ts` | Wrap in an `AbortController` with a 90–120 s timeout; catch `AbortError` and surface it as "Upload timed out — please try again" |
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
