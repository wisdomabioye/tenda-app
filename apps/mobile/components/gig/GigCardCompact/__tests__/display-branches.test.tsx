/**
 * The display arms every gig card chooses between, driven for all three
 * variants.
 *
 * These files are almost entirely ternaries — deadline tone and glyph, remote
 * vs on-site, cross-border, `showStatus`, a priced vs unpriceable asset — and
 * until this suite each one was exercised on exactly one arm. That is not a
 * coverage statistic: the untaken arms are what a reader actually sees on an
 * urgent gig, an expired one, a remote one, or one in a country the location
 * table does not know. A card that silently renders the wrong tone or drops a
 * label there fails nothing today.
 *
 * The cards are pure given props, so the whole matrix is render-and-read.
 * `gigDeadlineMeta` is REAL — the tone arms are selected by moving
 * `accept_deadline` relative to a frozen clock, not by stubbing the rule,
 * because which deadline counts as urgent is part of what is under test.
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import { StyleSheet, type ViewStyle } from 'react-native'
import type { GigSummary } from '@tenda/shared'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        surface: { card: '#fff', backgroundAlt: '#f7f7f7', inset: '#eee' },
        border: { default: '#ddd', subtle: '#eee' },
        content: { primary: '#000', secondary: '#333', tertiary: '#666' },
        brand: { primary: '#00f', primarySurface: '#eef' },
        feedback: {
          warning: { base: '#a60', surface: '#fe8' },
          success: { base: '#0a0', surface: '#cfc' },
          danger: { base: '#c00', surface: '#fcc' },
        },
        // The REAL shape: a fixed record over the five known categories. A
        // Proxy answering every key made the unknown-category path look safe
        // when the production theme returns undefined for it.
        category: {
          delivery: { base: '#123' },
          photo: { base: '#234' },
          errand: { base: '#345' },
          service: { base: '#456' },
          digital: { base: '#567' },
        },
      },
    },
  }),
}))
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})
jest.mock('@/components/ui/MoneyText', () => {
  const { Text } = require('react-native')
  return { MoneyText: ({ amountLabel }: { amountLabel: string }) => <Text>{amountLabel}</Text> }
})
// Each icon renders its own name, so a test can tell the clock from the check
// and the pin from the globe — which arm was taken is the point here.
jest.mock('lucide-react-native', () => {
  const { Text } = require('react-native')
  function stub(name: string) {
    function Icon() {
      return <Text>{`icon:${name}`}</Text>
    }
    return Icon
  }
  return {
    Clock: stub('clock'),
    Check: stub('check'),
    ArrowLeftRight: stub('cross-border'),
    MapPin: stub('pin'),
    Globe: stub('globe'),
  }
})
jest.mock('@/stores/exchange-rate.store', () => ({
  useExchangeRateStore: (sel: (s: { rates: Record<string, number> }) => unknown) =>
    sel({ rates: { NGN: 150_000, USD: 150 } }),
}))
jest.mock('@/stores/settings.store', () => ({
  useSettingsStore: (sel: (s: { currency: string }) => unknown) => sel({ currency: 'NGN' }),
}))

import { GigCardCompactPriceLeading } from '@/components/gig/GigCardCompact/PriceLeading'
import { GigCardCompactRich } from '@/components/gig/GigCardCompact/Rich'
import { GigCardCompactClassic } from '@/components/gig/GigCardCompact/Classic'

/** Frozen so "in 30 minutes" means the urgent arm on every run. */
const NOW = Date.parse('2026-07-01T12:00:00.000Z')
const IN_30_MIN = new Date(NOW + 30 * 60_000).toISOString()
const IN_5_DAYS = new Date(NOW + 5 * 86_400_000).toISOString()
const PAST = new Date(NOW - 86_400_000).toISOString()

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW)
})
afterEach(() => {
  jest.useRealTimers()
})

function gig(overrides: Partial<GigSummary> = {}): GigSummary {
  return {
    escrow_id: 'e1',
    public_feed_revision: '0',
    chain_id: 'eip155:84532',
    asset: 'USDC_BASE',
    amount_raw: '50000000',
    status: 'open',
    accept_deadline: IN_5_DAYS,
    created_at: '2026-06-01T00:00:00.000Z',
    title: 'Paint the fence',
    description: 'Two coats, back fence.',
    category: 'delivery',
    country: 'NG',
    city: 'Lagos',
    latitude: null,
    longitude: null,
    remote: false,
    cross_border: false,
    proof_requirements: [],
    requires_approval: false,
    creator: {
      id: 'u1',
      first_name: 'Ada',
      last_name: 'P',
      avatar_url: null,
      review_score: null,
      country: 'NG',
      is_seeker: false,
    },
    ...overrides,
  }
}

