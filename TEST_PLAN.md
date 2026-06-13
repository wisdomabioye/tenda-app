# Tenda Test Plan — 90%+ coverage, phased E2E

Goal: enforced **90% line / 85% branch** coverage across all four TS surfaces,
plus a thin true-E2E layer for critical flows. Scope confirmed: Mobile, Shared,
Admin, Server. Style: **Phase 1** unit+integration to the number, **Phase 2** real
flow automation for happy paths only.

Standing contract: positive **and** negative cases, real assertions, no
false-confidence tests, document (never silently drop) any coverage exclusion.

---

## Verified baseline (2026-06-13)

| Surface | Tests | Runner today | Coverage tool | Notes |
|---|---|---|---|---|
| Server | 57 files / ~557 | `node:test` + `ts-node` | `c8` (wired, **ungated**) | add threshold; measure first |
| Admin | 2 files / ~9 | `tsx --test` (**no DOM**) | none | logic-only today |
| Mobile | **0** | **none** | none | Expo SDK 54, RN 0.81, React 19.1 |
| Shared | **0** | none | none | **CommonJS** (clean for node:test) |
| Contract | 31 (Foundry) | `forge test` | — | already green, out of scope here |

### Version/fact checks that shaped the tooling
- Mobile: `expo ~54`, `react-native 0.81`, `react 19.1`, `react-native-unistyles ^3`,
  `react-native-reanimated ~4`. **Both unistyles and reanimated ship jest mocks**
  (`react-native-unistyles/mocks`, `react-native-reanimated/mock.js`) → component
  tests are feasible. `jest-expo` is **not yet installed**.
- Shared: `module: CommonJS`, no `type: module` → `node:test -r ts-node/register` +
  `c8` mirrors the server setup exactly (no ESM-loader friction).
- Admin: `next 16.2`, `react 19.2`. **No jsdom/vitest/RTL present.** Existing tests
  are pure logic under `tsx --test`, which has no DOM — component/page rendering
  requires a real DOM runner.
- Server: no `.c8rc`/`nyc` config file; the gate must go in the `c8` CLI flags.

---

## Tooling decisions (one idiomatic stack per runtime)

| Surface | Test runner | DOM | Coverage | Why |
|---|---|---|---|---|
| **Shared** | `node:test` + `ts-node/register` | n/a | `c8` | pure CJS TS; mirror server |
| **Server** | `node:test` (existing) | n/a | `c8` + threshold | keep 557 green tests; just gate |
| **Admin** | **`vitest`** | **jsdom** | vitest v8 | only DOM runner that renders React 19 client components; migrate the 2 logic tests |
| **Mobile** | **`jest-expo@~54`** + `@testing-library/react-native` | RN test env | jest v8 | the supported Expo SDK 54 preset |

> Three coverage tools (c8, vitest-v8, jest), each the standard for its runtime.
> Not worth forcing a single tool across Node + React-DOM + React-Native.

---

## Phase 0 — Tooling, gates, baseline (~0.5 day)

1. **Measure server c8 baseline** (`--include 'src/**' --all`) → ranked
   uncovered-file list. This sizes Phase 1B for real instead of guessing.
2. **Shared**: add `c8` + `ts-node` devDeps, `test`/`test:coverage` scripts, a
   `test/` dir, `.c8rc.json` (`include: src/**`, exclude db/schema + idl + types).
3. **Server**: add `--check-coverage --lines 90 --branches 85 --include 'src/**'`
   to the c8 invocation. Start the threshold at the measured baseline, ratchet to
   90 as gaps close (never a giant red CI bar).
4. **Admin**: add `vitest` + `jsdom` + `@testing-library/react` + `@vitejs/plugin-react`;
   `vitest.config.ts` (jsdom env, v8 coverage, include `app/**` + `lib/**` + `api/**`);
   migrate `dispute-thread.test.ts` + `nav.test.ts` from node:test → vitest (mechanical).
   Replace the `test` script; drop `tsx --test`.
5. **Mobile**: add `jest-expo` + `@testing-library/react-native` + `@types/jest`;
   `jest.config.js` (preset `jest-expo`, `transformIgnorePatterns` for RN/expo/reanimated/
   unistyles ESM), `jest.setup.ts` wiring the unistyles + reanimated mocks and
   gesture-handler/secure-store/expo-router stubs; `test`/`test:coverage` scripts.
6. **Root**: add `test` + `test:coverage` tasks to `turbo.json` (currently absent);
   add a CI job per package that fails under threshold.

**Exit:** `pnpm test:coverage` runs all four; each prints a coverage table; CI gates
at the (initially baseline, later 90) threshold.

---

## Phase 1 — Coverage to 90% (ordered by ROI)

### 1A. Shared (do first — pure logic, zero mocks, highest leverage)
Both server and mobile depend on this math, so bugs here are systemic.
- `utils/fees.ts`, `utils/validation.ts`, `utils/cross-border.ts`,
  `utils/gig-utils.ts`, `utils/wallet.ts`, `utils/auth-message.ts`
- `constants/permissions.ts` — full `hasPermission` matrix, **every role ×
  permission**, positive + negative.
