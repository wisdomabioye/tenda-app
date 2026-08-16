import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { WorkspaceShell } from '@/components/app/workspace'
import { useChatStore } from '@/stores/chat.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { makeUser } from '../../../../test/factories/user'

const panes = () => document.querySelector('[data-panes]')

beforeEach(() => {
  useChatStore.setState({ unread: 0 })
  useNotificationsStore.setState({ unread: 0 })
})

describe('WorkspaceShell', () => {
  it('always renders the rail', () => {
    render(<WorkspaceShell user={makeUser()} />)
    expect(screen.getByRole('navigation', { name: 'Workspace' })).toBeInTheDocument()
  })

  it('renders both panes when given them', () => {
    render(
      <WorkspaceShell user={makeUser()} list={<p>the list</p>} detail={<p>the detail</p>} />,
    )
    expect(screen.getByText('the list')).toBeInTheDocument()
    expect(screen.getByText('the detail')).toBeInTheDocument()
  })

  describe('pane-collapse flags (the ≤900px CSS keys off these)', () => {
    it('marks nodetail when nothing is selected, so the list wins the single pane', () => {
      render(<WorkspaceShell user={makeUser()} list={<p>list</p>} />)
      expect(panes()).toHaveAttribute('data-nodetail')
    })

    it('drops nodetail once a detail is present, so the detail wins', () => {
      render(<WorkspaceShell user={makeUser()} list={<p>list</p>} detail={<p>detail</p>} />)
      expect(panes()).not.toHaveAttribute('data-nodetail')
    })

    it('treats an explicitly null detail as no detail', () => {
      render(<WorkspaceShell user={makeUser()} list={<p>list</p>} detail={null} />)
      expect(panes()).toHaveAttribute('data-nodetail')
    })

    it('marks nolist when the surface has no list column', () => {
      render(<WorkspaceShell user={makeUser()} detail={<p>detail</p>} />)
      expect(panes()).toHaveAttribute('data-nolist')
    })

    it('drops nolist once a list is present', () => {
      render(<WorkspaceShell user={makeUser()} list={<p>list</p>} />)
      expect(panes()).not.toHaveAttribute('data-nolist')
    })
  })
})
