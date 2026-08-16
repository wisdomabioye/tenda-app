@AGENTS.md

# apps/web working rules

## Source of truth

The comps (`docs/web-app-stages/tenda-web-app-design/` + `ui-ux-brief.md`) win on
**visuals** — layout, spacing, tokens, states, empty/error copy.
`apps/mobile` + `@tenda/shared` win on **behaviour** — every flow, data shape, permission
rule, copy, and *which surfaces exist at all*. Before building any screen, read its mobile
counterpart. Where the two disagree, behaviour wins — log the divergence in
`docs/web-app-stages/spec-corrections.md`.

The spec contains confirmed errors: it still designs a wallet **Buy** side, but Buy/onramp
was retired in #61 (correction #1). Never port a surface the product has retired.

**Shell architecture (user, 2026-08-16 — supersedes the 2026-08-15 "chrome need not follow
the comps" direction; see correction #6).** The comps specify three shells, and they are
binding:

| Shell | Used by | Shape |
|---|---|---|
| **Workspace** | Tier 2, Tier 3, Settings & Profile | 64px icon rail \| 380px list column \| detail pane, `height:100vh` with per-pane scrolling |
| **Centered public** | Tier 1 | no rail, max-width 1240px |
| **Focused** | Auth, Post Wizard | no rail, max-width 640–1000px |

Workspace collapses at ≤1100px (list → 320px) and ≤900px (single pane). `apps/tendahq`
remains the marketing/landing surface; this app is purely app functionality.

Route groups map to shells (groups do not change URLs):

| Group | Shell | Guard |
|---|---|---|
| `app/(app)` | workspace | `AuthGate` in the layout |
| `app/(public)` | centered public | none |
| `app/(focused)` | focused | none — `/signin`, `/onboarding/profile` |
| `app/(focused)/(authed)` | focused | `AuthGate` — `/post` |

**Surface / selection contract** (`components/app/workspace/surfaces.ts`). The first
segment inside `(app)` is the *surface*; anything deeper is the *selection*. The detail
pane takes its accessible name from the surface and hands off focus when the selection
changes. **To give a surface a list column, add `app/(app)/@list/<surface>/page.tsx` —
nothing else.** `@list/default.tsx` renders nothing for the rest.

Two signals drive the collapse and they come from different places, deliberately:
whether a **list exists** is a DOM fact read by CSS `:has([data-list])` — it cannot be a
prop, because Next wraps parallel-slot output in boundary elements, so the `list` prop is
an element even when the slot renders nothing; whether a **row is selected** is a URL fact
passed as `hasSelection`. It is not "is a detail pane mounted" — the pane is always
mounted.

## Where API calls come from — the policy

**The Next.js server calls Fastify ONLY for the anonymous public GET surface**; everything
else goes **browser → Fastify directly**. Never add a Next API route that proxies Fastify.

| Caller | Calls | Why |
|---|---|---|
| Next server (RSC / `generateMetadata` / sitemap) | `GET /v1/gigs`, `GET /v1/gigs/:id`, `GET /v1/platform` — the only public endpoints | SEO/OG unfurls need real content in the HTML. The SSR fetch is anonymous by construction, so party-scoped fields cannot leak into crawler-visible pages. |
| Browser (client components) | Every authenticated call, all mutations, WebSocket, wallet signing | The JWT lives in `localStorage` (decision #5, like `apps/admin`) — the Next server never sees it, so it *cannot* make authed calls. `lib/ws.ts` dials Fastify's origin directly; signatures only exist in the browser. |

Consequences:
- Route protection is client-side (skeleton → redirect), like admin. No Edge middleware.
- A page can be both: `/gig/[id]` server-renders the anonymous listing, then the hydrated
  client refetches the same endpoint with the bearer to add the party-scoped half.
- Server components must never import wallet modules (`@walletconnect/core` touches `window`
  at import time). Wallet code sits behind a `client-only` dynamic boundary.
- CORS: the web origin belongs in `CORS_ORIGIN` (never `ADMIN_ORIGIN`).

## Pluggable seams — extend, never fork

- **Data access**: screens call `api/client/*` (via hooks/stores), never `fetch` directly.
- **Wallets**: new wallet transports implement the `WalletAdapter` interface and register in
  the adapter registry; nothing else changes.
- **Chains**: a new chain is a `CHAIN_MANIFEST` entry (+ server env secrets). Zero web code.
- **Balances**: per-chain readers plug into `wallet/balances/`.
- **Payout rails**: `@tenda/shared/fiat/payout/*` registry — never re-encode rail validation.
- **Display helpers**: a formatter used by 2+ clients (or encoding a product-wide display
  rule) lives in `@tenda/shared` — date/relative-time, money-display, countdown, chain-label,
  gig-display and fiat-display helpers moved there 2026-08-15; never copy one into `apps/web`
  (that copy is exactly how drift starts).
- **Brand facts**: every product string and outbound link (name, tagline, description,
  support/legal/social/store URLs, static fee copy) comes from shared `APP_INFO` — never
  typed inline. tendahq composes the same object; only release facts (version, apkUrl) stay
  in tendahq's file because scripts/check-app-version.mjs gates them there.
- **Auth methods**: driven by `GET /v1/auth/methods` + the challenge/verify orchestrator;
  adding a method is UI + config, never a bespoke flow.

## House rules (from /home/abioye/tenda/claude — enforced)

- Grep `packages/shared/src` before writing ANY helper/constant (12.3k LOC of behaviour).
- Max ~300 lines per file — split into folder + barrel. No `any`/`unknown` casts.
- No hardcoded values; amounts are base-unit strings — `BigInt`, never `Number()`.
- Tests co-located in `__tests__/`, positive AND negative cases, coverage >90 (the vitest
  coverage `include` list ratchets: porting a directory adds it there with its tests).
- `styles/tokens.css` is GENERATED (`pnpm gen:tokens`); never hand-edit, CI diffs it.
- `ConfirmDialog` for confirmations, toast for fire-and-forget — never `window.confirm()`.
- After changing shared: `pnpm --filter @tenda/shared build`.
