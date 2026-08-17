/**
 * The workspace surface/selection contract.
 *
 * A "surface" is the first path segment inside the (app) group — /messages,
 * /my-gigs, /wallet. Everything deeper identifies WHICH row of that surface is
 * open, and that is the "selection".
 *
 *   /messages              surface=messages  selection=none
 *   /messages/abc-123      surface=messages  selection=abc-123
 *   /settings/security     surface=settings  selection=security
 *
 * Two things read this contract:
 *   - the detail pane, for its accessible name and its focus hand-off (a
 *     changed selection moves focus, which is what makes the ≤900px
 *     single-pane collapse usable);
 *   - the @list parallel-route slot, which supplies a surface's list column.
 *     Adding a list to a surface is `app/(app)/@list/<surface>/page.tsx` and
 *     nothing else — no layout edit, no registration here.
 */

/** Human name per surface, used as the detail pane's accessible name. */
const SURFACE_TITLES: Record<string, string> = {
  home: 'Home',
  'my-gigs': 'My Gigs',
  messages: 'Messages',
  chat: 'Conversation',
  notifications: 'Notifications',
  wallet: 'Wallet',
  exchange: 'Trade',
  gig: 'Gig',
  disputes: 'Disputes',
  dispute: 'Dispute',
  profile: 'Profile',
  settings: 'Settings',
}

/**
 * Where the ≤900px "back" affordance goes, per surface that HAS a list column.
 *
 * Not derivable from the URL: a chat thread lives at /chat/<userId> but its
 * list is the inbox at /messages, so `/${surface}` would send the reader to a
 * route that does not exist. A surface absent from this map has no list, and
 * the detail pane renders no back link at all — there is nothing behind it.
 */
export interface ListHome {
  href: string
  /** Names the list, not the direction — "Back" alone says nothing on arrival. */
  label: string
}

const SURFACE_LIST_HOME: Record<string, ListHome> = {
  messages: { href: '/messages', label: 'All messages' },
  chat: { href: '/messages', label: 'All messages' },
  disputes: { href: '/disputes', label: 'All disputes' },
  dispute: { href: '/disputes', label: 'All disputes' },
  'my-gigs': { href: '/my-gigs', label: 'All my gigs' },
  notifications: { href: '/notifications', label: 'All notifications' },
}

/** The list behind this surface's detail pane, or null when it has none. */
export function listHomeFor(segment: string | null): ListHome | null {
  if (segment === null) return null
  return SURFACE_LIST_HOME[segment] ?? null
}

/** Fallback so an unregistered surface still gets a usable region name. */
export const DEFAULT_SURFACE_TITLE = 'Workspace'

export function surfaceTitle(segment: string | null): string {
  if (segment === null) return DEFAULT_SURFACE_TITLE
  return SURFACE_TITLES[segment] ?? DEFAULT_SURFACE_TITLE
}

/**
 * The open row's identity, or null when the surface itself is open with
 * nothing selected.
 *
 * Route groups appear in the segment list as "(name)" and parallel slots as
 * "@name"; neither is part of the URL, so neither can identify a selection.
 */
export function selectionKey(segments: readonly string[]): string | null {
  const real = segments.filter(
    (segment) => !segment.startsWith('(') && !segment.startsWith('@'),
  )
  // [0] is the surface; anything after it identifies the selection. Joined so
  // /my-gigs/<id>/applicants and /my-gigs/<id> are distinct selections.
  if (real.length < 2) return null
  return real.slice(1).join('/')
}
