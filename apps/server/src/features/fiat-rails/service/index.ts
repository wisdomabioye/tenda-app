/**
 * Quote → initiate → settle orchestration (stage-8-fiat-rails.md). Split per
 * operation: ./quote, ./intents (initiate + cancel), ./settlement (webhooks +
 * reconcile); shared DI + event shapes in ./deps. Barrel keeps the `./service`
 * import surface (consumed by ../index) stable.
 *
 * A pre-commit quote lives in the Redis quote cache (native TTL), NOT as a row.
 * initiate PROMOTES it into the first persisted fiat_intents status:
 *   (cached quote) ──initiate──► awaiting_user ──webhook/reconcile──► settled
 *                                    │ (kyc) ▲                          ▲
 *                               awaiting_provider ──────────────────────┘
 *      cancel drops the quote │     ├─►  settling ──► settled | failed
 *      or cancels awaiting_user ────► cancelled
 *      expire (awaiting_user TTL) ──► failed
 */

export * from './deps'
export * from './quote'
export * from './intents'
export * from './settlement'
