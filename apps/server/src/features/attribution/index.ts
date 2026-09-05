/**
 * On-chain attribution — the whole feature, in one directory.
 *
 * WHAT IT DOES. Appends an ERC-8021 suffix to the calldata of transactions
 * Tenda originates on a chain whose ecosystem runs an attribution programme
 * (today: Celo). The suffix sits past every ABI-encoded argument, so it changes
 * nothing about what the transaction does — it only makes the transaction
 * attributable to us on a public dashboard.
 *
 * WHY IT IS URGENT RATHER THAN NICE. The tag is part of the signed calldata, so
 * it must be present when the transaction is SENT. There is no backfill: every
 * transaction sent before the wiring lands is permanently unattributed, and on
 * Celo that is the input to every hackathon leaderboard. This is the one piece
 * of work whose cost is measured in transactions you can no longer earn.
 *
 * HOW TO ATTACH IT — one import, one call, wherever calldata is built:
 *
 *   import { tagCalldata } from '@server/features/attribution'
 *   const data = tagCalldata(chain_id, encodeFunctionData({ ... }))
 *
 * There is no registration step, no plugin, and no boot order to respect. A
 * chain with no attribution programme gets its calldata back unchanged, so the
 * call is safe on every chain including ones that do not exist yet.
 *
 * WHERE IT IS ATTACHED TODAY — every place the server produces EVM calldata:
 *   1. `chains/evm/index.ts` buildTx — the escrow transactions a CLIENT signs
 *      and broadcasts (create, accept, submit, approve, dispute). The volume.
 *   2. `chains/evm/relay/index.ts` — `createEscrowFor`, which the RELAYER signs
 *      (#18 agent funding). Tagged before `simulate`, so what is simulated is
 *      what is sent.
 *   3. `chains/evm/sweep.ts` — `refundExpired` / `reclaimAbandoned`, which the
 *      relayer also signs (#43 abandoned-escrow recovery). This one is easy to
 *      forget, and was: the first cut of #83 attached to the two above and this
 *      docblock said "both places". A sweep is a real transaction on a real
 *      chain, so an untagged one is volume that scores nothing.
 *
 * THE TEST FOR "HAVE I FOUND THEM ALL" is not this list — lists rot. It is that
 * a call site either returns calldata to a client or hands it to `EvmRelayer`;
 * anything reaching `relayer.simulate`/`relayer.send` must be tagged first.
 *
 * WHAT IS NOT TAGGED, said plainly rather than discovered later: the ERC-20
 * `approve()` that a client sends before a plain (non-permit) escrow create.
 * The server does not build that transaction — it emits an `approval` HINT of
 * `{ token, spender, amount_raw }` and each client encodes the call itself — so
 * there is no calldata here to append to. On a token without EIP-2612 that is
 * one untagged transaction per post. Closing it means widening the approval
 * hint into built calldata across the wire contract and both clients, which is
 * its own task.
 *
 * IMPORT THIS BARREL FROM `src/`, not the files behind it — reaching past it is
 * what turns a removable feature back into a clustered one, and it is `src/`
 * that the removal recipe has to survive. Tests may address a module directly;
 * the source-scan guard in test/unit/attribution-module-boundary.test.ts
 * therefore asserts the rule over `src/` only. That guard also pins the SET of
 * files that use the feature, so the call-site list above cannot rot the way it
 * already did once — it said "both places" while the sweep went untagged.
 *
 * REMOVAL RECIPE — keep this true:
 *   0. delete test/unit/attribution-module-boundary.test.ts, which asserts this
 *      recipe and would otherwise fail on the way out;
 *   1. delete this directory;
 *   2. delete the `tagCalldata(...)` wrap at all three call sites above,
 *      leaving the inner expression, and drop `chain_id` from
 *      `evmEscrowSweep`'s signature — it exists only to feed this;
 *   3. delete the `assertAttributionCodes(...)` call in `plugins/chains.ts`;
 *   4. `pnpm --filter tenda-server remove @celo/attribution-tags`;
 *   5. drop `CELO_ATTRIBUTION_CODE` from `.env.example` and any deployment env.
 */

export {
  tagCalldata,
  attributionCodes,
  attributionEnvKey,
  assertAttributionCodes,
  ATTRIBUTION_FAMILIES,
} from './tag'
export { decodeTag, checkTaggedTx, type TagCheck, type TxClient, type TxHash } from './verify'
