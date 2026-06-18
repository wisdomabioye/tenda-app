/**
 * Quote → initiate → settle orchestration (stage-8-fiat-rails.md). Split per
 * operation: ./quote, ./intents (initiate + cancel), ./settlement (webhooks +
 * reconcile); shared DI + event shapes in ./deps. Barrel keeps the `./service`
 * import surface (consumed by ../index) stable.
 *
 * fiat_intents.status state machine:
 *   quoted ──initiate──► awaiting_user ──webhook/reconcile──► settled
 *     │                      │ (kyc) ▲                          ▲
 *     │                 awaiting_provider ──────────────────────┘
 *     ├─cancel──► cancelled  ├─►  settling ──► settled | failed
 *     └─expire──► failed (QUOTE_EXPIRED)
 */

export * from './deps'
export * from './quote'
export * from './intents'
export * from './settlement'
