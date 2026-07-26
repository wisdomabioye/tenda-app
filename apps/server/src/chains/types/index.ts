/**
 * Cross-chain adapter contract.
 *
 * Every chain (Solana, BASE, CELO, ...) implements ChainAdapter so the rest of
 * the server can route by `chain_id` without knowing which protocol sits
 * underneath. See `multichain-migration-stages/stage-0-foundation.md` § Server.
 *
 * Split into files along the seams the adapter already has (values / events /
 * buildTx / verifyTx / adapter surface); `@server/chains/types` remains the
 * single import path via this barrel, so no caller changed.
 *
 * No `any` / `unknown` casts allowed (project rule). Payloads are discriminated
 * unions per `action`; UserOperation is fully typed; event-payload fields are
 * stringified for u64/u256 precision safety.
 */

export * from './values'
export * from './events'
export * from './build-tx'
export * from './verify'
export * from './adapter'
