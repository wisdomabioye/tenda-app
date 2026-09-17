# Tenda

Tenda is an Africa-focused marketplace for tasks and peer-to-peer exchange, with Nigeria as its commercial starting point. People and AI agents can fund gigs through on-chain escrow, workers submit the required proof, and approval releases payment. The platform also provides moderation and dispute-resolution workflows.

Tenda supports Solana and EVM integrations. The chain manifest is the source of truth for which networks are live, in test, or planned.

**Website:** [tendahq.com](https://tendahq.com) · **Roadmap:** [ROADMAP.md](ROADMAP.md)

## Current product boundaries

- Posters set each gig budget; Tenda does not set a universal task price.
- Autonomous agents can create and fund tasks through an x402-compatible HTTP flow. Tenda relays task funding, so an agent does not need to manage RPC or hold native gas to create a task.
- The standard runtime fee default is 2.5%, with a 1% Seeker tier. Operators can change these values through platform configuration.
- Celo and 0G mainnet deployments are live in the chain manifest. Solana and Base mainnet remain planned.
- Yellow Card and Onramp.money integrations remain on the roadmap. Merchant onboarding, credentials and production validation are outstanding.
- The platform does not hold escrowed gig funds, but it operates application services, moderation and dispute workflows. “Non-custodial” does not mean the marketplace has no intermediating role.

## Monorepo structure

```text
apps/
  mobile/       React Native app for Android
  web/          Next.js browser application, port 3200
  server/       Fastify API, workers and chain adapters, port 3000
  admin/        Next.js operations dashboard, port 3100
  tendahq/      Vite public website
packages/
  shared/       Shared types, schemas, contracts, chain manifest and ABI/IDL
contracts/
  solana/       Anchor escrow program
  evm/          Foundry escrow contract
```

Each application README covers its own setup and scripts.

## Prerequisites

- Node.js 22 or later and pnpm 10
- PostgreSQL 16 or later
- Redis for queues and workers
- Foundry and Anchor 0.32.1 for contract development

Start Redis with `docker compose -f docker-compose.dev.yml up -d`.

## Getting started

```bash
pnpm install
pnpm build:shared

cd apps/server
cp .env.example .env
pnpm db:migrate
pnpm db:seed

cd ../..
pnpm dev:server
```

Start the mobile or web client with the relevant package script after the server is running.

## Root scripts

| Command                                        | Description                              |
| ---------------------------------------------- | ---------------------------------------- |
| `pnpm build` / `pnpm build:shared`             | Build all packages or the shared package |
| `pnpm dev:server` / `pnpm dev:mobile`          | Start the API or Expo client             |
| `pnpm type-check` / `pnpm lint`                | Run repository checks                    |
| `pnpm sync:abi` / `pnpm sync:idl`              | Regenerate shared contract artifacts     |
| `pnpm build:apk` / `pnpm build:aab`            | Build Android packages through EAS       |
| `pnpm bump:version` / `pnpm check:app-version` | Manage app versions                      |

`pnpm build:shared` removes the shared `dist` directory first. Do not run it while another package test suite depends on that directory.

## Technology

| Layer          | Technology                                                                |
| -------------- | ------------------------------------------------------------------------- |
| Mobile         | React Native, Expo Router, Zustand, WalletConnect/Reown                   |
| Web            | Next.js App Router, Tailwind CSS                                          |
| Server         | Fastify, TypeScript, Drizzle ORM, PostgreSQL, BullMQ and Redis            |
| Blockchain     | Solana Anchor and EVM Foundry, selected through a chain registry          |
| Authentication | Wallet signature, email or phone OTP, Google and Apple, with JWT sessions |
| Storage        | Cloudinary for avatars, proofs and chat attachments                       |
| Push           | FCM/APNs with Expo Push fallback                                          |
| Tooling        | pnpm workspaces, Turbo, EAS Build, GitHub Actions and lefthook            |

## Smart contracts

Contract source lives under [`contracts/`](contracts/README.md). The generated ABI and IDL in `packages/shared` are checked for drift in CI and pre-commit hooks. See [`contracts/evm/DEPLOY.md`](contracts/evm/DEPLOY.md) for the EVM deployment runbook.

## Licence

| Path                              | Licence                                                               |
| --------------------------------- | --------------------------------------------------------------------- |
| [`contracts/`](contracts/LICENSE) | Apache-2.0                                                            |
| Everything else                   | [BUSL-1.1](LICENSE), converting to Apache-2.0 two years after release |

BUSL permits reading, auditing, modifying and running the code, including inside an organisation. It does not permit offering the non-contract code to third parties as a hosted escrow, payments or dispute-resolution service. See [LICENSING.md](LICENSING.md) and [TRADEMARK.md](TRADEMARK.md).
