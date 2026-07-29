/**
 * The approval-mode CTA, rendered.
 *
 * `branches.test.ts` pins WHICH branch applies; this pins what each one puts
 * on screen and which handler it raises — in particular that `unassign` is the
 * only one that reaches the wallet, and that apply/withdraw/release do not.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
import type { StyleProp, ViewStyle } from 'react-native'
import { GigCTABar } from '@/components/gig/GigCTABar'
import { ApprovalCTA } from '../ApprovalCTA'
import {
  CREATOR_ID,
  STRANGER_ID,
  WORKER_ID,
  application,
  assignedApprovalGig,
  gigDetail,
} from '../../__fixtures__/gig-detail'
import type { ApplicationStatus, GigDetail } from '@tenda/shared'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        surface: { background: '#fff', inset: '#f4f4f4', card: '#fff' },
        border: { subtle: '#eee', default: '#ddd' },
        content: { primary: '#111', secondary: '#666', tertiary: '#999' },
        accent: { primary: '#c80' },
        feedback: {
          warning: { surface: '#fe8', base: '#a60', text: '#420', border: '#ec6' },
          danger: { surface: '#fdd', base: '#c00', text: '#600', border: '#e88' },
        },
      },
    },
  }),
}))
// Forwards `style` so the row-sizing assertion below can see it: the real
// Button spreads it onto its Pressable, and a mock that swallowed it would
// make a layout regression invisible here.
jest.mock('@/components/ui/Button', () => {
  const { Text } = require('react-native')
  return {
    Button: ({
      children,
      onPress,
      style,
    }: {
      children: React.ReactNode
      onPress?: () => void
      style?: StyleProp<ViewStyle>
    }) => (
      <Text onPress={onPress} style={style}>
        {children}
      </Text>
    ),
  }
})
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})
// The countdown ticks on a real interval; the branch logic under test does not
// depend on its internals, only that a deadline reaches it.
jest.mock('@/components/shared/DeadlineCountdown', () => {
  const { Text } = require('react-native')
  return {
    DeadlineCountdown: ({ label, deadline }: { label?: string; deadline: unknown }) => (
      <Text>{`${label ?? 'clock'}:${deadline === null ? 'none' : 'set'}`}</Text>
    ),
  }
})

function approvalGig(overrides: Partial<GigDetail> = {}): GigDetail {
  return gigDetail({ requires_approval: true, ...overrides })
}

function viewer(status: ApplicationStatus, count: number | null = null) {
  return { application: application({ status }), open_application_count: count }
}

function renderBar(gig: GigDetail, userId: string) {
  const onApprovalAction = jest.fn()
  const onTxAction = jest.fn()
  render(
    <GigCTABar
      gig={gig}
      userId={userId}
      isTxBuilding={false}
      txInProgress={false}
      onAction={() => {}}
      onTxAction={onTxAction}
      onApprovalAction={onApprovalAction}
      onRetryDraft={() => {}}
    />,
  )
  return { onApprovalAction, onTxAction }
}

test('poster sees the applicant count on the CTA and navigates, opening no wallet', () => {
  const { onApprovalAction, onTxAction } = renderBar(
    approvalGig({ viewer: { application: null, open_application_count: 4 } }),
    CREATOR_ID,
  )

  const cta = screen.getByText('View applicants (4)')
  fireEvent.press(cta)
  expect(onApprovalAction).toHaveBeenCalledWith('viewApplicants')
  expect(onTxAction).not.toHaveBeenCalled()
})

test('poster with no count yet gets the bare label, never "(0)"', () => {
  renderBar(approvalGig(), CREATOR_ID)
  expect(screen.getByText('View applicants')).toBeTruthy()
})

test('release assignment raises `unassign`, and shows the window it depends on', () => {
  const { onApprovalAction, onTxAction } = renderBar(assignedApprovalGig(), CREATOR_ID)

  fireEvent.press(screen.getByText('Release assignment'))
  // Every approval branch travels ONE callback; the screen (useApprovalFlow)
  // is what routes this particular one to the transaction gate, so the bar
  // cannot wire a branch to the wrong channel.
  expect(onApprovalAction).toHaveBeenCalledWith('unassign')
  expect(onTxAction).not.toHaveBeenCalled()
  // The window is the only reason the button exists, so it is on screen.
  expect(screen.getByText('Release window:set')).toBeTruthy()
})

test('the poster is warned when releasing would run the accept clock out', () => {
  // Critical assessment #3: `accept_deadline` does NOT extend across
  // assign/unassign cycles, so cycling workers can lose the gig to the refund
  // path. Nothing else on this screen says so.
  renderBar(
    assignedApprovalGig({}, {
      accept_deadline: new Date(Date.now() + 60_000).toISOString(),
    }),
    CREATOR_ID,
  )
  expect(screen.getByText(/closes to new workers soon/i)).toBeTruthy()
})

test('a poster whose accept window has already gone is told THAT, not "hurry"', () => {
  // The common case, not the exotic one: the release window runs from the
  // assignment, so a gig assigned near its deadline spends most of that window
  // here. "Closes soon" would be false, and it is the difference between
  // "find someone else quickly" and "you cannot find anyone else at all".
  renderBar(
    assignedApprovalGig({}, {
      accept_deadline: new Date(Date.now() - 60_000).toISOString(),
    }),
    CREATOR_ID,
  )
  expect(screen.getByText(/already closed to new workers/i)).toBeTruthy()
  expect(screen.queryByText(/closes to new workers soon/i)).toBeNull()
})

test('no warning while there is still time to assign someone else', () => {
  renderBar(
    assignedApprovalGig({}, {
      accept_deadline: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
    }),
    CREATOR_ID,
  )
  expect(screen.queryByText(/closes to new workers soon/i)).toBeNull()
})

test('an indefinitely-open gig has no clock to run out', () => {
  renderBar(assignedApprovalGig({}, { accept_deadline: null }), CREATOR_ID)
  expect(screen.queryByText(/closes to new workers soon/i)).toBeNull()
})

test("a released worker's warning reaches the poster on the same bar", () => {
  renderBar(
    assignedApprovalGig({}, { assignment_released_at: new Date().toISOString() }),
    CREATOR_ID,
  )
  expect(screen.getByText(/your worker said they are not available/i)).toBeTruthy()
  expect(screen.getByText('Release assignment')).toBeTruthy()
})

test('the assigned worker gets a free, off-chain way out', () => {
  const { onApprovalAction, onTxAction } = renderBar(assignedApprovalGig(), WORKER_ID)

  fireEvent.press(screen.getByText(/not available/i))
  expect(onApprovalAction).toHaveBeenCalledWith('release')
  // Off-chain by design: they signed nothing to be assigned, so charging gas
  // for the honest exit would make ghosting the cheaper option.
  expect(onTxAction).not.toHaveBeenCalled()
})

test('a worker with a live application waits, with a withdraw and an expiry clock', () => {
  const { onApprovalAction } = renderBar(approvalGig({ viewer: viewer('open') }), STRANGER_ID)

  expect(screen.getByText('Waiting on the poster')).toBeTruthy()
  expect(screen.getByText('Expires:set')).toBeTruthy()
  fireEvent.press(screen.getByText('Withdraw application'))
  expect(onApprovalAction).toHaveBeenCalledWith('withdraw')
})

test('an open application on a gig that is OVER stops claiming the poster is deciding', () => {
  // Cancelling or refunding settles no applications — only an assignment does
  // (D4) — so an open row outlives the gig until the expiry sweep. Withdraw
  // stays offered: the row still occupies one of the applicant's slots.
  const { onApprovalAction } = renderBar(
    approvalGig({ status: 'cancelled', viewer: viewer('open') }),
    STRANGER_ID,
  )

  expect(screen.queryByText('Waiting on the poster')).toBeNull()
  expect(screen.getByText(/no longer taking workers/i)).toBeTruthy()
  fireEvent.press(screen.getByText('Withdraw application'))
  expect(onApprovalAction).toHaveBeenCalledWith('withdraw')
})

test('an expired-but-open gig reads as closed to its applicants too', () => {
  // The gig row still says `open`, but past `accept_deadline` the poster
  // cannot assign anybody — it is on the refund path. Statuses alone would
  // miss this one.
  renderBar(
    approvalGig({
      status: 'open',
      accept_deadline: new Date(Date.now() - 60_000).toISOString(),
      viewer: viewer('open'),
    }),
    STRANGER_ID,
  )

  expect(screen.queryByText('Waiting on the poster')).toBeNull()
  expect(screen.getByText(/no longer taking workers/i)).toBeTruthy()
})

test('a worker who has not applied gets Apply, not Accept', () => {
  const { onApprovalAction } = renderBar(approvalGig(), STRANGER_ID)

  expect(screen.queryByText('Accept Gig')).toBeNull()
  fireEvent.press(screen.getByText('Apply for this gig'))
  expect(onApprovalAction).toHaveBeenCalledWith('apply')
})

test('a passed applicant is told, rather than shown an empty bar', () => {
  renderBar(approvalGig({ status: 'accepted', viewer: viewer('passed') }), STRANGER_ID)
  expect(screen.getByText(/picked someone else/i)).toBeTruthy()
})

test('a transaction in flight replaces every approval action', () => {
  render(
    <GigCTABar
      gig={approvalGig({ viewer: viewer('open') })}
      userId={STRANGER_ID}
      isTxBuilding={false}
      txInProgress
      onAction={() => {}}
      onTxAction={() => {}}
      onApprovalAction={() => {}}
      onRetryDraft={() => {}}
    />,
  )
  expect(screen.getByText(/transaction in progress/i)).toBeTruthy()
  expect(screen.queryByText('Withdraw application')).toBeNull()
})

/**
 * Paths the state matrix cannot reach, because they are properties of the
 * COMPONENT rather than of any gig.
 *
 * `width: 'grow'` is one: no approval branch currently shares the secondary
 * row with another, so only a direct render exercises it. It is kept — and
 * pinned here — because the day one does, a button that ignored the row would
 * blow the layout out sideways rather than fail a test.
 */
test('grows to fill the row when it shares one with a narrower button', () => {
  const { toJSON } = render(
    <ApprovalCTA
      branch="release"
      gig={assignedApprovalGig()}
      busy={false}
      width="grow"
      onAction={jest.fn()}
    />,
  )
  expect(JSON.stringify(toJSON())).toContain('"flex":1')
})

test('offers Apply with no status line to someone who never applied', () => {
  render(
    <ApprovalCTA
      branch="apply"
      gig={approvalGig({ viewer: null })}
      busy={false}
      width="full"
      onAction={jest.fn()}
    />,
  )
  expect(screen.getByText('Apply for this gig')).toBeTruthy()
  // No application means nothing has become of one, so no sentence about it.
  expect(screen.queryByText(/waiting on the poster/i)).toBeNull()
})

test('a lost branch with no application renders nothing, not an empty box', () => {
  const { toJSON } = render(
    <ApprovalCTA
      branch="lost"
      gig={approvalGig({ viewer: null })}
      busy={false}
      width="full"
      onAction={jest.fn()}
    />,
  )
  expect(toJSON()).toBeNull()
})