const VARIANTS = [
  ['PriceLeading', GigCardCompactPriceLeading],
  ['Rich', GigCardCompactRich],
  ['Classic', GigCardCompactClassic],
] as const

describe.each(VARIANTS)('%s', (name, Card) => {
  test('tapping the card opens that gig', () => {
    render(<Card gig={gig()} />)

    fireEvent.press(screen.getByText('Paint the fence'))
    expect(mockPush).toHaveBeenCalledWith('/gig/e1')
  })

  test('showStatus swaps the category label for the escrow status', () => {
    render(<Card gig={gig({ status: 'submitted' })} showStatus />)

    // Classic keeps its category label and adds a status BADGE; the other two
    // reuse the one slot. Either way the status has to reach the reader.
    expect(screen.getByText('Submitted')).toBeTruthy()
  })

  test('without showStatus the category reads instead', () => {
    render(<Card gig={gig({ status: 'submitted' })} />)

    expect(screen.getByText('Delivery')).toBeTruthy()
    expect(screen.queryByText('Submitted')).toBeNull()
  })

  test('an unknown category renders instead of crashing the row', () => {
    // Two fallbacks, one cause: an old install keeps running after the server
    // adds a category. `CATEGORY_META.find` misses (so the raw key shows), and
    // `theme.colors.category[...]` is undefined — which used to throw on
    // `.base` and take the whole list down, because a render throw in a list
    // row is a blank screen, not a missing dot.
    render(<Card gig={gig({ category: 'plumbing' as GigSummary['category'] })} />)

    expect(screen.getByText('plumbing')).toBeTruthy()
  })

  test('a deadline half an hour out is URGENT, and says so with a clock', () => {
    render(<Card gig={gig({ accept_deadline: IN_30_MIN })} />)

    expect(screen.getByText('icon:clock')).toBeTruthy()
    expect(screen.getByText(/30m left/)).toBeTruthy()
  })

  test('a passed deadline reads Expired', () => {
    render(<Card gig={gig({ accept_deadline: PAST })} />)

    expect(screen.getByText('Expired')).toBeTruthy()
  })

  test('no deadline renders no chip at all', () => {
    render(<Card gig={gig({ accept_deadline: null })} />)

    expect(screen.queryByText('icon:clock')).toBeNull()
    expect(screen.queryByText(/left$/)).toBeNull()
  })

  test('a CLOSED gig shows no deadline chip at all', () => {
    // Not a preference — a consequence. `gigDeadlineMeta` answers
    // completed/resolved with the CHECK glyph and a "3d ago" label built from
    // `updated_at`, but `GigSummary` does not carry `updated_at` (nor
    // `completion_deadline`, nor `approval_deadline`). So from a card the label
    // is always empty and the chip guard hides the whole thing.
    //
    // That makes the success tone and the tick unreachable from every variant,
    // and it is why My Gigs shows no countdown on accepted or submitted rows.
    // Pinned rather than "fixed" here: closing it means adding fields to the
    // shared summary and the server's projection. If someone does, this test
    // fails and points at the three variants that then need their success arm
    // checked for the first time.
    render(<Card gig={gig({ status: 'completed' })} showStatus />)

    expect(screen.queryByText('icon:check')).toBeNull()
    expect(screen.queryByText('icon:clock')).toBeNull()
  })

  test('a cancelled gig labels itself with no glyph beside it', () => {
    // The one arm that pairs a real label with a null glyph — proof the icon
    // is driven by `glyph` and not merely by "is there a label". Without
    // `showStatus` so the word appears once, from the chip.
    render(<Card gig={gig({ status: 'cancelled' })} />)

    expect(screen.getByText('Cancelled')).toBeTruthy()
    expect(screen.queryByText('icon:clock')).toBeNull()
    expect(screen.queryByText('icon:check')).toBeNull()
  })

  test('a remote gig names itself remote instead of a city', () => {
    render(<Card gig={gig({ remote: true })} />)

    // `getAllBy`, because Rich says it twice on purpose — once in the location
    // line and once in the on-site/remote pill.
    expect(screen.getAllByText(/Remote/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Lagos')).toBeNull()
  })
})
