import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// The rail reads pathname to mark the active item; each case needs its own.
const pathnameRef = { current: '/home' }
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  usePathname: () => pathnameRef.current,
}))

import { Rail } from '@/components/app/workspace/rail'
import { useChatStore } from '@/stores/chat.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { makeUser } from '../../../../../test/factories/user'

const at = (pathname: string) => {
  pathnameRef.current = pathname
}

beforeEach(() => {
  at('/home')
  window.localStorage.clear()
  useChatStore.setState({ unread: 0 })
  useNotificationsStore.setState({ unread: 0 })
})

describe('Rail — navigation', () => {
  it('renders every non-gated destination with an accessible name', () => {
    render(<Rail user={makeUser()} />)
    for (const label of ['Home', 'My Gigs', 'Messages', 'Notifications', 'Wallet']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'Create' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })

  it('is labelled as the workspace navigation landmark', () => {
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument()
  })

  it('marks only the current surface with aria-current', () => {
    at('/messages')
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: 'Messages' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current')
  })

  it('keeps the parent surface current on a child route', () => {
    at('/my-gigs/drafts')
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: 'My Gigs' })).toHaveAttribute('aria-current', 'page')
  })

  it('does not mark a surface current for a same-prefix sibling path', () => {
    at('/my-gigs-archive')
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: 'My Gigs' })).not.toHaveAttribute('aria-current')
  })

  it('opens a menu with both explicit creation routes', async () => {
    render(<Rail user={makeUser()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create' }))
    const createGig = screen.getByRole('menuitem', { name: 'Create gig' })
    expect(createGig).toHaveAttribute('href', '/gigs/new')
    expect(createGig).toHaveFocus()
    expect(screen.getByRole('menuitem', { name: 'Create offer' })).toHaveAttribute('href', '/offers/new')
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toHaveFocus()
  })

  it('marks the profile avatar current on the profile surface', () => {
    at('/profile/edit')
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: /Your profile/ })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('leaves the avatar unmarked elsewhere', () => {
    at('/wallet')
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: /Your profile/ })).not.toHaveAttribute('aria-current')
  })

  it('toggles the sidebar and persists the preference', async () => {
    render(<Rail user={makeUser()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }))
    expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toHaveAttribute('aria-expanded', 'true')
    expect(window.localStorage.getItem('tenda_workspace_rail_expanded')).toBe('true')
    expect(screen.getByText('My Gigs')).toBeVisible()
  })

  it('names the avatar link with the signed-in user', () => {
    render(<Rail user={makeUser({ first_name: 'Faridah', last_name: 'Ab' })} />)
    expect(screen.getByRole('link', { name: /Your profile, Faridah/ })).toBeInTheDocument()
  })

  it('falls back to a bare profile label when there is no user', () => {
    render(<Rail user={null} />)
    expect(screen.getByRole('link', { name: 'Your profile' })).toBeInTheDocument()
  })
})

describe('Rail — advanced-mode gating', () => {
  it('hides Trade when advanced mode is off', () => {
    render(<Rail user={makeUser({ advanced_mode_enabled: false })} />)
    expect(screen.queryByRole('link', { name: 'Trade' })).not.toBeInTheDocument()
  })

  it('shows Trade when advanced mode is on', () => {
    render(<Rail user={makeUser({ advanced_mode_enabled: true })} />)
    expect(screen.getByRole('link', { name: 'Trade' })).toHaveAttribute('href', '/exchange')
  })

  it('hides Trade for a null user rather than crashing', () => {
    render(<Rail user={null} />)
    expect(screen.queryByRole('link', { name: 'Trade' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
  })
})

describe('Rail — unread badges', () => {
  it('renders no badge at zero unread', () => {
    render(<Rail user={makeUser()} />)
    const link = screen.getByRole('link', { name: 'Messages' })
    // The pip is aria-hidden, so an accessible-name check alone would pass
    // even while a literal "0" was painted on the rail. Assert the rendered
    // text too — at zero the slot holds nothing but the icon.
    expect(link.textContent).toBe('')
    expect(screen.queryByRole('link', { name: /Messages, .* unread/ })).not.toBeInTheDocument()
  })

  it('renders no badge for a negative count', () => {
    useChatStore.setState({ unread: -1 })
    render(<Rail user={makeUser()} />)
    const link = screen.getByRole('link', { name: 'Messages' })
    expect(link.textContent).toBe('')
  })

  it('puts the count in the accessible name, not only the pip', () => {
    useChatStore.setState({ unread: 3 })
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: 'Messages, 3 unread' })).toBeInTheDocument()
  })

  it('clamps the visible pip at 9+ while keeping the true count announced', () => {
    useChatStore.setState({ unread: 42 })
    render(<Rail user={makeUser()} />)
    const link = screen.getByRole('link', { name: 'Messages, 42 unread' })
    expect(link).toHaveTextContent('9+')
    expect(link).not.toHaveTextContent('42')
  })

  it('routes each counter to its own item', () => {
    useChatStore.setState({ unread: 2 })
    useNotificationsStore.setState({ unread: 7 })
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: 'Messages, 2 unread' })).toHaveTextContent('2')
    expect(screen.getByRole('link', { name: 'Notifications, 7 unread' })).toHaveTextContent('7')
  })

  it('does not badge an item that declares no counter', () => {
    useChatStore.setState({ unread: 5 })
    useNotificationsStore.setState({ unread: 5 })
    render(<Rail user={makeUser()} />)
    expect(screen.getByRole('link', { name: 'Wallet' })).not.toHaveTextContent('5')
  })
})
