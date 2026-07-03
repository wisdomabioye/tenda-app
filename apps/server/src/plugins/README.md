# plugins/

Autoloaded cross-cutting Fastify plugins (loaded before routes; most are
`fastify-plugin`-wrapped so their decorators are app-wide).

| Plugin | Provides |
|---|---|
| `db.ts` | `fastify.db` — Drizzle over postgres-js (`AppDatabase` / `AppTransaction` types) |
| `auth.ts` | JWT verify + `fastify.authenticate`; token refresh |
| `chains.ts` | `fastify.chains` — per-chain adapter registry built from `CHAIN_MANIFEST` + env secrets |
| `queue.ts` | BullMQ producers (typed `JobName` union); 501 stub without `REDIS_URL` |
| `workers.ts` | BullMQ consumers + `REPEATABLES` schedule (in-process with the API — documented decision) |
| `listeners.ts` | Chain event listeners (polling fallback; webhook routes complement) |
| `notifications.ts` | App-event listeners → push/WS fan-out |
| `websocket.ts` | Realtime WS channel (escrow events, chat) |
| `cors.ts` | Browser allow-list — `CORS_ORIGIN` + `ADMIN_ORIGIN` union |
| `rate-limit.ts` | Global + per-route rate limiting (trustProxy-aware) |
| `audit.ts` | `admin_audit_log` writes for admin mutations |
| `sensible.ts` | `@fastify/sensible` helpers |

Schedule drift guard: `test/unit/worker-schedule.test.ts` pins the repeatable
job set — adding a periodic job without scheduling it fails the suite.
