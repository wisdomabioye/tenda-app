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

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 14 | Rate limit keys on proxy IP, not client IP — all requests behind Nginx/Docker share one IP, making the limit effectively global | `plugins/rate-limit.ts`, server init | Set `trustProxy: true` in Fastify server options; forward real client IP via `X-Forwarded-For` header |
| 28 | TOCTOU race on gig accept — two workers submitting simultaneously both pass the status check and overwrite `worker_id`; the `UPDATE` has no `AND status = 'open'` guard. Same pattern in `approve.ts`, `dispute.ts`, `submit.ts` | `routes/v1/gigs/_id/accept.ts` + others | Add `eq(gigs.status, 'open')` to UPDATE WHERE clause inside transaction; if no row returned respond 409 |

### 🟠 Significant

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| 15 | Role promotion doesn't take effect until JWT expiry — `requireRole` reads the JWT payload, not the DB; a newly promoted admin can't access admin routes until re-auth | `lib/guards.ts`, `routes/v1/admin/` | Add `PATCH /v1/admin/users/:id/role`; consider short-lived tokens or force re-auth on role change |
| 16 | CORS is wide open (`origin: true`) — any origin is accepted | `plugins/cors.ts` | Restrict to known origins (app bundle ID / web domain) before production |
| 18 | Duplicate on-chain signatures can be recorded — client retries on approve/publish write the same signature twice, creating phantom fee records | `db/schema.ts` | Add unique index on `gig_transactions.signature` + handle 409 gracefully in affected routes |
| 19 | No API endpoint to promote a user to admin — requires direct DB access | `routes/v1/admin/index.ts` | Add `PATCH /v1/admin/users/:id/role` with strict guard; log all role changes |
| 22 | Module-level caches don't work across multiple server instances — `getPlatformConfig` 5-min cache and `batchExpireGigs` 60s throttle live in process memory; each pod has independent state | `lib/platform.ts`, `lib/gigs.ts` | Replace with Redis or Postgres advisory locks before horizontal scaling |
| 24 | No push notifications or webhooks — mobile client must poll to learn of status changes (proof submitted, gig approved, dispute raised) | Missing | Implement WebSockets, SSE, or a push notification service (FCM/APNs) |
| 29 | `createEscrowInstruction` uses stale fee — reads `getConfig().PLATFORM_FEE_BPS` (env default) instead of current DB `fee_bps`; after an admin fee update, escrow instructions compute the wrong deposit amount | `lib/solana.ts`, `routes/v1/blockchain/escrow.ts` | Make `createEscrowInstruction` async; pass current `fee_bps` from `getPlatformConfig` |
| 30 | `createEscrowInstruction` builds a plain `SystemProgram.transfer`, not the Anchor program instruction — the GigEscrow account receives SOL but is never initialised; all subsequent contract calls will fail | `lib/solana.ts` | Build the actual `create_gig_escrow` Anchor instruction using the program IDL |
| 31 | Graceful shutdown commented out — `SIGTERM`/`SIGINT` handlers are stubbed; in Docker/k8s the process is killed without draining requests or closing the DB pool | `server.ts` | Uncomment and wire up `server.close()` on SIGTERM/SIGINT |

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
| 37 | `SOLANA_PROGRAM_ID` has a placeholder fallback — if env var is missing, `deriveEscrowAddress` silently uses the wrong program ID | `config.ts` | Move `SOLANA_PROGRAM_ID` to `REQUIRED_ENV_VARS`; remove placeholder default |
| 38 | `GET /v1/blockchain/transaction/:signature` is unauthenticated — any caller can exhaust the Solana RPC quota | `routes/v1/blockchain/transaction.ts` | Add `preHandler: [fastify.authenticate]` |
| 39 | On-chain split dispute has 1-lamport dust when payment is odd — `payment_amount / 2` rounds down in Rust, leaving 1 lamport unaccounted | `tenda-escrow/…/resolve_dispute.rs` | Contract-level fix: send remainder to worker or platform; server can enforce even `payment_lamports` for split-eligible gigs |

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
