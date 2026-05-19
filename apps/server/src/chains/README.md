# chains/

Per-chain adapter registry. Each chain implements `ChainAdapter` (see
`types.ts`); the rest of the server routes by `escrow.chain_id` → adapter
without knowing which protocol is underneath.

Status: types-only scaffold per Stage 0 first cuts. Real implementations
land per stage:

| Stage | Adds |
|---|---|
| 0 | `solana/{adapter,rpc,verify,builders}.ts` + adapter registry in `index.ts` |
| 2 | `solana/{listener-helius,listener-polling}.ts` |
| 3 | `evm/{adapter,rpc,verify,builders,paymaster}.ts` + `base/config.ts` |
| 4 | `celo/config.ts` (reuses `evm/*` adapter unchanged) |

Tests live under `apps/server/test/chains/` per `testing-strategy.md`.

## Why a separate folder, not `lib/chain.ts`

The plan calls for explicit per-chain isolation so a vendor outage on one
chain can't bleed into another's code path. Each chain's RPC clients, error
classification, builders, and listeners are self-contained; the only shared
surface is the interface defined in `types.ts`.
