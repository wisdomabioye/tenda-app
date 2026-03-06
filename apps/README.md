# Apps

This directory contains the deployable applications in the Tenda monorepo.

## mobile (`tenda-mobile`)

React Native app built with Expo. Currently Android-only (iOS coming).

- **Framework:** Expo SDK, Expo Router (file-based navigation)
- **Styling:** Unistyles
- **State:** Zustand
- **Wallet:** Solana Mobile Wallet Adapter
- **Build:** EAS Build — profiles: `development`, `preview` (staging), `production`

```bash
# Start dev client
pnpm dev:mobile

# Build APK (preview)
pnpm build:apk
```

## server (`tenda-server`)

REST API backend powering the mobile app.

- **Framework:** Fastify v5 with fastify-cli
- **ORM:** Drizzle + PostgreSQL
- **Auth:** Solana wallet signature verification + JWT (7-day expiry)
- **Storage:** Cloudinary (proof files)
- **Push:** Expo Push Notification API

```bash
pnpm dev:server
```

Environment variables required: see `apps/server/.env.example`.

## tendahq

Landing page for [tendahq.com](https://tendahq.com).

- **Framework:** Vite + React + TypeScript (SWC)
- **Styling:** Tailwind CSS v4
- **Routes:** `/`, `/terms`, `/privacy`

```bash
cd apps/tendahq
pnpm dev
pnpm build
```
