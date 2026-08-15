export { WalletError, type WalletErrorCode } from './errors'
export type { WalletAccount, SignMessageResult, AuthenticateResult } from './types'
export { connectThenSign, isUserRejection, type ConnectSignParts } from './connect-then-sign'
export { classifyConnectError, type ConnectErrorCopy } from './connect-error'
export * from './balances'
export { evmRpc, evmRpcString, hexToDecimalString, addressWord, amountWord } from './evm-rpc'
export {
  resolveWalletSection,
  isRegistryUsable,
  type WalletSectionState,
  type WalletSectionInput,
  type WalletLoadStatus,
  type WalletsStatus,
  type ChainRegistryStatus,
} from './section-state'
export {
  TX_LABEL_BY_ROLE,
  viewerRole,
  txLabel,
  txSign,
  txAmountRaw,
  txDisplayAmount,
} from './tx-copy'
