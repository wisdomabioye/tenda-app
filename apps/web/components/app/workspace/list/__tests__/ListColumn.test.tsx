import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// Aliased: this is the SETUP MOCK's accessor, not a hook call.
import { useRouter as routerMockAccessor } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ListColumn, LIST_ERROR_COPY, type ListGroup } from '@/components/app/workspace/list'

const router = vi.mocked(routerMockAccessor())

interface Row {
  id: string
  title: string
}

const COPY = { title: 'Messages', emptyTitle: 'No messages', emptyBody: 'Start a conversation.' }

const rows = (...ids: string[]): Row[] => ids.map((id) => ({ id, title: `Row ${id}` }))

const grouped = (...groups: Array<[string, string[]]>): ListGroup<Row>[] =>
  groups.map(([label, ids]) => ({ key: label, label, rows: rows(...ids) }))

function renderList(overrides: Partial<Parameters<typeof ListColumn<Row>>[0]> = {}) {
  return render(
    <ListColumn<Row>
      copy={COPY}
      groups={[{ key: 'all', rows: rows('a', 'b', 'c') }]}
      keyOf={(r) => r.id}
      hrefOf={(r) => `/messages/${r.id}`}
      renderRow={(r, { active }) => (
        <a href={`/messages/${r.id}`} data-active={active}>
          {r.title}
        </a>
      )}
      {...overrides}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ListColumn — async states are mutually exclusive', () => {
  it('shows only the skeleton while loading', () => {
    renderList({ isLoading: true })
    expect(screen.queryByText('Row a')).not.toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(COPY.emptyTitle)).not.toBeInTheDocument()
  })

  it('shows the error alert, not the rows, on failure', () => {
    renderList({ error: 'ESCROW_READ_FAILED' })
    const alert = screen.getByRole('alert')
    expect(within(alert).getByText(LIST_ERROR_COPY.title)).toBeInTheDocument()
    expect(within(alert).getByText(LIST_ERROR_COPY.body)).toBeInTheDocument()
    expect(within(alert).getByText('ESCROW_READ_FAILED')).toBeInTheDocument()
    expect(screen.queryByText('Row a')).not.toBeInTheDocument()
  })

  it('prefers the skeleton over the error while a retry is in flight', () => {
    renderList({ isLoading: true, error: 'BOOM' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the surface-specific empty copy when there are no rows', () => {
    renderList({ groups: [] })
    expect(screen.getByText(COPY.emptyTitle)).toBeInTheDocument()
    expect(screen.getByText(COPY.emptyBody)).toBeInTheDocument()
  })

  it('treats groups that exist but hold no rows as empty', () => {
    renderList({ groups: [{ key: 'g', label: 'Today', rows: [] }] })
    expect(screen.getByText(COPY.emptyTitle)).toBeInTheDocument()
  })

  it('renders rows once loaded', () => {
    renderList()
    for (const t of ['Row a', 'Row b', 'Row c']) expect(screen.getByText(t)).toBeInTheDocument()
  })
})

describe('ListColumn — header', () => {
  it('names the region by its title', () => {
    renderList()
    expect(screen.getByRole('region', { name: COPY.title })).toBeInTheDocument()
  })

  it('carries the data-list hook the ≤900px pane collapse keys off', () => {
    // Without this attribute the single-pane breakpoint cannot hide the list,
    // and both panes stack on a narrow viewport.
    renderList()
    expect(screen.getByRole('region', { name: COPY.title })).toHaveAttribute('data-list')
  })

  it('renders tabs with counts and marks the current one', () => {
    renderList({
      tabs: [
        { href: '/a', label: 'Created', count: 4, current: true },
        { href: '/b', label: 'Working', count: 0 },
      ],
    })
    const created = screen.getByRole('link', { name: /Created/ })
    expect(created).toHaveAttribute('aria-current', 'page')
    expect(created).toHaveTextContent('4')
    expect(screen.getByRole('link', { name: /Working/ })).not.toHaveAttribute('aria-current')
  })

  it('renders a zero tab count rather than hiding it', () => {
    renderList({ tabs: [{ href: '/b', label: 'Working', count: 0 }] })
    expect(screen.getByRole('link', { name: /Working/ })).toHaveTextContent('0')
  })

  it('hides the palette button when no handler is given', () => {
    renderList()
    expect(screen.queryByRole('button', { name: 'Open command palette' })).not.toBeInTheDocument()
  })

  it('calls the palette handler when the affordance is used', async () => {
    const onOpenPalette = vi.fn()
    renderList({ onOpenPalette })
    await userEvent.click(screen.getByRole('button', { name: 'Open command palette' }))
    expect(onOpenPalette).toHaveBeenCalledOnce()
  })

  it('shows the count line only when provided', () => {
    const { unmount } = renderList({ countLabel: '12 open' })
    expect(screen.getByText('12 open')).toBeInTheDocument()
    unmount()
    renderList()
    expect(screen.queryByText('12 open')).not.toBeInTheDocument()
  })
})

describe('ListColumn — grouping', () => {
  it('renders group labels above their rows', () => {
    renderList({ groups: grouped(['Today', ['a']], ['Yesterday', ['b']]) })
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
  })

  it('renders an unlabelled group without a heading', () => {
    renderList({ groups: [{ key: 'flat', rows: rows('a') }] })
    expect(screen.getByText('Row a')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(1)
  })
})

describe('ListColumn — keyboard cursor', () => {
  it('starts with no row active, so the first press selects the first row', async () => {
    renderList()
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'false')
    await userEvent.keyboard('j')
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'true')
  })

  it('moves down with j and up with k across the whole flat run', async () => {
    renderList({ groups: grouped(['Today', ['a']], ['Yesterday', ['b', 'c']]) })
    await userEvent.keyboard('jj')
    // Crossed a group boundary — the cursor indexes rows, not groups.
    expect(screen.getByText('Row b')).toHaveAttribute('data-active', 'true')
    await userEvent.keyboard('k')
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'true')
  })

  it('clamps at the end instead of wrapping to the top', async () => {
    renderList()
    // 4 presses over 3 rows: clamping parks on the last row, wrapping lands
    // back on the first. Press counts that are a multiple of the row count
    // agree under both and prove nothing.
    await userEvent.keyboard('jjjj')
    expect(screen.getByText('Row c')).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'false')
  })

  it('clamps at the start instead of wrapping to the bottom', async () => {
    renderList()
    await userEvent.keyboard('jj') // → Row b
    await userEvent.keyboard('kkk') // one more k than there is room for
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('Row c')).toHaveAttribute('data-active', 'false')
  })

  it('opens the active row on Enter', async () => {
    renderList()
    await userEvent.keyboard('jj')
    await userEvent.keyboard('{Enter}')
    expect(router.push).toHaveBeenCalledWith('/messages/b')
  })

  it('ignores Enter while nothing is active', async () => {
    renderList()
    await userEvent.keyboard('{Enter}')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('does not steal keys while the user is typing in a field', async () => {
    renderList()
    render(<input aria-label="search" />)
    const input = screen.getByLabelText('search')
    await userEvent.click(input)
    await userEvent.type(input, 'jk')
    expect(input).toHaveValue('jk')
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'false')
  })

  it('does not hijack a modifier chord such as the palette shortcut', async () => {
    renderList()
    await userEvent.keyboard('{Meta>}k{/Meta}')
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'false')
  })

  it('is inert while loading', async () => {
    renderList({ isLoading: true })
    await userEvent.keyboard('j{Enter}')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('is inert on the error state', async () => {
    renderList({ error: 'BOOM' })
    await userEvent.keyboard('j{Enter}')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('pulls the cursor back in when the list shrinks under it', async () => {
    const props = {
      copy: COPY,
      keyOf: (r: Row) => r.id,
      hrefOf: (r: Row) => `/messages/${r.id}`,
      renderRow: (r: Row, { active }: { active: boolean }) => (
        <a href={`/messages/${r.id}`} data-active={active}>
          {r.title}
        </a>
      ),
    }
    const { rerender } = render(
      <ListColumn<Row> {...props} groups={[{ key: 'all', rows: rows('a', 'b', 'c') }]} />,
    )
    await userEvent.keyboard('jjj') // park on the last row
    expect(screen.getByText('Row c')).toHaveAttribute('data-active', 'true')

    // A refresh drops the list to one row; the cursor must not stay at 2.
    rerender(<ListColumn<Row> {...props} groups={[{ key: 'all', rows: rows('a') }]} />)
    expect(screen.getByText('Row a')).toHaveAttribute('data-active', 'true')

    await userEvent.keyboard('{Enter}')
    expect(router.push).toHaveBeenCalledWith('/messages/a')
  })

  it('drops the cursor entirely when the list empties', async () => {
    const props = {
      copy: COPY,
      keyOf: (r: Row) => r.id,
      hrefOf: (r: Row) => `/messages/${r.id}`,
      renderRow: (r: Row) => <a href={`/messages/${r.id}`}>{r.title}</a>,
    }
    const { rerender } = render(
      <ListColumn<Row> {...props} groups={[{ key: 'all', rows: rows('a', 'b') }]} />,
    )
    await userEvent.keyboard('jj')
    rerender(<ListColumn<Row> {...props} groups={[]} />)
    await userEvent.keyboard('{Enter}')
    expect(router.push).not.toHaveBeenCalled()
  })

  it('activates a row on hover so pointer and keyboard agree', async () => {
    renderList()
    await userEvent.hover(screen.getByText('Row b'))
    expect(screen.getByText('Row b')).toHaveAttribute('data-active', 'true')
    // …and Enter then opens the hovered row.
    await userEvent.keyboard('{Enter}')
    expect(router.push).toHaveBeenCalledWith('/messages/b')
  })
})
