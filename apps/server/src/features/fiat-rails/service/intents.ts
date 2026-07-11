/**
 * Intent lifecycle ops the user drives: initiate (quoted → awaiting_*) and
 * cancel (quoted | awaiting_user → cancelled). Both ride the store's
 * status-guarded `transition()` so concurrent webhooks can't be regressed.
 */

import { AppError } from '@server/lib/errors'
import { ErrorCode } from '@tenda/shared'
import type {
  BankAccountRef,
  DepositInstruction,
  FiatIntentRow,
  PaymentInstruction,
} from '../types'
import type { FiatDeps } from './deps'

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
  opts: { bank_account?: BankAccountRef; payout_account_id?: string },
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
    throw new AppError(410, ErrorCode.QUOTE_EXPIRED, 'quote expired, request a new one')
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
    payout_account_id: opts.payout_account_id,
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
    throw new AppError(409, ErrorCode.VALIDATION_ERROR, 'intent changed concurrently, refetch')
  }
  return {
    intent_id: intent.id,
    status: updated.status,
    instruction: result.instruction,
    kyc_url: result.kyc_url,
  }
}

export async function cancelIntent(deps: FiatDeps, user_id: string, intent_id: string): Promise<void> {
  const intent = await deps.store.getIntent(intent_id)
  if (intent === null || intent.user_id !== user_id) {
    throw new AppError(404, ErrorCode.NOT_FOUND, 'intent not found')
  }
  const updated = await deps.store.transition(intent.id, ['quoted', 'awaiting_user'], {
    status: 'cancelled',
  })
  if (updated === null) {
    throw new AppError(409, ErrorCode.VALIDATION_ERROR, `intent is ${intent.status}, cannot cancel`)
  }
}
