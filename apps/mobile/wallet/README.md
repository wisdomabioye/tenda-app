# Wallet Spike (adapter-based multi-transport)

Validates self-custodial multichain (Solana + EVM) using a per-wallet
**adapter** model. Each transport (MetaMask Connect, Solana MWA, Phantom
universal links) is isolated behind a uniform `WalletAdapter` interface, so the
picker and provider don't know which protocol any given entry speaks. We can
swap transports per platform without touching the consumer surface.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ <WalletSpikeProvider>                           │
│   • Owns connect/disconnect state               │
│   • Renders <WalletPicker>                      │
│   • Exposes useSpikeWallet() via context        │
└─────────────────────────────────────────────────┘
            │
            │ uses
            ▼
┌─────────────────────────────────────────────────┐
│ adapters/registry.ts                            │
│   • Static list of WalletAdapter implementations│
│   • Picker filters by isAvailable() per device  │
└─────────────────────────────────────────────────┘
            │
            ├─── metamask.ts  → @metamask/connect-evm (EIP-1193, EVM-only)
            ├─── solana-mwa.ts → Solana Mobile Wallet Adapter (Android)
            └─── phantom.ts    → Phantom universal links (iOS, device-verify pending)
```

Files under `apps/mobile/wallet/`:

| File | Purpose |
|---|---|
| `types.ts` | `SpikeWalletAPI`, `SpikeAccount`, `Namespace`, `SignMessageResult` |
| `config.ts` | App metadata, env-driven `SPIKE_CHAINS` (CAIP-2 ids) |
| `provider.tsx` | `<WalletSpikeProvider>` + `useSpikeWallet()` context |
| `picker.tsx` | `<WalletPicker>` — BottomSheet listing adapters with installed badge |
| `wallet-icon.tsx` | Rounded `Image`-based wallet icon |
| `adapters/types.ts` | `WalletAdapter` interface (connect / sign / disconnect / restore) |
| `adapters/registry.ts` | Adapter list + `findAdapter` / `requireAdapter` |
| `adapters/detect.ts` | `canOpenScheme()` wrapper over `Linking.canOpenURL` |
| `adapters/metamask.ts` | MetaMask Connect Multichain (EVM + Solana via MM) |
| `adapters/mwa-shared.ts` | Shared MWA helpers (auth/retry/error classification) |
| `adapters/solana-mwa.ts` | Generic Android-Solana entry (MWA routes via OS) |
| `adapters/phantom.ts` | iOS Phantom universal-link transport (X25519 + nacl.box; device verification pending) |
| `../../app/spike-wallet.tsx` | Test screen with connect/sign/disconnect + log |

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

## Picker layout

Adapters' `isAvailable()` is what determines visibility per platform:

| Platform | Entries shown | Transport |
|---|---|---|
| Android | MetaMask, Solana Wallet | MM Connect / MWA (OS picks Phantom/Solflare/etc.) |
| iOS | MetaMask, Phantom | MM Connect / Phantom universal links |

Android collapses all Solana wallets behind one generic **Solana Wallet**
entry because MWA's `transact()` has no local wallet-targeting API — the OS
routes to the default Solana wallet (or shows a chooser if none is default).
A separate Phantom/Solflare row would have been misleading: tapping either
would route through the same OS chooser. On iOS, each Solana wallet exposes
its own universal-link protocol, so per-wallet entries make sense.

## What's installed

| Package | Why |
|---|---|
| `@metamask/connect-evm` | MM Connect EVM client (EIP-1193; W2 rewrite — connectWith sign fallback) |
| `@solana-mobile/mobile-wallet-adapter-protocol-web3js` | Android Solana transport |
| `@react-native-async-storage/async-storage` | Session/auth-token persistence |
| `bs58` | Solana message encoding utilities |
| `lucide-react-native` | `CircleCheck` filled badge for installed wallets |

WC v2, Reown AppKit (`@reown/appkit-*`), wagmi, viem, @tanstack/react-query,
react-native-modal, `@metamask/sdk-react-native` (deprecated), and the
Coinbase Wallet Mobile SDK (unmaintained) were all removed.

## Polyfills

MM Connect's transitive deps (`eciesjs`, `@metamask/mobile-wallet-protocol-*`)
need a browser-like environment. `apps/mobile/shims/polyfills.ts` provides:

- `Event` / `CustomEvent` / `dispatchEvent` / `addEventListener`
- `window` shim with `location` and event APIs
- `Buffer` global
- Static pre-imports of `eciesjs` and the MM mobile protocol packages so Metro
  bundles them into the main chunk (avoids an async-require race that
  manifested as `Cannot set property 'importedAll' of undefined`).

Node-builtin stubs live in `metro.config.js` (`extraNodeModules`).

## Run the validation

1. `pnpm --filter tenda-mobile prebuild` (runs `with-wallet-queries` so Android
   `<queries>` and iOS `LSApplicationQueriesSchemes` are populated for
   `metamask`, `phantom`, `solflare`).
2. `pnpm --filter tenda-mobile android` (full rebuild — Metro reload alone
   won't pick up native manifest changes).
3. On device, navigate to `/spike-wallet`
   (e.g. `adb shell am start -a android.intent.action.VIEW -d "tenda://spike-wallet" com.tendahq.mobile`).
4. Open picker → tap a wallet → approve → Sign auth message → log shows result.

## Findings

| Scenario | Android | iOS | Notes |
|---|---|---|---|
| MetaMask connect (CAIP-25 multi-scope) | ✅ | ⬜ | Mainnet EVM scopes granted reliably; Base Sepolia often dropped even when enabled in MM. |
| MetaMask `personal_sign` (EVM) | ❌ | ⬜ | MM opens on `metamask://connect/mwp?id=…` but the approval sheet never renders; `invokeMethod` times out with RPCErr53. Matches docs verbatim — gap is on MM's RN sign flow. |
| MetaMask `solana_signMessage` | ❌ | ⬜ | Same RPCErr53 timeout as EVM. |
| MetaMask disconnect | ✅ | ⬜ | Local state always cleared even if revoke didn't reach MM. |
| Solana Wallet (MWA) connect | ✅ | — | Android only; OS routes to default Solana wallet. |
| Solana Wallet (MWA) signMessage | ✅ | — | Round-trip OK with Phantom and Solflare via MWA. |
| Solana Wallet (MWA) disconnect | ✅ | — | Local-only (skip wallet round-trip) — opening wallet just to revoke is bad UX. |
| Phantom (iOS universal links) | — | ⬜ | Pending impl (X25519 + nacl.box). |

