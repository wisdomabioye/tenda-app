# test/helpers/

Shared infrastructure for unit / schema / route / adapter / job tests per
[`multichain-migration-stages/testing-strategy.md`](../../../../../multichain-migration-stages/testing-strategy.md).

| File | Purpose | Status |
|---|---|---|
| `test-app.ts` | `useTestApp()`/`buildTestApp()` — real Fastify app over a dedicated Postgres (`TEST_DATABASE_URL`) with a fake chain registry; cross-process suite lock, `resetDb()`, `createUser()`, `createEscrow()` DB-backed fixtures | **Implemented** — supersedes the old `db.ts` scaffold |
| `escrow-states.ts` | `partiedEscrow()`, `openGig()`, request-body builders shared by the `test/integration/escrows-*` route-matrix suites | **Implemented** |
| `redis.ts` | `withTestRedis(t, fn)` — flushed Redis for BullMQ tests | Types-only; arrives with `plugins/queue.ts` |
| `chain.ts` | `mockSolanaRpc({...})`, `mockEvmRpc({...})` — no real RPC in unit/route tests | Types-only; concrete impls live in adapter tests |
| `fixtures.ts` | `userFixture()`, `walletFixture()`, `escrowFixture()`, … typed object factories | **Implemented** — usable now |

The existing `apps/server/test/helper.ts` (Fastify-cli's `build`) stays as-is;
new helpers extend rather than replace it.

## Convention

- Helpers exist so every test reads "what's being asserted" not "how DB / Redis / chain mocks are wired."
- Anything that touches an external service is in `test/integration/`, not `test/{unit,routes,schema,chains,jobs}/`. Integration suites are opt-in (not on every PR).
- No `any` / `unknown` casts (project rule); fixtures expose narrow, intentional types.

## Importing

Helpers use the `@server/*` alias the same as runtime code:

```ts
import { userFixture, escrowFixture } from '@server/../test/helpers/fixtures'
```

(Or relative paths — the project's tsconfig doesn't currently extend the
alias into `test/`. Update tsconfig.test.json if cross-tree imports become
common.)
