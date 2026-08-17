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

**Tier-1 public shell.** `app/(public)/layout.tsx` applies NO measure — its pages are
full-bleed sections that each centre their own content at `max-w-content` (1240px, a
`--container-content` theme token) — `/support` included, since #13 gave it the comp's
two-column shell and it now owns the same measure as the feed. **Do not add a
`loading.tsx` to a public route**: it wraps the segment in a Suspense boundary, and React
streams the real content behind an inline script that swaps it in — so with JavaScript
disabled the page renders an empty `<main>`. The feed is the anonymous, indexable front
door; `e2e/public-discovery.spec.ts` runs it with `javaScriptEnabled: false` as the
tripwire. A client-fetched surface (`/home`) may show `FeedSkeleton` freely — no Suspense
is involved there.

**The same trap has a second form: `error.tsx` is a client component too.** Its
fallback is swapped in by the hydration script, so a server-side read failure
rendered a completely blank page with JavaScript off — measured — on the one
surface whose premise is that it works without the bundle, at the moment a
reader most needs telling their escrow is untouched. So a public page **handles
its own read failure**: `listGigsOnce` answers `null` instead of throwing, the
page renders `FeedErrorStatic` server-side, and `generateMetadata` marks that
render `noindex` because it necessarily answers HTTP 200. `error.tsx` stays for
anything thrown elsewhere in the tree. The rule for both forms: *if it only
appears after hydration, an anonymous visitor may never see it.*

Two more rules this shell learned the hard way, both measured in a real browser:

- **The public header row must fit 320px.** It cannot wrap and nothing in it
  shrinks, so anything that does not fit pushes the sign-in button past the
  viewport and scrolls the whole *document* sideways — on the anonymous front
  door, where most traffic is mobile. `px-6` is the measure (it aligns the
  wordmark with the hero) and is not reduced; the gap and the link that
  duplicates the wordmark's destination are what give. `e2e/public-discovery`
  asserts `scrollWidth === clientWidth` at 320/360/390.
- **A group of filter links needs `role="group"` + `aria-labelledby`.** The
  comps group them visually; a bare eyebrow above them conveys nothing to
  assistive tech, and the rail then reads as one flat run of 25 links with
  three different "All …" entries pointing at `/gigs`. `RailSection` owns this;
  `SiteFooter`, `ChainFilterChips` and `ListColumn` are the same pattern.
- **Every crawlable view declares `alternates.canonical`**, built from the same
  `gigsHref` normalisation the rail links use, so position keys and the default
  sort cannot mint a duplicate of a page that already exists.

### /foundations

`/foundations` is the visual companion to the token drift gate: the palette, the
type scale and every primitive in its real states. It is `noindex` and
deliberately **not** in the public nav (spec-correction #21) — go to the URL.

Nothing on it is hand-listed, and that is the rule to keep. Swatches come from
`flattenScheme(colors.light)`, the same transform `scripts/gen-web-tokens` runs
to WRITE `styles/tokens.css`, so the page cannot show a colour the app does not
ship. The controls are the shipped components, not restyled copies, so a variant
that regresses regresses here and one that is added and never wired up is
visibly missing. A hardcoded list on this page would be the single bug it exists
to prevent.

### Text a poster wrote

`title`, `description` and `city` are free text typed by a user and rendered on
an anonymous public page. A poster pasting a link into a title is ordinary, and
before this was handled it overflowed `/gigs` by **474px at 360px** — and still
30px at 1100px, because the card grid's track count changes what fits.

Containing it takes **two** things, and each is inert without the other:

1. `break-words` on the text, and
2. a `min-w-0` on the flex/grid **item** that contains it.

The second is the one that gets forgotten. `overflow-wrap: break-word` does not
reduce an element's *min-content* width, and a flex/grid item defaults to
`min-width: auto` — "never shrink below min-content" — so the item still sizes
to the longest unbreakable token and drags its track out. Adding `break-words`
alone was measured to change nothing at all.

Put `min-w-0` only where it is load-bearing and **verify by removing it**: on
this surface exactly one was (the feed card). The same class on the `<li>`, on
`/home`'s `<li>` and on the detail `<article>` was measured to make no
difference and is not shipped — a class that does nothing beside a comment
saying it matters is worse than no class.

Choose per surface between breaking and truncating: a feed card truncates its
place line (one line, scannable), the detail page breaks it (the reader is
deciding on that fact, and half a location is worse than two lines).

`e2e/public-discovery.spec.ts` asserts `scrollWidth === clientWidth` at
320/360/390 and at 768/900/1100/1280, against `unbreakableGig` — a fixture that
rides in the normal feed so every test sees it.

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
