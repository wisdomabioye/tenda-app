'use client'

/**
 * The two payout-account surfaces on the exchange detail — web twins of
 * mobile's PaymentInstructionsCard + SellerPayoutCard, with the SAME
 * unit-tested visibility gates: the accepted BUYER sees payment
 * instructions at a live payment stage (never in dispute); the SELLER
 * sees which of their accounts the offer is bound to. Never both at once.
 */
import { Landmark, Smartphone } from 'lucide-react'
import type { EscrowStatus, ExchangeDetail, ExchangePayoutAccount } from '@tenda/shared'
import { DeadlineCountdown } from '@/components/shared/DeadlineCountdown'

const PAYMENT_CONTEXT_STATUSES: EscrowStatus[] = ['accepted', 'submitted']

export function shouldShowPaymentInstructions(
  offer: Pick<ExchangeDetail, 'counterparty' | 'payout_account' | 'status'>,
  userId: string,
): boolean {
  return (
    userId === offer.counterparty?.id &&
    offer.payout_account !== null &&
    PAYMENT_CONTEXT_STATUSES.includes(offer.status)
  )
}

const SELLER_PAYOUT_STATUSES: readonly EscrowStatus[] = ['draft', 'open', 'accepted', 'submitted']

export function shouldShowSellerPayout(
  offer: Pick<ExchangeDetail, 'creator' | 'payout_account' | 'status'>,
  userId: string,
): boolean {
  return (
    userId === offer.creator.id &&
    offer.payout_account !== null &&
    SELLER_PAYOUT_STATUSES.includes(offer.status)
  )
}

function AccountRows({ account }: { account: ExchangePayoutAccount }) {
  const isMomo = account.kind === 'mobile_money'
  const Icon = isMomo ? Smartphone : Landmark
  return (
    <div className="flex items-center gap-3">
      <Icon size={16} className="shrink-0 text-content-secondary" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{account.account_name}</p>
        <p className="font-numeric text-xs text-content-secondary">
          {account.bank_code} · {account.account_number}
        </p>
      </div>
    </div>
  )
}

export function PaymentInstructionsCard({
  account,
  fiatDisplay,
  reference,
  status,
  deadline = null,
}: {
  account: ExchangePayoutAccount
  fiatDisplay: string
  reference: string
  status: EscrowStatus
  deadline?: Date | string | null
}) {
  const submitted = status === 'submitted'
  return (
    <section className="flex flex-col gap-3 rounded-card border border-brand-primary/40 bg-brand-primary-surface/30 p-4">
      <div>
        <h3 className="text-sm font-bold text-content-primary">
          {submitted ? 'Payment sent' : 'Pay the seller'}
        </h3>
        <p className="text-xs text-content-secondary">
          {submitted
            ? 'You marked this as paid. The seller releases the crypto once they confirm receipt.'
            : 'Send the exact amount to the account below, then mark it as paid. Only pay through this account.'}
        </p>
      </div>
      <p className="font-numeric text-lg font-bold text-content-primary">{fiatDisplay}</p>
      <AccountRows account={account} />
      <p className="font-numeric text-xs text-content-tertiary">Reference: {reference}</p>
      {deadline !== null && (
        <DeadlineCountdown
          deadline={deadline}
          label={submitted ? 'Seller confirms within' : 'Pay within'}
          className="text-sm text-content-primary"
        />
      )}
    </section>
  )
}

export function SellerPayoutCard({ account }: { account: ExchangePayoutAccount }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface-card p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
        Buyer pays into
      </h3>
      <AccountRows account={account} />
    </section>
  )
}
