/**
 * Every ordinary-lifecycle branch, rendered.
 *
 * These are the money buttons — approve, claim, refund, reclaim — and the
 * thing worth pinning is that each raises the RIGHT transition. A branch that
 * renders "Approve & Pay" but dispatches `claim_stalled` type-checks perfectly
 * and moves someone else's money.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import type { EscrowTxType } from '@tenda/shared'
import { LifecycleCTA } from '../LifecycleCTA'
import type { LifecycleBranch } from '../branches'
import type { ActiveSheet } from '../types'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: { feedback: { warning: { surface: '#fe8', base: '#a60' } } } },
  }),
}))
jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native')
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) => (
      <Text onPress={onPress}>{children}</Text>
    ),
  }
})
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

function renderBranch(branch: LifecycleBranch) {
  const onTxAction = jest.fn()
  const onAction = jest.fn()
  const onRetryDraft = jest.fn()
  render(
    <LifecycleCTA
      branch={branch}
      isTxBuilding={false}
      onAction={onAction}
      onTxAction={onTxAction}
      onRetryDraft={onRetryDraft}
    />,
  )
  return { onTxAction, onAction, onRetryDraft }
}

/** Each wallet-opening button, and the transition it must dispatch. */
const TX_BUTTONS: readonly [LifecycleBranch, string, EscrowTxType][] = [
  ['refundExpired', 'Claim Refund', 'refund_expired'],
  ['accept', 'Accept Gig', 'accept'],
  ['cancel', 'Cancel Gig', 'cancel'],
  ['approve', 'Approve & Pay', 'approve'],
  ['claimAndProof', 'Claim Payment', 'claim_stalled'],
  ['reclaim', 'Reclaim Escrow', 'reclaim_abandoned'],
]

test.each(TX_BUTTONS)('%s renders "%s" and dispatches %s', (branch, label, action) => {
  const { onTxAction } = renderBranch(branch)
  fireEvent.press(screen.getByText(label))
  expect(onTxAction).toHaveBeenCalledWith(action)
})

/** Each sheet-opening button, and the sheet it must open. */
const SHEET_BUTTONS: readonly [LifecycleBranch, string, ActiveSheet][] = [
  ['submit', 'Submit Proof', 'proof'],
  ['addProof', 'Add More Proof', 'addProof'],
  ['disputeOnly', 'Dispute', 'dispute'],
  ['review', 'Leave Review', 'review'],
  ['disputedWithEvidence', 'Add Evidence', 'addProof'],
]

test.each(SHEET_BUTTONS)('%s renders "%s" and opens the %s sheet', (branch, label, sheet) => {
  const { onAction } = renderBranch(branch)
  fireEvent.press(screen.getByText(label))
  expect(onAction).toHaveBeenCalledWith(sheet)
})

test('draft offers both delete and repost, and repost is not a transaction', () => {
  const { onAction, onRetryDraft, onTxAction } = renderBranch('draft')

  fireEvent.press(screen.getByText('Delete Draft'))
  expect(onAction).toHaveBeenCalledWith('delete')

  fireEvent.press(screen.getByText('Edit & repost'))
  expect(onRetryDraft).toHaveBeenCalled()
  // Reposting builds a NEW escrow through the create flow; the draft's own
  // unsigned tx is bound to the old id, so nothing is dispatched here.
  expect(onTxAction).not.toHaveBeenCalled()
})

test('approve pairs the happy path with a dispute escape', () => {
  const { onAction } = renderBranch('approve')
  fireEvent.press(screen.getByText('Dispute delivery'))
  expect(onAction).toHaveBeenCalledWith('dispute')
})

test('claimAndProof keeps the evidence route open alongside the claim', () => {
  const { onAction } = renderBranch('claimAndProof')
  fireEvent.press(screen.getByText('Add Proof'))
  expect(onAction).toHaveBeenCalledWith('addProof')
})

test('reclaim keeps dispute available — reclaiming is not the only recourse', () => {
  const { onAction } = renderBranch('reclaim')
  fireEvent.press(screen.getByText('Dispute'))
  expect(onAction).toHaveBeenCalledWith('dispute')
})

test('a disputed non-party sees the notice and no action at all', () => {
  const { onAction, onTxAction } = renderBranch('disputedNotice')
  expect(screen.getByText('Under review by admin')).toBeTruthy()
  expect(screen.queryByText('Add Evidence')).toBeNull()
  expect(onAction).not.toHaveBeenCalled()
  expect(onTxAction).not.toHaveBeenCalled()
})

test('the disputed worker keeps the notice alongside the evidence button', () => {
  renderBranch('disputedWithEvidence')
  expect(screen.getByText('Under review by admin')).toBeTruthy()
  // No redundant "Dispute" — one is already open.
  expect(screen.queryByText('Dispute')).toBeNull()
})
