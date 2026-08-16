/**
 * The toast layer — module-level queue + host: render, click-dismiss,
 * auto-dismiss, and the visible cap.
 */
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { ToastHost, clearToastsForTests, showToast } from '@/components/ui/Toast'

afterEach(() => {
  act(() => clearToastsForTests())
  vi.useRealTimers()
})

test('showToast renders in the host and click dismisses', () => {
  render(<ToastHost />)
  act(() => showToast('success', 'Gig funded and live!'))
  const toast = screen.getByText('Gig funded and live!')
  expect(toast).toBeInTheDocument()
  fireEvent.click(toast)
  expect(screen.queryByText('Gig funded and live!')).not.toBeInTheDocument()
})

test('toasts auto-dismiss', () => {
  vi.useFakeTimers()
  render(<ToastHost />)
  act(() => showToast('info', 'Saved'))
  expect(screen.getByText('Saved')).toBeInTheDocument()
  act(() => vi.advanceTimersByTime(4_001))
  expect(screen.queryByText('Saved')).not.toBeInTheDocument()
})

test('only the newest toasts stay visible (cap)', () => {
  render(<ToastHost />)
  act(() => {
    showToast('info', 'one')
    showToast('info', 'two')
    showToast('info', 'three')
    showToast('info', 'four')
  })
  expect(screen.queryByText('one')).not.toBeInTheDocument()
  expect(screen.getByText('two')).toBeInTheDocument()
  expect(screen.getByText('four')).toBeInTheDocument()
})

test('a toast fired BEFORE the host mounts still renders (module-level queue)', () => {
  act(() => showToast('error', 'early bird'))
  render(<ToastHost />)
  expect(screen.getByText('early bird')).toBeInTheDocument()
})
