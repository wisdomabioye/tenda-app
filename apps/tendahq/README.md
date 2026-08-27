# tendahq

Landing page for [tendahq.com](https://tendahq.com).

Vite · React 19 · TypeScript · Tailwind CSS v4 · React Router · Lucide

## Setup

```bash
pnpm install
pnpm dev       # http://localhost:5173
```

`VITE_API_BASE_URL` is required at build/dev time (see `.env.example`;
`.env.development` points at the local server).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm build` | Production build → `dist/` |
| `pnpm preview` | Preview the production build locally |
| `pnpm lint` | eslint |

## Routes

`/` (landing) · `/terms` · `/privacy`

## Content layer

All editorial content lives in `src/content/` — edit there, not in components:

| File | Owns |
|---|---|
| `app-info.ts` | Name, taglines, distribution URLs, socials, version, chain identity |
| `chains.ts` | Chain registry **derived from `@tenda/shared` CHAIN_MANIFEST** (mainnet entries) + marketing display extras. A chain added to the manifest appears here automatically |
| `tasks.ts` / `trades.ts` | Example gigs (hero TaskDeck + wall) / example P2P corridors (TradeDeck) |
| `features.ts` / `ecosystems.ts` | Onboarding-rail cards / per-chain proof points |

Per-section prose stays in each section's `content.ts`
(`src/components/sections/<name>/content.ts`). No raw copy strings in JSX.

`@tenda/shared/chains` is aliased to the package's TS **source** in
`vite.config.ts` + `tsconfig.app.json` (linked workspace packages skip Vite's
CJS interop, and bundling source avoids a build-order dependency).

## Theming

Design tokens live in `src/index.css` — dark-first, blue + neutral. The page
renders in ONE theme: sections vary only by `surface` tint (`base`/`alt`),
never by pinning their own theme. Brand blues do all decorative work;
green/orange/red are semantic feedback only; per-chain brand colours appear
only as micro-dots. Fonts: Outfit (display), Instrument Sans (body),
JetBrains Mono (numeric).
