# Tenda Web (`apps/web`)

Browser version of `apps/mobile` — Next.js 16 + Tailwind v4, dev on **:3200**.

- Staged plan: `docs/web-app-stages/` (repo root `/docs`) — stages 0–8, each independently shippable.
- Design direction: `docs/web-app-stages/ui-ux-brief.md`. **The design spec is not authoritative** — `apps/mobile` + `@tenda/shared` win every conflict; log divergences in `docs/web-app-stages/spec-corrections.md`.
- Data-access + pluggability policy: see `CLAUDE.md` in this directory.

```bash
pnpm --filter web dev          # :3200
pnpm --filter web build
pnpm --filter web test
pnpm --filter web type-check
pnpm --filter web gen:tokens   # regenerate styles/tokens.css from apps/mobile/theme/tokens.ts
```

Remember: after changing `packages/shared`, run `pnpm --filter @tenda/shared build`.
