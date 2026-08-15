/**
 * Mobile balances barrel. The readers, fan-out and sum all live in
 * @tenda/shared now (fetch-based Solana reader converged 2026-08-15 — the
 * web3.js Connection reader is gone; commitment parity ('confirmed') is
 * pinned in shared's tests). What remains here is mobile's own layer: the
 * spendable/sufficiency pre-flight around transactions.
 */

// `readAssetBalance` is deliberately NOT re-exported: reading a single wallet
// is an internal step of ./spendable, and a caller reaching for it directly
// would be asking the wrong question (see readSpendableBalance's note on why
// one wallet can't answer "can this transaction be funded").
export { readSpendableBalance } from './spendable'
export { ensureSufficientBalance, InsufficientBalanceError } from './sufficiency'
