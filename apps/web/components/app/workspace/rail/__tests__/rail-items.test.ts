import { describe, expect, it } from 'vitest'
import {
  RAIL_ACTION,
  RAIL_ITEMS,
  isRailItemActive,
  visibleRailItems,
} from '@/components/app/workspace/rail'

describe('isRailItemActive', () => {
  it.each([
    ['/home', '/home'],
    ['/my-gigs', '/my-gigs'],
    ['/my-gigs/drafts', '/my-gigs'],
    ['/messages/abc-123', '/messages'],
    ['/settings/linked-wallets', '/settings'],
  ])('treats %s as active for %s', (pathname, href) => {
    expect(isRailItemActive(pathname, href)).toBe(true)
  })

  it.each([
    ['/', '/gig'],
    ['/my-gigs-archive', '/my-gigs'],
    ['/walletsomething', '/wallet'],
    ['/homepage', '/home'],
  ])('does NOT treat %s as active for %s (prefix is not a segment)', (pathname, href) => {
    // A plain startsWith would light the wrong item up for every one of these.
    expect(isRailItemActive(pathname, href)).toBe(false)
  })

  it('does not match an unrelated path', () => {
    expect(isRailItemActive('/wallet', '/messages')).toBe(false)
  })

  it('matches nothing when the pathname is the bare root', () => {
    for (const item of RAIL_ITEMS) expect(isRailItemActive('/', item.href)).toBe(false)
  })
})

describe('visibleRailItems', () => {
  it('hides the advanced-mode surface by default', () => {
    const hrefs = visibleRailItems(false).map((i) => i.href)
    expect(hrefs).not.toContain('/exchange')
  })

  it('shows the advanced-mode surface once enabled', () => {
    const hrefs = visibleRailItems(true).map((i) => i.href)
    expect(hrefs).toContain('/exchange')
  })

  it('gates exactly one item — everything else is always visible', () => {
    expect(visibleRailItems(true)).toHaveLength(visibleRailItems(false).length + 1)
  })
})

describe('rail item config', () => {
  it('preserves every destination the previous top-nav shell could reach', () => {
    // Regression net for the shell swap: Create moved to the rail action and
    // the bell became the Notifications item, but nothing may be dropped.
    const reachable = new Set([...visibleRailItems(true).map((i) => i.href), RAIL_ACTION.href])
    for (const href of ['/home', '/create', '/my-gigs', '/messages', '/wallet', '/exchange', '/notifications']) {
      expect(reachable, `${href} is no longer reachable from the rail`).toContain(href)
    }
  })

  it('gives every item a non-empty label — the rail is icon-only', () => {
    for (const item of RAIL_ITEMS) expect(item.label.trim().length).toBeGreaterThan(0)
  })

  it('has no duplicate hrefs', () => {
    const hrefs = RAIL_ITEMS.map((i) => i.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('only declares badge sources the Rail can resolve', () => {
    for (const item of RAIL_ITEMS) {
      if (item.badge !== undefined) expect(['messages', 'notifications']).toContain(item.badge)
    }
  })
})
