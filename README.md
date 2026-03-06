# Tenda

Trustless gig marketplace on Solana. Workers and posters transact through on-chain escrow — no middlemen, no custodial risk.

**Website:** [tendahq.com](https://tendahq.com)

## Monorepo structure

```
apps/
  mobile/       React Native (Expo) — Android app
  server/       Fastify API — REST backend + business logic
  tendahq/      Vite landing page — tendahq.com
packages/
  shared/       Shared types, schema, API contracts, utilities
```

## Prerequisites

- Node.js >= 22
- pnpm 10
- Turbo (installed as devDependency)

## Getting started

```bash
pnpm install

# Build shared package first (required before running server or mobile)
pnpm build:shared

# Run all dev servers
pnpm dev

# Run individually
pnpm dev:server
pnpm dev:mobile
```

## Useful commands

| Command | Description |
|---|---|
| `pnpm build` | Build all packages |
| `pnpm build:shared` | Build shared package only |
| `pnpm type-check` | Type-check all packages |
| `pnpm lint` | Lint all packages |
| `pnpm clean` | Remove all build artifacts and node_modules |
| `pnpm build:apk` | Build Android APK via EAS |
| `pnpm build:aab` | Build Android AAB via EAS |

## Tech stack

| Layer | Tech |
|---|---|
| Mobile | React Native, Expo, Expo Router, Unistyles |
| Server | Fastify v5, TypeScript, Drizzle ORM, PostgreSQL |
| Blockchain | Solana (devnet), Anchor smart contracts |
| Auth | Solana wallet signature + JWT |
| Storage | Cloudinary (proof files) |
| Push | Expo Push Notifications |
| Infra | EAS Build, Turbo, pnpm workspaces |

## Smart contracts

Anchor programs: [github.com/wisdomabioye/tenda-escrow](https://github.com/wisdomabioye/tenda-escrow)