- `constants/` invariants: `assets`, `errors`, `escrow`, `moderation`, `categories`,
  `currencies` (shape + no-dupes + lookups).
- Boundary/negative on every fee/deadline/validation branch (zero, overflow,
  out-of-range, malformed).
- Exclude from denominator: `db/schema/**`, `idl/**`, `abi/**`, `types/**` (pure
  type decls / generated) — documented in `.c8rc`.

### 1B. Server — close the measured gap to 90%
- Drive from the Phase-0 ranked list. Use the existing `fastify.inject` harness.
- Likely thin spots: `chains/evm/*` (dormant adapter — verify/builders/rpc),
  `features/fiat-rails/webhooks`, `features/moderation`, `features/reputation`
  guards, `lib/admin-otp` edge branches, webhook HMAC verifiers.
- Negative paths: authn failure, role/permission rejection, malformed payloads,
  idempotency replays, half-configured chain env.
- Genuinely unreachable defensive branches: test or annotate `c8 ignore` **with a
  reason comment** — never blanket-exclude to hit the number.

### 1C. Admin (vitest + jsdom)
- Logic: `lib/api.ts` (401 bounce, base-url fallback, `/v1/auth/` exclusion),
  `lib/auth.ts`, `lib/use-session.ts`, `lib/nav.ts` (extend), `lib/dispute-thread.ts`
  (extend), `api/client.ts`.
- Components/pages (client components only — see caveat): config-save guard,
  dispute assignee flow, users role PATCH, login email-OTP form, nav permission
  gating, route guards. Mock `fetch`/api client at the boundary.

### 1D. Mobile (greenfield — largest net-new effort)
Layered by ROI; the 90% number rests mostly on 1+2:
1. **`lib/`** pure helpers — `gig-display`, `date`, `currency`, `fiat`, `chat`,
   `categories`, `upload`, `env`, `reporter`. Pure unit, no mocks.
2. **`stores/`** (Zustand) — call actions/selectors directly, assert state
   transitions; mock `api/client`. `escrow`, `gigs`, `user-gigs`, `chat`, `auth`,
   `pending-sync`, `platform-config`, `exchange-*`, `settings`, `onboarding`,
   `realtime`.
3. **Components** — UI primitives + key composites (GigCardCompact ×3, MessageBubble,
   FeeSummary, moderation sheets, StandingBadge) via RN Testing Library + the
   unistyles/reanimated mocks.
4. **Screens** — render-level for create-gig, chat, exchange detail with mocked API +
   `expo-router`.
- **Boundary-mock + documented coverage exclusion** for unmockable native shims:
  `wallet/adapters/*` (MWA/Phantom/MetaMask), `lib/ws.ts`, `lib/notifications.ts`,
  `lib/secure-store.ts`, `lib/device.ts`. These move to Phase 2 Maestro for real
  coverage; each exclusion is listed in `jest.config` `coveragePathIgnorePatterns`
  with a one-line reason.

---

## Phase 2 — Thin true-E2E (critical happy paths only)

Runs separately from the coverage gate (nightly / pre-release); does **not** count
toward the 90% line number.

- **Mobile — Maestro** (lighter than Detox for Expo): onboarding → wallet-connect
  (mocked signer), create-gig happy path, chat send/receive. Needs an emulator +
  dev-client build.
- **Admin — Playwright**: email-OTP login (dev-code path), claim a dispute, take
  down a report. Needs admin + server running.

---

## Sequencing & effort

| Step | Effort | Gating output |
|---|---|---|
| Phase 0 (tooling + baseline) | 0.5d | all runners green, thresholds wired |
| 1A Shared | 1d | shared ≥90 |
| 1B Server gap-fill | **sized by 0.1** | server gate → 90 |
| 1C Admin | 1d | admin ≥90 (client surface) |
| 1D Mobile | 2–3d | mobile ≥90 (lib+stores+components) |
| Phase 2 E2E | 1–2d | Maestro + Playwright smoke |

Commit per sub-phase (project convention), each message carrying its coverage
delta; ratchet the threshold up as suites land.

---

## Honest caveats / known risks

- **Admin RSC limit:** React-DOM testing (vitest+jsdom + RTL) renders **client**
  components only. Next App Router **server components / async pages** cannot render
  under RTL — those rely on Phase 2 Playwright for coverage. Most #90 dashboard pages
  are `'use client'`, so the exposure is small, but any server-rendered page is a
  documented gap, not a tested line.
- **Mobile native modules:** wallet adapters, WebSocket, secure-store, push — mocked
  at the boundary; real behaviour is Phase 2 Maestro. Listed exclusions keep the 90%
  honest (denominator excludes only declared-untestable shims).
- **90% branch is harder than 90% line.** On the gnarliest modules I may land
  ~85% branch / 90% line; the real split gets reported, never papered over.
- **Server gate ratchet:** I will not flip the threshold to 90 until the suite
  actually clears it — interim commits gate at the rising baseline so CI stays green.
- **Phase 2 infra** (emulator, Playwright browsers, both services up) is heavier
  than Phase 1 and may need CI runner changes; kept out of the blocking coverage job.
