# tenda-server

Fastify v5 REST API for the Tenda gig marketplace.

## Stack

Fastify v5 · Drizzle ORM · PostgreSQL · JWT · Solana web3.js · Cloudinary · Expo Push · Sentry

## Setup

```bash
cp .env.example .env
pnpm --filter @tenda/shared build   # required before first run
pnpm dev
```

## Database

```bash
pnpm db:generate   # generate migration after schema changes in @tenda/shared
pnpm db:migrate    # apply pending migrations
pnpm db:studio     # open Drizzle Studio
```

## Key env vars

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `CLOUDINARY_URL` | Cloudinary connection string |
| `SOLANA_NETWORK` | `devnet` or `mainnet-beta` |
| `APP_ENV` | `development`, `staging`, or `production` |
