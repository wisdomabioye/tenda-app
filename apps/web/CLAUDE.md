@AGENTS.md

# apps/web working rules

## Source of truth

`apps/mobile` + `@tenda/shared` define every flow, data shape, permission rule and copy.
The UI/UX spec (`docs/web-app-stages/tenda-web-app-design/`, `ui-ux-brief.md`) is **visual
direction only** and contains confirmed errors (e.g. it designs a Buy side; Buy/onramp was
retired in #61). Before building any screen, read its mobile counterpart. Where spec and
mobile disagree, mobile wins — log the divergence in `docs/web-app-stages/spec-corrections.md`.

Design direction (user, 2026-08-15): navbars and chrome do **not** strictly follow the design
comps — keep them clean, simple and modern. `apps/tendahq` is the marketing/landing surface;
this app is purely app functionality.

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
