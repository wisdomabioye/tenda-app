/**
 * Quote → initiate → settle orchestration (stage-8-fiat-rails.md).
 *
 * State machine (fiat_intents.status):
 *
 *   quoted ──initiate──► awaiting_user ──webhook/reconcile──► settled
 *     │                      │  (kyc) ▲                          ▲
 *     │                 awaiting_provider ──────────────────────┘
 *     │                      │
 *     ├─cancel──► cancelled  ├─►  settling ──► settled | failed
 *     └─expire──► failed (QUOTE_EXPIRED reason)
 *
 * All transitions ride the store's status-guarded `transition()` so
 * webhook replays and reconcile races can't regress a terminal row.
 *
 * Settlement authority: the licensed provider's webhook + status() poll.
 * On-chain receipt confirmation (the spec's verify-fiat-onramp job) is
 * gated on the wallet-watch listener infra (#33 worker + #43 webhook
 * coverage of user wallets) and layers on top of this module without
 * changing its surface — documented deferral, not an oversight.
 */

import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import { QUOTE_TTL_MS, RECONCILE_GIVE_UP_MS } from './config'
import { pickCandidates, type ProviderRegistryRow } from './routing'
import type { FiatStore } from './store'
import type {
  BankAccountRef,
  FiatProvider,
  FiatIntentRow,
  PaymentInstruction,
  DepositInstruction,
  QuoteRequest,
} from './types'

// ---------- events ---------------------------------------------------------

export interface FiatEvent {
  intent_id: string
  user_id: string
  direction: 'onramp' | 'offramp'
  fiat_currency: string
  fiat_amount: string
  asset: string
  asset_amount_raw: string
}

export interface FiatEventSink {
  settled(e: FiatEvent): void
  failed(e: FiatEvent & { reason: string }): void
}

export interface FiatDeps {
  store: FiatStore
  providers: Map<string, FiatProvider>
  /** Enable/priority rows (fiat_providers table). */
  registry: ProviderRegistryRow[]
  events: FiatEventSink
  now(): Date
  log: { warn(obj: Record<string, unknown>, msg: string): void }
}

function toEvent(intent: FiatIntentRow): FiatEvent {
  return {
    intent_id: intent.id,
    user_id: intent.user_id,
    direction: intent.direction,
    fiat_currency: intent.fiat_currency,
    fiat_amount: intent.fiat_amount,
    asset: intent.asset,
    asset_amount_raw: intent.asset_amount_raw,
  }
}

// ---------- quote -----------------------------------------------------------

export interface QuoteInput extends Omit<QuoteRequest, 'user_id'> {
  wallet_address: string
  chain_id: string
  /** Optional analytics linkage (chained buy-then-post flow). */
  gig_id?: string
}

export interface QuoteResult {
  intent_id: string
  provider: string
  rate: number
  fee_amount: number
  fiat_amount: number
  asset_amount_raw: string
  kyc_required: boolean
  expires_at: string
}

/**
 * Route → provider.quote → persist intent(status='quoted'). Candidates are
 * tried in priority order; a provider that throws is skipped (§ Provider
 * routing — outage falls through, ultimately to p2p_internal).
 */
export async function requestQuote(
  deps: FiatDeps,
  user_id: string,
  input: QuoteInput,
): Promise<QuoteResult> {
  const candidates = pickCandidates(deps.registry, deps.providers, input)
  if (candidates.length === 0) {
    throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'no provider supports this request')
  }

  for (const provider of candidates) {
    try {
      const quote = await provider.quote({ ...input, user_id })
      const expires_at = new Date(deps.now().getTime() + QUOTE_TTL_MS)
      const intent = await deps.store.insertIntent({
        direction: input.direction,
        user_id,
        wallet_address: input.wallet_address,
        chain_id: input.chain_id,
        provider: provider.id,
        fiat_currency: input.fiat_currency,
        fiat_amount: quote.fiat_amount.toFixed(4),
        asset: input.asset,
        asset_amount_raw: quote.asset_amount_raw,
        rate: quote.rate.toFixed(10),
        fee_amount: quote.fee_amount.toFixed(4),
        status: 'quoted',
        provider_ref: null,
        kyc_required: quote.kyc_required,
        kyc_url: quote.kyc_url,
        expires_at,
        metadata: {
          quote_ref: quote.quote_ref,
          ...(input.gig_id !== undefined ? { gig_id: input.gig_id } : {}),
        },
      })
      return {
        intent_id: intent.id,
        provider: provider.id,
        rate: quote.rate,
        fee_amount: quote.fee_amount,
        fiat_amount: quote.fiat_amount,
        asset_amount_raw: quote.asset_amount_raw,
        kyc_required: quote.kyc_required,
        expires_at: expires_at.toISOString(),
      }
    } catch (err) {
      deps.log.warn({ err, provider: provider.id }, 'fiat: provider quote failed — trying next')
    }
  }
  throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'all providers failed to quote')
}

// ---------- initiate ----------------------------------------------------------

export interface InitiateOutput {
  intent_id: string
  status: FiatIntentRow['status']
  instruction: PaymentInstruction | DepositInstruction
  kyc_url: string | null
}

