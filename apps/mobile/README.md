# tenda-mobile

React Native app for the Tenda gig marketplace. Android only (for now).

## Stack

Expo SDK · Expo Router · Unistyles · Zustand · Solana Mobile Wallet Adapter · Sentry

## Setup

```bash
pnpm install
pnpm --filter @tenda/shared build   # required before first run

# Start dev client (requires a development build installed on device/emulator)
pnpm dev
```

## Builds

```bash
pnpm build:apk   # Android APK via EAS (preview profile → staging)
pnpm build:aab   # Android AAB via EAS (production profile)
```

EAS build profiles: `development` → `preview` (staging) → `production`.
Set `APP_ENV` in each profile in `eas.json` — do not rely on the profile name.

## Smart contracts

[github.com/wisdomabioye/tenda-escrow](https://github.com/wisdomabioye/tenda-escrow)
