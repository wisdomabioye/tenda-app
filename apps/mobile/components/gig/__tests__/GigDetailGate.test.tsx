/**
 * The shared load/guard preamble for the gig detail and the applicant list.
 *
 * The cases that matter are the STALE ones. `gigs.store` holds a single
 * `selectedGig` slot for every gig, so without an id check a screen renders
 * the previous gig for a frame — which since approval mode means the previous
 * viewer's actions, e.g. "Withdraw application" on a gig this user never
 * applied to. The error slot has the same problem in reverse.
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import type { GigDetail } from '@tenda/shared'
import { GigDetailGate } from '../GigDetailGate'
import { CREATOR_ID, STRANGER_ID, gigDetail } from '../__fixtures__/gig-detail'

const mockFetch = jest.fn()
// `mock`-prefixed so jest's hoisted factories may reference them.
let mockStoreState: {
  selectedGig: GigDetail | null
  error: string | null
  errorId: string | null
} = { selectedGig: null, error: null, errorId: null }
let mockAuthUser: { id: string } | null = { id: CREATOR_ID }

let mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: (...args: unknown[]) => mockBack(...args) }),
  // Fire the focus callback once, as focus does on mount.
  useFocusEffect: (cb: () => void) => {
    const { useEffect } = require('react')
    useEffect(cb, [])
  },
}))
jest.mock('@/stores', () => ({
  useGigsStore: () => ({ ...mockStoreState, fetchGigDetail: mockFetch }),
  useAuthStore: (selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: mockAuthUser }),
}))
// The action callbacks are rendered as pressable text so the recovery paths
// (Retry, Go back) are exercised rather than merely declared.
jest.mock('@/components/ui', () => {
  const { Text, View } = require('react-native')
  return {
    ScreenContainer: ({ children }: { children: React.ReactNode }) => <View>{children}</View>,
    EmptyState: ({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) => (
      <View>
        <Text>{title}</Text>
        {action !== undefined && <Text onPress={action.onPress}>{action.label}</Text>}
      </View>
    ),
  }
})
jest.mock('@/components/feedback', () => {
  const { Text, View } = require('react-native')
  return {
    LoadingScreen: () => <Text>loading</Text>,
    ErrorState: ({ title, ctaLabel, onCtaPress }: { title: string; ctaLabel: string; onCtaPress: () => void }) => (
      <View>
        <Text>{title}</Text>
        <Text onPress={onCtaPress}>{ctaLabel}</Text>
      </View>
    ),
  }
})

function renderGate(id: string | undefined, requireCreator = false) {
  const child = jest.fn((gig: GigDetail) => {
    const { Text } = require('react-native')
    return <Text>{`loaded:${gig.escrow_id}`}</Text>
  })
  render(
    <GigDetailGate id={id} requireCreator={requireCreator}>
      {child}
    </GigDetailGate>,
  )
  return child
}

beforeEach(() => {
  mockStoreState = { selectedGig: null, error: null, errorId: null }
  mockAuthUser = { id: CREATOR_ID }
  mockBack = jest.fn()
})

test('fetches the requested id on focus', () => {
  renderGate('gig-1')
  expect(mockFetch).toHaveBeenCalledWith('gig-1')
})

test('renders the gig once the store holds THIS id', () => {
  mockStoreState.selectedGig = gigDetail({ escrow_id: 'gig-1' })
  const child = renderGate('gig-1')

  expect(screen.getByText('loaded:gig-1')).toBeTruthy()
  expect(child).toHaveBeenCalled()
})

test('a gig from a PREVIOUS screen is never rendered — it loads instead', () => {
  // The store still holds gig-1 while gig-2 is being opened.
  mockStoreState.selectedGig = gigDetail({ escrow_id: 'gig-1' })
  const child = renderGate('gig-2')

  expect(screen.getByText('loading')).toBeTruthy()
  expect(child).not.toHaveBeenCalled()
})

test('an error from another gig does not surface on this one', () => {
  mockStoreState.error = 'Network request failed'
  mockStoreState.errorId = 'gig-1'
  renderGate('gig-2')

  // Its own fetch is in flight; claiming failure here would be a lie.
  expect(screen.getByText('loading')).toBeTruthy()
  expect(screen.queryByText('Failed to load gig')).toBeNull()
})

test('an error for THIS gig does surface', () => {
  mockStoreState.error = 'Network request failed'
  mockStoreState.errorId = 'gig-1'
  renderGate('gig-1')

  expect(screen.getByText('Failed to load gig')).toBeTruthy()
})

test('no id at all is the only not-found state', () => {
  renderGate(undefined)
  expect(screen.getByText('Gig not found')).toBeTruthy()
  expect(mockFetch).not.toHaveBeenCalled()
})

test('requireCreator renders for the poster', () => {
  mockStoreState.selectedGig = gigDetail({ escrow_id: 'gig-1' })
  renderGate('gig-1', true)
  expect(screen.getByText('loaded:gig-1')).toBeTruthy()
})

test('requireCreator blocks everyone else — the route would 403 anyway', () => {
  mockStoreState.selectedGig = gigDetail({ escrow_id: 'gig-1' })
  mockAuthUser = { id: STRANGER_ID }
  const child = renderGate('gig-1', true)

  expect(screen.getByText('Not available')).toBeTruthy()
  expect(child).not.toHaveBeenCalled()
})

test('requireCreator blocks a signed-out reader too', () => {
  mockStoreState.selectedGig = gigDetail({ escrow_id: 'gig-1' })
  mockAuthUser = null
  renderGate('gig-1', true)
  expect(screen.getByText('Not available')).toBeTruthy()
})

test('Retry re-requests the SAME id that failed', () => {
  mockStoreState.error = 'Network request failed'
  mockStoreState.errorId = 'gig-1'
  renderGate('gig-1')
  mockFetch.mockClear()

  fireEvent.press(screen.getByText('Retry'))
  expect(mockFetch).toHaveBeenCalledWith('gig-1')
})

test('the recovery states offer a way back', () => {
  const back = jest.fn()
  mockBack = back

  renderGate(undefined)
  fireEvent.press(screen.getByText('Go back'))
  expect(back).toHaveBeenCalled()
})

test('the creator guard offers a way back too', () => {
  const back = jest.fn()
  mockBack = back
  mockStoreState.selectedGig = gigDetail({ escrow_id: 'gig-1' })
  mockAuthUser = { id: STRANGER_ID }

  renderGate('gig-1', true)
  fireEvent.press(screen.getByText('Go back'))
  expect(back).toHaveBeenCalled()
})
