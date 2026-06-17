# schema-v2 — Multichain Foundation

> The new collapsed schema per
> [`multichain-migration-stages/stage-0-foundation.md`](../../../../../../multichain-migration-stages/stage-0-foundation.md)
> § Database. Lives alongside the legacy `schema.ts` during planning. Promoted
> to `schema/` (and `schema.ts` deleted) at Stage 0 cutover — see
> [`stage-0-cutover-checklist.md`](../../../../../../multichain-migration-stages/stage-0-cutover-checklist.md).

**No migration has been generated from this yet.** Per project convention,
the user runs `pnpm --filter @tenda/shared build && pnpm db:generate` only
when the schema is ready to commit — this directory is the typed source for
review, not a live target.

## Layout

| File | Tables / enums |
|---|---|
| `chains.ts` | `chains`, `assets` |
| `identity.ts` | `users`, `user_wallets`, `user_identities`, `auth_nonces`, `auth_otps`, `admin_users`, `email_otps`, `gas_grants` |
| `escrow.ts` | `escrows`, `gig_details`, `exchange_details`, `escrow_transactions`, `tx_attempts`, `escrow_proofs` |
| `governance.ts` | `disputes`, `reviews`, `platform_config` |
| `ops.ts` | `chain_cursors` |
| `index.ts` | barrel — re-exports everything |

Tables that carry forward unchanged from the legacy schema (conversations,
messages, device_tokens, gig_subscriptions, reports, announcements,
blocked_keywords) stay in `schema.ts` until cutover, then are copied here
into `messaging.ts` + `reports.ts` splits per the comment in `index.ts`.
Tracked under `multichain-migration-stages/stage-0-cutover-checklist.md` § 2.

## Conventions

- **Amount columns**: `numeric(78, 0)` named `*_raw`. Never `bigint`.
  Drizzle returns these as `string` in JS; format at the boundary.
- **Enums**: use `pgEnum` (matches existing schema style). Where a TS union
  is also needed (e.g. `ChainNamespace`), derive it from the pgEnum via
  `(typeof pgEnumValue.enumValues)[number]` so the runtime + type stay in sync.
- **Foreign keys**: explicit `.references(() => other.id, { onDelete: ... })`.
  Default Postgres behaviour is `NO ACTION`; the codebase prefers `'restrict'`
  for user-owned rows (escrow history must block hard-delete) and `'cascade'`
  for owner-scoped child tables (proofs, OTPs, exchange/gig details).
- **Indexes**: declared in the second arg of `pgTable`. Stage-0 specifies
  exactly which; we don't add extras "just in case."
- **Constraints**: `CHECK` and `UNIQUE` are named (`check('<name>', ...)`,
  `unique('<name>')`, `uniqueIndex('<name>')`) so generated migrations are
  diff-able and constraints are referenceable by name in raw SQL.
- **No `any` / `unknown` casts** (project rule).

## ⚠ `$onUpdate` semantics

`users.updated_at` and `escrows.updated_at` use Drizzle's `.$onUpdate(...)` to
auto-bump the timestamp. **This only fires when the UPDATE is issued through
Drizzle's `.update().set(...)` builder** — `db.execute(sql\`UPDATE ...\`)` or
any raw SQL path will leave the column stale.

Two options for code paths that must bump `updated_at`:

1. Always go through Drizzle's builder (lint / PR review).
2. Add Postgres `BEFORE UPDATE` triggers in the cutover migration so the bump
   is path-independent. Recommended for `users` / `escrows`.

Tracked in `multichain-migration-stages/stage-0-cutover-checklist.md` § 10.2.
