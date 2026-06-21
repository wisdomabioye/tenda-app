# chains/

Per-chain adapter registry. Each chain implements `ChainAdapter` (see
`types.ts`); the rest of the server routes by `escrow.chain_id` → adapter
without knowing which protocol is underneath.

Adapters are built **generically** from the active chain secrets against the
shared `CHAIN_MANIFEST` (see `secrets.ts` + `index.ts#buildAdapters`):
`namespace` picks the adapter (`solana/` vs `evm/`), `gasPolicy` picks the dep
wiring (paymaster / feeCurrency / plain), and confirmations + token addresses
come from the manifest. **Adding a chain is one manifest entry plus its
`CHAIN_<ID>_*` env secrets — no code change here.**

| Concern | Source |
|---|---|
| Which chains are active | `chains/secrets.ts` (`CHAIN_<ID>_*` env) |
| Public facts (ids, confirmations, token addresses, gasPolicy) | `@tenda/shared` `CHAIN_MANIFEST` |
| Adapter impls | `solana/*`, `evm/*` (one EVM adapter serves BASE + CELO + any L2) |

Tests live under `apps/server/test/` (`unit/chains/secrets.test.ts`,
`unit/chain-registry.test.ts`) per `testing-strategy.md`.

## Why a separate folder, not `lib/chain.ts`

The plan calls for explicit per-chain isolation so a vendor outage on one
chain can't bleed into another's code path. Each chain's RPC clients, error
classification, builders, and listeners are self-contained; the only shared
surface is the interface defined in `types.ts`.
