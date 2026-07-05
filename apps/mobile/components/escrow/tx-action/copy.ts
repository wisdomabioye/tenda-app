/**
 * Copy for the on-chain transition feedback (blockchain-newcomer UX): a
 * pre-sign confirm gate that spells out what an action does + that the wallet
 * is about to open, plus the present-tense verb the progress modal shows while
 * the tx is in flight. Single source shared by the gig, exchange, and post-gig
 * screens so the wording never drifts between them.
 */
import { type EscrowTxType } from '@tenda/shared'

/** Whether the transition applies to a gig or a P2P exchange offer. */
export type EscrowKind = 'gig' | 'exchange'

/**
 * Present-tense label shown in the progress modal while the tx confirms, e.g.
 * "Releasing payment…". Total over EscrowTxType so a new action can never
 * silently fall through to a blank heading (TS errors until it's added here).
 */
export const TX_PROGRESS_LABEL: Record<EscrowTxType, string> = {
  create: 'Funding escrow',
  accept: 'Accepting',
  decline: 'Declining',
  submit: 'Submitting',
  approve: 'Releasing payment',
  claim_stalled: 'Claiming payment',
  cancel: 'Cancelling',
  refund_expired: 'Processing refund',
  reclaim_abandoned: 'Reclaiming escrow',
  dispute: 'Raising dispute',
  resolve: 'Resolving',
}

/**
 * Actions routed through the shared confirm gate (a wallet-opening move whose
 * consequence the user should read first). `submit`/`dispute` are excluded:
 * they collect input in their own sheets, which carry the wallet note inline.
 */
const GATED_ACTIONS: readonly EscrowTxType[] = [
  'create',
  'accept',
  'approve',
  'claim_stalled',
  'cancel',
  'refund_expired',
  'reclaim_abandoned',
]

/** Appended to every gated body so the wallet popup is never a surprise. */
export const WALLET_OPEN_NOTE = 'Your wallet will open next — approve there to finish.'

export function isGatedTxAction(action: EscrowTxType): boolean {
  return GATED_ACTIONS.includes(action)
}

export interface TxConfirmContext {
  /** Pre-formatted principal, e.g. "50 USDC" (shared formatAssetAmount). */
  amount: string
  kind: EscrowKind
  /** Accept dialog names the concrete "deliver within" window when known. */
  deliverWithin?: string | null
}

export interface TxConfirmCopy {
  title: string
  body: string
  confirmLabel: string
  /** Renders the confirm button in the danger style. */
  destructive: boolean
}

/** Per-action copy, before the shared wallet note is appended. */
function buildCopy(action: EscrowTxType, ctx: TxConfirmContext): TxConfirmCopy | null {
  const { amount, kind, deliverWithin } = ctx
  switch (action) {
    case 'create':
      return kind === 'gig'
        ? {
            title: 'Fund this gig?',
            body: `This locks ${amount} in escrow to fund the gig. Workers only see it once the payment confirms on-chain.`,
            confirmLabel: 'Fund Gig',
            destructive: false,
          }
        : {
            title: 'Publish this offer?',
            body: `This locks ${amount} in escrow. Buyers can accept once it confirms on-chain.`,
            confirmLabel: 'Publish Offer',
            destructive: false,
          }
    case 'accept':
      return kind === 'gig'
        ? {
            title: 'Accept this gig?',
            body:
              deliverWithin != null && deliverWithin !== ''
                ? `Once you accept, you must deliver within ${deliverWithin}. Only accept if you can complete it in time.`
                : 'Once you accept, you must deliver within the agreed time window.',
            confirmLabel: 'Accept Gig',
            destructive: false,
          }
        : {
            title: 'Accept this offer?',
            body: `You'll be matched as the buyer for ${amount}. Pay the seller off-platform, then mark it as paid.`,
            confirmLabel: 'Accept Offer',
            destructive: false,
          }
    case 'approve':
      return kind === 'gig'
        ? {
            title: 'Release payment?',
            body: `This releases the ${amount} held in escrow to the worker. It can't be undone.`,
            confirmLabel: 'Approve & Pay',
            destructive: false,
          }
        : {
            title: 'Confirm payment received?',
            body: `This releases the ${amount} held in escrow to the buyer. It can't be undone.`,
            confirmLabel: 'Confirm & Release',
            destructive: false,
          }
    case 'claim_stalled':
      return {
        title: kind === 'gig' ? 'Claim payment?' : 'Claim crypto?',
        body: `This sends the ${amount} held in escrow to your wallet.`,
        confirmLabel: kind === 'gig' ? 'Claim Payment' : 'Claim Crypto',
        destructive: false,
      }
    case 'cancel':
      return {
        title: kind === 'gig' ? 'Cancel this gig?' : 'Cancel this offer?',
        body: `The ${amount} escrow will be refunded to your wallet on-chain.`,
        confirmLabel: kind === 'gig' ? 'Cancel Gig' : 'Cancel Offer',
        destructive: true,
      }
    case 'refund_expired':
      return {
        title: 'Claim refund?',
        body: `The ${amount} escrow will be returned to your wallet. This closes it and can't be undone.`,
        confirmLabel: 'Claim Refund',
        destructive: false,
      }
    case 'reclaim_abandoned':
      return {
        title: 'Reclaim escrow?',
        body: `The counterparty didn't complete in time. The ${amount} escrow will be returned to your wallet.`,
        confirmLabel: 'Reclaim Escrow',
        destructive: false,
      }
    default:
      // decline / submit / dispute / resolve are not gated here.
      return null
  }
}

/**
 * Confirm-gate copy for a gated action, or null for actions that don't route
 * through the gate. The shared wallet note is appended once here (DRY).
 */
export function txConfirmCopy(action: EscrowTxType, ctx: TxConfirmContext): TxConfirmCopy | null {
  const copy = buildCopy(action, ctx)
  if (copy === null) return null
  return { ...copy, body: `${copy.body}\n\n${WALLET_OPEN_NOTE}` }
}
