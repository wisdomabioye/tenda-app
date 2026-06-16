# Wallet (adapter-based multi-transport)

**Status: promoted (live).** This started as a spike validating self-custodial
multichain (Solana + EVM) via a per-wallet **adapter** model; it now backs the
real login (`app/(auth)/connect-wallet.tsx`) and wallet-link
(`app/settings/linked-wallets.tsx`) flows, end-to-end to the server-nonce auth
endpoints. Each transport (MetaMask Connect, Solana MWA, Phantom universal
links) is isolated behind a uniform `WalletAdapter` interface, so consumers
never know which protocol an entry speaks. Transports swap per platform without
touching the consumer surface.

Device-verification status is at the bottom — only the **Android-Solana (MWA)**
path is device-proven; EVM sign + iOS-Phantom remain **#68-gated**.

## Architecture

No React context/provider — screens drive the picker directly and the store
owns the session. The MWA adapter owns its own persisted token (AsyncStorage),
so escrow-tx signing reads it from the adapter, not the auth store.

```
app/(auth)/connect-wallet.tsx   app/settings/linked-wallets.tsx
  (login: signInWithWallet)       (link: linkWalletWith, forceFresh)
            │                              │
            └──────────► <WalletPicker> ◄──┘
                              │ onSelect(adapter)
                              ▼
                      adapters/registry.ts
                  (WalletAdapter[] · isAvailable() per device)
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   metamask.ts           solana-mwa.ts          phantom.ts
  @metamask/connect-evm   Solana MWA (Android)   universal links (iOS)
        │                     │                     │
        └─── adapter.authenticate(buildMessage) ────┘   ← connect + sign nonce
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
        wallet/auth.ts                  wallet/dispatch.ts
  nonce → authenticate → POST      escrow UnsignedTx → sign + broadcast
  /v1/auth/{wallet,link-wallet}    (solana-mwa.signAndSendStored / metamask)
```

Files under `apps/mobile/wallet/`:

| File | Purpose |
|---|---|
| `types.ts` | `SpikeAccount`, `Namespace`, `SignMessageResult` (canonical account types) |
| `config.ts` | Single-source `metadata`, env-driven `SOLANA_NETWORK` + `WALLET_CHAINS` (CAIP-2 ids) |
| `errors.ts` | `WalletError` / `WalletErrorCode` — standalone so pure consumers skip the native barrel |
| `auth.ts` | `signInWithWallet` / `linkWalletWith` — nonce ↔ server orchestration |
| `dispatch.ts` | `signSendAndReport` — routes a server-built `UnsignedTx` to the right transport |
| `index.ts` | Solana RPC helpers (`getBalance`, `getTransactionStatus`) + convenience re-exports |
| `picker.tsx` | `<WalletPicker>` — controlled BottomSheet listing adapters with installed badge |
| `wallet-icon.tsx` | Rounded `Image`-based wallet icon |
| `adapters/types.ts` | `WalletAdapter` interface (connect / sign / **authenticate** / disconnect / restore) |
| `adapters/registry.ts` | Adapter list + `findAdapter` / `requireAdapter` |
| `adapters/connect-then-sign.ts` | Shared `authenticate` composer + `isUserRejection` for split connect/sign transports |
| `adapters/detect.ts` | `canOpenScheme()` wrapper over `Linking.canOpenURL` |
| `adapters/metamask.ts` | MetaMask Connect EVM client (EIP-1193) |
| `adapters/mwa-shared.ts` | Shared MWA helpers (auth/retry/error classification) |
| `adapters/solana-mwa.ts` | Generic Android-Solana entry (MWA routes via OS) + `signAndSendStored` |
| `adapters/phantom.ts` | iOS Phantom universal-link transport (X25519 + nacl.box) |

## Why this design (and not WalletConnect or Reown AppKit)

We tried both first. WC v2 (with our own picker, or via Reown free-tier) is a
single-namespace transport with significant friction: stuck pairings on retry,
flaky DNS to `relay.walletconnect.org`, no auto-return after wallet approval,
hangs in the sign step. Reown's unified multi-namespace session is gated
behind Pro (~$890/yr) and AppKit pulled in wagmi/viem/react-query without
solving the friction.

