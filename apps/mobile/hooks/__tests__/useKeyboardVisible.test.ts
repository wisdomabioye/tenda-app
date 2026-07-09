/**
 * useKeyboardVisible — flips true/false off the RN keyboard show/hide events,
 * and detaches both listeners on unmount. ChatInput relies on this to collapse
 * its nav-bar inset while the keyboard (which covers that area under SDK 54
 * edge-to-edge) is open.
 */
import { renderHook, act } from '@testing-library/react-native'
import { Keyboard, type EmitterSubscription } from 'react-native'
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible'

function captureListeners() {
  const handlers: Record<string, () => void> = {}
  const remove = jest.fn()
  const sub = { remove } as unknown as EmitterSubscription
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, cb) => {
    handlers[String(event)] = cb as () => void
    return sub
  })
  return { handlers, remove }
}

afterEach(() => jest.restoreAllMocks())

test('starts false, then follows show → hide events', () => {
  const { handlers } = captureListeners()
  const { result } = renderHook(() => useKeyboardVisible())

  expect(result.current).toBe(false)
  act(() => handlers.keyboardDidShow())
  expect(result.current).toBe(true)
  act(() => handlers.keyboardDidHide())
  expect(result.current).toBe(false)
})

test('removes both listeners on unmount', () => {
  const { remove } = captureListeners()
  const { unmount } = renderHook(() => useKeyboardVisible())

  unmount()
  expect(remove).toHaveBeenCalledTimes(2)
})