## Known issues / parked work

- **MM Connect sign on RN is broken.** Connect works, sign times out. We
  matched the official quickstart + sign guide exactly; the failure is below
  our layer. Next try is `@metamask/connect-evm` (EVM-only client, possibly
  different RN transport): `https://docs.metamask.io/metamask-connect/evm/quickstart/react-native/`.
  BASE / CELO support depends on this.
- **iOS Phantom universal-link** implementation pending. Stub throws a clear
  "pending universal-link implementation" error on any op.
- **MWA `identity.icon` must be a relative URI** — we use `./favicon.ico`.
  Absolute URLs (like `metadata.iconUrl`) get rejected with protocol error -32602.
- **MWA has no local wallet-targeting API.** `transact({ baseUri })` only
  accepts an absolute `https://` hierarchical URI (for remote MWA), so we can't
  use `phantom:` / `solflare:` to route to a specific wallet. Hence the
  collapsed "Solana Wallet" entry on Android.

## Native-config requirement

`apps/mobile/plugins/with-wallet-queries.js` declares wallet deeplink schemes
in `AndroidManifest.xml` `<queries>` and iOS `LSApplicationQueriesSchemes`
(`metamask`, `phantom`, `solflare`). Without these, `Linking.canOpenURL`
returns false on iOS and `openURL` silently fails on Android 11+. The plugin
runs at every `expo prebuild` so the native config stays in sync.

## Promotion criteria

Promote `wallet/*` → `wallet/*` (retire legacy `wallet/index.ts`, add
`wallet/auth.ts` to wrap signMessage with the server-nonce flow) **iff**:

- MM Connect (or `connect-evm`) sign round-trips on Android + iOS.
- iOS Phantom universal links connect + sign + disconnect work.
- p95 signMessage < 5s on a real network across all adapters.
- Wallet-killed mid-flow surfaces a clear error (no silent hang).

If MM Connect signing can't be unblocked on RN, fallback strategy: use MM's
own deeplink (`metamask://wc?uri=…`) over a WC v2 transport for EVM only,
keep MWA + Phantom universal links for Solana, drop the unified picker idea.