Adapters per wallet sidestep that entirely — each transport plays to its
strengths (MM Connect's CAIP-25 sessions for EVM, MWA's OS-level chooser for
Android-Solana, Phantom's encrypted universal links for iOS-Solana). The
common `WalletAdapter` shape keeps the consumer surface uniform.

## Chain config (single source)

`config.ts` is the **only** place env → network is encoded:

- `SOLANA_NETWORK` — `Cluster` (`mainnet-beta` in prod, else `devnet`).
- `WALLET_CHAINS` — CAIP-2 ids the **server** registers: `solana` via the shared
  `solanaChainId(SOLANA_NETWORK)` (NOT the genesis-hash form — that was a spike
  bug that 400'd the server), `eip155` Base / Base-Sepolia by env.

`auth.ts` pins `WALLET_CHAINS[account.namespace]` on every signature — the
server only verifies against registered chains, so the account's own `chainId`
is never trusted for auth.

## Picker layout

Adapters' `isAvailable()` is what determines visibility per platform:

| Platform | Entries shown | Transport |
|---|---|---|
| Android | MetaMask, Solana Wallet | MM Connect / MWA (OS picks Phantom/Solflare/etc.) |
| iOS | MetaMask, Phantom | MM Connect / Phantom universal links |

Android collapses all Solana wallets behind one generic **Solana Wallet**
entry because MWA's `transact()` has no local wallet-targeting API — the OS
routes to the default Solana wallet (or shows a chooser if none is default).
On iOS, each Solana wallet exposes its own universal-link protocol, so
per-wallet entries make sense.

## What's installed

| Package | Why |
|---|---|
| `@metamask/connect-evm` | MM Connect EVM client (EIP-1193; W2 rewrite — connectWith sign fallback) |
| `@solana-mobile/mobile-wallet-adapter-protocol-web3js` | Android Solana transport |
| `@react-native-async-storage/async-storage` | Adapter session/auth-token persistence |
| `bs58` | Solana message/signature encoding |
| `lucide-react-native` | `CircleCheck` filled badge for installed wallets |

WC v2, Reown AppKit (`@reown/appkit-*`), wagmi, viem, @tanstack/react-query,
react-native-modal, `@metamask/sdk-react-native` (deprecated), and the
Coinbase Wallet Mobile SDK (unmaintained) were all removed.

## Polyfills

MM Connect's transitive deps (`eciesjs`, `@metamask/mobile-wallet-protocol-*`)
need a browser-like environment. `apps/mobile/shims/polyfills.ts` provides
`Event`/`CustomEvent`/`dispatchEvent`/`addEventListener`, a `window` shim, the
`Buffer` global, and static pre-imports so Metro bundles them into the main
chunk. Node-builtin stubs live in `metro.config.js` (`extraNodeModules`); that
file also redirects `whatwg-url`/`webidl-conversions` to RN-safe builds (admin
jsdom otherwise leaks ES2024 Node libs into the flat-resolved RN bundle).

## Native-config requirement

`apps/mobile/plugins/with-wallet-queries.js` declares wallet deeplink schemes
in `AndroidManifest.xml` `<queries>` and iOS `LSApplicationQueriesSchemes`
(`metamask`, `phantom`, `solflare`). Without these, `Linking.canOpenURL`
returns false on iOS and `openURL` silently fails on Android 11+. The plugin
runs at every `expo prebuild` so the native config stays in sync.

## Device-verification status

Only the **Android-Solana (MWA)** path is device-proven. Everything else is
tracked under **#68** (device verification passes).

| Scenario | Android | iOS | Notes |
|---|---|---|---|
| Solana Wallet (MWA) connect + signMessage (login) | ✅ | — | OS routes to default Solana wallet; round-trip OK with Phantom + Solflare. |
| Solana Wallet (MWA) escrow tx sign + broadcast | ✅ | — | `signAndSendStored` reads the adapter's persisted token; broadcast from app RPC. |
| Solana Wallet (MWA) disconnect | ✅ | — | Local-only (opening the wallet just to revoke is bad UX). |
| MetaMask connect (CAIP-25 multi-scope) | ✅ | ⬜ | Mainnet EVM scopes granted; Base Sepolia often dropped even when enabled in MM. |
| MetaMask `personal_sign` (EVM login/link) | ❌ | ⬜ | **#68** — MM opens but the approval sheet never renders; `invokeMethod` times out (RPCErr53). Failure is below our layer; W2 `connect-evm` rewrite is the unblock attempt. |
| MetaMask EVM escrow send (`eth_sendTransaction`) | ⬜ | ⬜ | **#68** — gated on the sign path above. |
| Phantom (iOS universal links) connect + sign | — | ⬜ | **#68** — implemented (X25519 + nacl.box, base64 sig); never device-verified. |

### Known limitation (post-promotion)

`dispatch.ts` routes `solana-tx` to the MWA adapter only. A **Phantom (iOS)**
login can authenticate but cannot yet sign escrow txs (no Phantom tx-signing in
dispatch). Phantom is `isAvailable: iOS-only`, so the proven Android path is
unaffected; wire Phantom tx-signing when iOS is device-verified (**#68**).

An EVM-primary login leaves `walletAddress` (the Solana-pubkey the balance/fiat
screens read) null, so those screens are empty for an EVM-only user even after
they link a Solana wallet — graceful (null-guarded, no crash). Fix = source the
Solana display address from `wallets[]`; folded into the **#68** EVM-login
verification since that path isn't device-testable yet.

## Promotion criteria — status

Original gate, with current state:

- ✅ Promoted into live login + link; legacy MWA-only `solanaSignIn`/`solanaLinkWallet` retired.
- ✅ Server-nonce flow (`auth.ts`) + `adapter.authenticate(buildMessage)` across all transports.
- ✅ Single-source chain config; signatures pinned to server-registered CAIP-2 ids.
- ✅ Wallet-killed mid-flow surfaces a typed error / decline → `null` (no silent hang); unit-tested.
- ⬜ **#68** — MM Connect sign round-trips on Android + iOS; iOS Phantom connect+sign+disconnect; EVM escrow send; p95 signMessage < 5s on a real network.

If MM Connect signing can't be unblocked on RN, the fallback is MM's own
deeplink (`metamask://wc?uri=…`) over a WC v2 transport for EVM only, keeping
MWA + Phantom universal links for Solana.
