/**
 * Escrow-screen utilities: the first-transaction gate classifier, the
 * detail-read error classifier, and the transition-applied sync check.
 */
export {
  classifyTransactionGateError,
  TRANSACTION_GATE_MESSAGE,
  transactionGateRoute,
  type TransactionGateReason,
} from './transaction-gate'
export { classifyDetailLoadError, type DetailLoadError } from './detail-load-error'
export { checkEscrowTransitionApplied } from './escrow-sync'
