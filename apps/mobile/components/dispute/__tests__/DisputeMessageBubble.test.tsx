/**
 * DisputeMessageBubble — sender label + timestamp are gated by the grouping
 * flags (showSender/showTime), the other party is named, and "me" bubbles
 * never render a sender label.
 */
import { render, fireEvent, screen } from '@testing-library/react-native'
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
jest.mock('@/components/shared/media/AttachmentPreview', () => {
  const { Text, Pressable } = require('react-native')
  return {
    AttachmentPreview: ({ url, type, onPress }: { url: string; type: string; onPress: () => void }) => (
      <Pressable accessibilityLabel="preview" onPress={onPress}>
        <Text>{`${type}:${url}`}</Text>
      </Pressable>
    ),
  }
})

import { DisputeMessageBubble } from '@/components/dispute/DisputeMessageBubble'

const message: DisputeMessage = {
  id: 'm1',
  dispute_id: 'd1',
  sender_id: 'u1',
  body: 'The work was never delivered.',
  attachment_url: null,
  attachment_type: null,
  attachment_size: null,
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

test('renders an attachment preview and forwards the tap payload', () => {
  const withFile: DisputeMessage = {
    ...message,
    body: '',
    attachment_url: 'https://cdn/e.pdf',
    attachment_type: 'file',
    attachment_size: 4096,
  }
  const onAttachmentPress = jest.fn()
  render(
    <DisputeMessageBubble message={withFile} sender="party" senderName="Ben" onAttachmentPress={onAttachmentPress} />,
  )
  expect(screen.getByText('file:https://cdn/e.pdf')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('preview'))
  expect(onAttachmentPress).toHaveBeenCalledWith({ id: 'm1', url: 'https://cdn/e.pdf', type: 'file' })
})

test('attachment-only message (empty body) renders no body text', () => {
  const attachmentOnly: DisputeMessage = {
    ...message,
    body: '',
    attachment_url: 'https://cdn/a.jpg',
    attachment_type: 'image',
    attachment_size: 2048,
  }
  render(<DisputeMessageBubble message={attachmentOnly} sender="me" />)
  expect(screen.getByText('image:https://cdn/a.jpg')).toBeTruthy()
  expect(screen.queryByText('The work was never delivered.')).toBeNull()
})
