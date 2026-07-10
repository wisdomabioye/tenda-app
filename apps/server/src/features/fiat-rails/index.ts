/**
 * Fiat-rails public surface (stage-8-fiat-rails.md). Routes/webhooks/jobs
 * import from HERE, never from the module internals (exit criterion: single
 * import surface). Live DI assembly is in ./live-deps; the P2P drizzle wiring
 * it composes is in ./p2p-live; the quote/initiate/settle service is ./service.
 */

export { requestQuote, initiateIntent, cancelIntent, settleFromProvider, reconcileIntent } from './service'
export type { QuoteInput, QuoteResult, InitiateOutput, FiatDeps, FiatEvent } from './service'
export { drizzleFiatStore, drizzleBankAccountStore, OPEN_STATUSES } from './store'
export type { FiatStore, BankAccountStore, BankAccountRow } from './store'
export { pickCandidates, supportsRequest } from './routing'
export type { ProviderRegistryRow } from './routing'
export * from './types'
export { QUOTE_TTL_MS, P2P_INTERNAL_ID } from './config'
export { P2P_INTERNAL_CAPABILITIES, EXCHANGE_ASSET_IDS } from './capabilities'
export { YELLOWCARD_SPEC, ONRAMPMONEY_SPEC } from './providers/specs'
export { buildProviders, buildFiatDeps } from './live-deps'
