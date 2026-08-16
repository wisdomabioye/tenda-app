'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Keys that move the cursor, per the comps' "j k move · Enter open". */
const NEXT_KEYS = new Set(['j', 'ArrowDown'])
const PREVIOUS_KEYS = new Set(['k', 'ArrowUp'])

/**
 * True when the key belongs to whatever the user is typing into rather than
 * to the list. Without this, typing "join" in a search field walks the list.
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
}

/** Controls whose own activation key is Enter. */
const ENTER_ACTIVATED_TAGS = new Set(['A', 'BUTTON', 'SUMMARY'])
const ENTER_ACTIVATED_ROLES = new Set(['button', 'link', 'menuitem', 'option', 'tab'])

/**
 * True when the focused element already handles Enter itself.
 *
 * The list's Enter handler calls preventDefault(), which CANCELS that
 * element's native activation — so without this guard, focusing the ⌘K button
 * and pressing Enter neither opens the palette nor leaves the list alone: the
 * palette stays shut and the list navigates to the cursor's row instead.
 * Same for a focused row link, which would navigate to the CURSOR's row
 * rather than the one the reader actually tabbed to.
 *
 * Only Enter is affected — j/k are not activation keys, so the cursor may
 * still move while a control has focus.
 */
function ownsEnter(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (ENTER_ACTIVATED_TAGS.has(target.tagName)) return true
  const role = target.getAttribute('role')
  return role !== null && ENTER_ACTIVATED_ROLES.has(role)
}

export interface ListKeyboard {
  activeIndex: number
  setActiveIndex: (index: number) => void
  /** Ref for the row at `activeIndex`, so it can be scrolled into view. */
  activeRowRef: (node: HTMLElement | null) => void
}

/**
 * j/k (and arrow) cursor over a flat row list, with Enter to open.
 *
 * The cursor starts at -1 — "nothing focused" — so the first keypress selects
 * the first row instead of silently re-opening whatever index 0 happens to
 * be. It clamps rather than wraps: wrapping from the last row to the first
 * reads as a jump when the list is long.
 */
export function useListKeyboard({
  count,
  onOpen,
  enabled = true,
}: {
  count: number
  onOpen: (index: number) => void
  enabled?: boolean
}): ListKeyboard {
  const [rawIndex, setActiveIndex] = useState(-1)
  /**
   * A shrinking list must not strand the cursor past the end. Derived rather
   * than corrected in an effect: there is no render where an out-of-range
   * index is observable, and no setState-in-effect round trip. `count - 1`
   * collapses to -1 ("nothing focused") when the list empties.
   */
  const activeIndex = Math.min(rawIndex, count - 1)
  // Latest-value refs so the key handler never re-binds on every render.
  // Written in an effect, NOT during render: a render-phase ref write is
  // unsafe under concurrent rendering, and a keydown can only arrive after
  // commit anyway, so the handler always sees current values.
  const openRef = useRef(onOpen)
  const countRef = useRef(count)
  const indexRef = useRef(activeIndex)
  useEffect(() => {
    openRef.current = onOpen
    countRef.current = count
    indexRef.current = activeIndex
  })

  const activeRowRef = useCallback((node: HTMLElement | null) => {
    // `nearest` scrolls only when the row is actually out of view, so an
    // already-visible row does not jolt the column.
    node?.scrollIntoView({ block: 'nearest' })
  }, [])

  useEffect(() => {
    if (!enabled) return
    function onKeyDown(event: KeyboardEvent) {
      // ⌘K and friends belong to other handlers; never steal a chord.
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) return
      const total = countRef.current
      if (total === 0) return
      const current = indexRef.current

      // No `current < 0 ? 0 : …` special case is needed for the first press:
      // from -1 the clamps already land on 0 (min(0, total-1) and
      // max(-2, 0)). Both directions are covered by tests.
      if (NEXT_KEYS.has(event.key)) {
        event.preventDefault()
        setActiveIndex(Math.min(current + 1, total - 1))
        return
      }
      if (PREVIOUS_KEYS.has(event.key)) {
        event.preventDefault()
        setActiveIndex(Math.max(current - 1, 0))
        return
      }
      if (event.key === 'Enter' && current >= 0 && !ownsEnter(event.target)) {
        event.preventDefault()
        openRef.current(current)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [enabled])

  return { activeIndex, setActiveIndex, activeRowRef }
}