export async function initiateIntent(
  deps: FiatDeps,
  user_id: string,
  intent_id: string,
  opts: { bank_account?: BankAccountRef },
): Promise<InitiateOutput> {
  const intent = await deps.store.getIntent(intent_id)
  if (intent === null || intent.user_id !== user_id) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'intent not found')
  }
  if (intent.status !== 'quoted') {
    throw new AppError(409, ErrorCode.VALIDATION_ERROR, `intent is ${intent.status}, expected quoted`)
  }
  if (intent.expires_at < deps.now()) {
    await deps.store.transition(intent.id, ['quoted'], { status: 'failed' })
    throw new AppError(410, ErrorCode.QUOTE_EXPIRED, 'quote expired — request a new one')
  }
  if (intent.direction === 'offramp' && opts.bank_account === undefined) {
    throw new AppError(422, ErrorCode.VALIDATION_ERROR, 'bank_account_id required for offramp')
  }

  const provider = deps.providers.get(intent.provider)
  if (provider === undefined) {
    throw new AppError(503, ErrorCode.PROVIDER_UNAVAILABLE, 'provider no longer available')
  }

  const meta = intent.metadata as { quote_ref?: string } | null
  const quote_ref = meta?.quote_ref
  if (typeof quote_ref !== 'string') {
    throw new AppError(500, ErrorCode.INTERNAL_ERROR, 'intent missing quote_ref')
  }

  const result = await provider.initiate({
    quote_ref,
    user_id,
    wallet_address: intent.wallet_address,
    direction: intent.direction,
    quote: {
      fiat_currency: intent.fiat_currency,
      fiat_amount: Number(intent.fiat_amount),
      asset: intent.asset,
      asset_amount_raw: intent.asset_amount_raw,
      rate: Number(intent.rate),
    },
    bank_account: opts.bank_account,
  })

  // KYC redirect parks the intent on the provider until the user returns.
  const next = result.kyc_url !== null ? 'awaiting_provider' : 'awaiting_user'
  const updated = await deps.store.transition(intent.id, ['quoted'], {
    status: next,
    provider_ref: result.provider_ref,
    kyc_url: result.kyc_url,
    // Persisted so a mid-flow app restart can resume the instruction.
    metadata: { ...(meta ?? {}), instruction: result.instruction },
  })
  if (updated === null) {
    throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'intent changed concurrently — refetch')
  }
  return {
    intent_id: intent.id,
    status: updated.status,
    instruction: result.instruction,
    kyc_url: result.kyc_url,
  }
}

// ---------- cancel --------------------------------------------------------------

export async function cancelIntent(deps: FiatDeps, user_id: string, intent_id: string): Promise<void> {
  const intent = await deps.store.getIntent(intent_id)
  if (intent === null || intent.user_id !== user_id) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'intent not found')
  }
  const updated = await deps.store.transition(intent.id, ['quoted', 'awaiting_user'], {
    status: 'cancelled',
  })
  if (updated === null) {
    throw new AppError(409, ErrorCode.VALIDATION_ERROR, `intent is ${intent.status} — cannot cancel`)
  }
}

// ---------- settlement (webhooks + reconcile) -------------------------------------

export type ProviderOutcome = 'completed' | 'failed'

/**
 * Apply a provider-side outcome. Idempotent: replays miss the status
 * guard and return the row unchanged. Returns the intent or null when no
 * row matches the (provider, provider_ref) pair — webhooks for unknown
 * refs are logged and dropped (cross-provider ref confusion / spam).
 */
export async function settleFromProvider(
  deps: FiatDeps,
  args: { provider: string; provider_ref: string; outcome: ProviderOutcome; reason?: string },
): Promise<FiatIntentRow | null> {
  const intent = await deps.store.getIntentByProviderRef(args.provider, args.provider_ref)
  if (intent === null) {
    deps.log.warn(
      { provider: args.provider, provider_ref: args.provider_ref },
      'fiat: settlement for unknown provider_ref dropped',
    )
    return null
  }
  if (intent.status === 'settled' || intent.status === 'failed' || intent.status === 'cancelled') {
    return intent // replay — already terminal
  }

  if (args.outcome === 'completed') {
    const updated = await deps.store.transition(
      intent.id,
      ['awaiting_user', 'awaiting_provider', 'settling'],
      { status: 'settled' },
    )
    if (updated !== null) deps.events.settled(toEvent(updated))
    return updated ?? intent
  }

  const updated = await deps.store.transition(
    intent.id,
    ['quoted', 'awaiting_user', 'awaiting_provider', 'settling'],
    { status: 'failed' },
  )
  if (updated !== null) {
    deps.events.failed({ ...toEvent(updated), reason: args.reason ?? 'provider reported failure' })
  }
  return updated ?? intent
}

/**
 * Reconcile one stale open intent (§ Reconciliation): poll the provider
 * and converge. Intents the provider has no record of past the give-up
 * window are failed; younger unknown refs stay pending (provider lag).
 */
export async function reconcileIntent(deps: FiatDeps, intent: FiatIntentRow): Promise<void> {
  // Never initiated (no provider_ref): nothing to poll. Quote expiry is
  // the expire-quotes job's business; leave it alone here.
  if (intent.provider_ref === null) return

  const provider = deps.providers.get(intent.provider)
  if (provider === undefined) {
    deps.log.warn({ intent_id: intent.id, provider: intent.provider }, 'fiat: provider missing during reconcile')
    return
  }

  let status: Awaited<ReturnType<FiatProvider['status']>>
  try {
    status = await provider.status(intent.provider_ref)
  } catch (err) {
    deps.log.warn({ err, intent_id: intent.id }, 'fiat: provider status poll failed')
    return
  }

  if (status === 'completed' || status === 'failed') {
    await settleFromProvider(deps, {
      provider: intent.provider,
      provider_ref: intent.provider_ref,
      outcome: status,
      reason: status === 'failed' ? 'provider reported failure on reconcile' : undefined,
    })
    return
  }
  if (status === 'not_found') {
    const age = deps.now().getTime() - intent.created_at.getTime()
    if (age > RECONCILE_GIVE_UP_MS) {
      await settleFromProvider(deps, {
        provider: intent.provider,
        provider_ref: intent.provider_ref,
        outcome: 'failed',
        reason: 'provider has no record after 24h',
      })
    }
  }
  // 'pending' → leave for the next tick.
}
