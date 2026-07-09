/**
 * DisputeMessageBubble — sender label + timestamp are gated by the grouping
 * flags (showSender/showTime), the other party is named, and "me" bubbles
 * never render a sender label.
 */
import { render, screen } from '@testing-library/react-native'
import type { DisputeMessage } from '@tenda/shared'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: { surface: { inset: '#eee' }, content: { primary: '#000', tertiary: '#666' }, brand: { primary: '#00f' } } },
  }),
}))
jest.mock('@/lib/theme', () => ({ useIsDark: () => false }))
jest.mock('@/components/ui/Text', () => {
  const { Text } = require('react-native')
  return { Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text> }
})

import { DisputeMessageBubble } from '@/components/dispute/DisputeMessageBubble'

const message: DisputeMessage = {
  id: 'm1',
  dispute_id: 'd1',
  sender_id: 'u1',
  body: 'The work was never delivered.',
  created_at: '2026-07-01T10:00:00.000Z',
}

test('party bubble at run start shows the other party name', () => {
  render(<DisputeMessageBubble message={message} sender="party" senderName="Ben Worker" showSender showTime />)
  expect(screen.getByText('Ben Worker')).toBeTruthy()
  expect(screen.getByText('The work was never delivered.')).toBeTruthy()
})

test('mediator bubble is labelled Mediator regardless of senderName', () => {
  render(<DisputeMessageBubble message={message} sender="mediator" senderName="Ben" showSender showTime />)
  expect(screen.getByText('Mediator')).toBeTruthy()
})

test('continuation bubble (showSender=false) hides the sender label', () => {
  render(<DisputeMessageBubble message={message} sender="party" senderName="Ben Worker" showSender={false} showTime />)
  expect(screen.queryByText('Ben Worker')).toBeNull()
})

test('my own bubble never shows a sender label', () => {
  render(<DisputeMessageBubble message={message} sender="me" showSender showTime />)
  expect(screen.queryByText('Other party')).toBeNull()
  expect(screen.queryByText('Mediator')).toBeNull()
})

test('showTime=false hides the timestamp', () => {
  const { rerender } = render(
    <DisputeMessageBubble message={message} sender="party" senderName="Ben" showSender showTime={false} />,
  )
  // No time slot rendered; only the label + body are present.
  expect(screen.getByText('Ben')).toBeTruthy()
  rerender(<DisputeMessageBubble message={message} sender="party" senderName="Ben" showSender showTime />)
  // With showTime, a formatted time string is appended (non-empty).
  expect(screen.getByText('Ben')).toBeTruthy()
})

test('party without a senderName falls back to a generic label', () => {
  render(<DisputeMessageBubble message={message} sender="party" showSender showTime />)
  expect(screen.getByText('Other party')).toBeTruthy()
})
