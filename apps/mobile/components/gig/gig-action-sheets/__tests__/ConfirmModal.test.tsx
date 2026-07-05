/**
 * ConfirmModal — the gig kind→copy wrapper over ConfirmDialog. The accept
 * dialog must name the concrete "deliver within" window (so the worker commits
 * against the real deadline, not a vague "deadline"), and fall back to generic
 * copy when the duration is unknown (e.g. exchange offers).
 */
import { render, screen } from '@testing-library/react-native'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        surface: { overlay: 'rgba(0,0,0,0.4)', card: '#fff' },
        content: { secondary: '#555' },
      },
    },
  }),
}))

jest.mock('@/components/ui/Button', () => {
  const { Pressable, Text } = require('react-native')
  return {
    Button: ({ children, onPress }: { children: React.ReactNode; onPress: () => void }) => (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
  }
})

import { ConfirmModal } from '@/components/gig/gig-action-sheets/ConfirmModal'

const noop = jest.fn()

it('accept: names the concrete deliver-within window', () => {
  render(<ConfirmModal kind="accept" deliverWithin="2d" onCancel={noop} onConfirm={noop} />)
  expect(screen.getByText('Accept this gig?')).toBeTruthy()
  expect(screen.getByText(/deliver within 2d/i)).toBeTruthy()
})

it('accept: falls back to generic copy when the duration is unknown', () => {
  render(<ConfirmModal kind="accept" deliverWithin={null} onCancel={noop} onConfirm={noop} />)
  // Generic line — no concrete duration, but still phrased as "deliver within".
  expect(screen.getByText(/deliver within the agreed time/i)).toBeTruthy()
})

it('accept: defaults to generic copy when deliverWithin is omitted', () => {
  render(<ConfirmModal kind="accept" onCancel={noop} onConfirm={noop} />)
  expect(screen.getByText(/deliver within the agreed time/i)).toBeTruthy()
})

it('non-accept kinds keep their own copy (cancel)', () => {
  render(<ConfirmModal kind="cancel" deliverWithin="2d" onCancel={noop} onConfirm={noop} />)
  expect(screen.getByText('Cancel this gig?')).toBeTruthy()
  // The deliver-within window must never leak into non-accept dialogs.
  expect(screen.queryByText(/deliver within/i)).toBeNull()
})

it('renders nothing when kind is null', () => {
  render(<ConfirmModal kind={null} onCancel={noop} onConfirm={noop} />)
  expect(screen.queryByText('Accept this gig?')).toBeNull()
})
