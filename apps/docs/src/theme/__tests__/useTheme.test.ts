/**
 * Three theme states, not two.
 *
 * The un-stamped state is the one most readers get — "follow the system" —
 * and it is the state a `data-theme` attribute left lying around would break.
 * So the hook is held to all three: follow, choose dark, choose light, with the
 * choice surviving a reload and a blocked storage not taking the page down.
 */
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMatchMedia, type FakeMedia } from '@/test-support/match-media'
import { storedTheme, useTheme } from '@/theme/useTheme'

let media: FakeMedia

beforeEach(() => {
  media = installMatchMedia('light')
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})
afterEach(() => { media.restore() })

describe('useTheme', () => {
  it('follows the system until a choice is made, and stamps nothing', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(result.current.chosen).toBe(false)
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('follows the system CHANGING, while no choice has been made', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { media.setSystem('dark') })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('opens dark when the reader’s system is already dark, and still stamps nothing', () => {
    // The commonest un-stamped case, and the one a light-only harness never
    // reaches: first load, no stored choice, an OS set to dark.
    media.restore()
    media = installMatchMedia('dark')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(result.current.chosen).toBe(false)
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false)
  })

  it('follows the system back to light, not only into dark', () => {
    media.restore()
    media = installMatchMedia('dark')
    const { result } = renderHook(() => useTheme())
    act(() => { media.setSystem('light') })
    expect(result.current.theme).toBe('light')
  })

  it('a choice wins over the system, in both directions', () => {
    const { result } = renderHook(() => useTheme())
    act(() => { result.current.toggle() })
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')

    // The system going dark must not un-choose light.
    act(() => { result.current.toggle() })
    act(() => { media.setSystem('dark') })
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('remembers the choice for the next visit', () => {
    const first = renderHook(() => useTheme())
    act(() => { first.result.current.toggle() })
    expect(storedTheme()).toBe('dark')
    first.unmount()

    const second = renderHook(() => useTheme())
    expect(second.result.current.theme).toBe('dark')
    expect(second.result.current.chosen).toBe(true)
  })

  it('reads nothing from a storage that refuses to answer', () => {
    expect(storedTheme({ getItem() { throw new Error('blocked') } })).toBeNull()
  })
})

describe('a storage that refuses to write', () => {
  it('still switches the theme for this visit', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: () => null, setItem() { throw new Error('blocked') } },
    })
    try {
      const { result } = renderHook(() => useTheme())
      act(() => { result.current.toggle() })
      expect(result.current.theme).toBe('dark')
      expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    } finally {
      if (original !== undefined) Object.defineProperty(globalThis, 'localStorage', original)
    }
  })
})
