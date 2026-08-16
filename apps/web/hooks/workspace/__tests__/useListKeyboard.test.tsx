/**
 * Direct tests for the branches ListColumn cannot reach through its own
 * props — an empty list while the cursor is still enabled, a keydown whose
 * target is not an element, and contenteditable surfaces.
 */
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useListKeyboard } from '@/hooks/workspace/useListKeyboard'

function Harness({
  count,
  onOpen,
  enabled = true,
}: {
  count: number
  onOpen: (index: number) => void
  enabled?: boolean
}) {
  const { activeIndex } = useListKeyboard({ count, onOpen, enabled })
  return <output data-testid="cursor">{activeIndex}</output>
}

const cursor = () => screen.getByTestId('cursor').textContent

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useListKeyboard — empty list', () => {
  it('ignores movement keys when there is nothing to move through', async () => {
    const onOpen = vi.fn()
    render(<Harness count={0} onOpen={onOpen} />)
    await userEvent.keyboard('jjkk')
    // -1 is "nothing focused"; count-1 keeps it there for an empty list.
    expect(cursor()).toBe('-1')
    await userEvent.keyboard('{Enter}')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('does not leave a stale cursor behind for when the list refills', async () => {
    // Without the empty-list guard the raw index creeps to 0 while nothing is
    // on screen, and the first row silently becomes "active" the moment rows
    // arrive — a selection the reader never made.
    // Both directions: the down path self-clamps to -1 on an empty list, but
    // the up path's Math.max(-2, 0) lands on 0, so only `k` exposes this.
    const { rerender } = render(<Harness count={0} onOpen={vi.fn()} />)
    await userEvent.keyboard('jjjkkk')
    rerender(<Harness count={3} onOpen={vi.fn()} />)
    expect(cursor()).toBe('-1')
  })
})

describe('useListKeyboard — first press in each direction', () => {
  it('selects the first row when the list is opened with j', async () => {
    render(<Harness count={3} onOpen={vi.fn()} />)
    await userEvent.keyboard('j')
    expect(cursor()).toBe('0')
  })

  it('also selects the first row when the list is opened with k', async () => {
    // Without the `current < 0` guard on the up path this would clamp to 0
    // only by luck; assert the intent directly.
    render(<Harness count={3} onOpen={vi.fn()} />)
    await userEvent.keyboard('k')
    expect(cursor()).toBe('0')
  })

  it('accepts the arrow keys as aliases for j and k', async () => {
    render(<Harness count={3} onOpen={vi.fn()} />)
    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(cursor()).toBe('1')
    await userEvent.keyboard('{ArrowUp}')
    expect(cursor()).toBe('0')
  })
})

describe('useListKeyboard — event targets that are not elements', () => {
  it('still moves when the keydown target is the document itself', () => {
    render(<Harness count={3} onOpen={vi.fn()} />)
    // A synthetic event dispatched on document has a non-HTMLElement target;
    // the typing guard must treat that as "not typing", not throw. act() is
    // required because this update originates outside React's event system.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    })
    expect(cursor()).toBe('0')
  })
})

describe('useListKeyboard — Enter defers to whatever owns it', () => {
  it('opens the cursor row when Enter lands on nothing interactive', async () => {
    const onOpen = vi.fn()
    render(<Harness count={3} onOpen={onOpen} />)
    await userEvent.keyboard('j{Enter}')
    expect(onOpen).toHaveBeenCalledWith(0)
  })

  it('defers to a role-based control that is not a native button', async () => {
    // Rows are free to render a div with role="button"; the tag check alone
    // would miss it and hijack Enter.
    const onOpen = vi.fn()
    render(
      <>
        <Harness count={3} onOpen={onOpen} />
        <div role="button" tabIndex={0} data-testid="fake-button" />
      </>,
    )
    await userEvent.keyboard('j')
    screen.getByTestId('fake-button').focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('still opens when Enter arrives with a non-element target', () => {
    const onOpen = vi.fn()
    render(<Harness count={3} onOpen={onOpen} />)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', bubbles: true }))
    })
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
    expect(onOpen).toHaveBeenCalledWith(0)
  })
})

describe('useListKeyboard — contenteditable', () => {
  it('does not move the cursor while a contenteditable surface has focus', async () => {
    render(
      <>
        <Harness count={3} onOpen={vi.fn()} />
        <div contentEditable suppressContentEditableWarning data-testid="editor" tabIndex={0} />
      </>,
    )
    const editor = screen.getByTestId('editor')
    // jsdom does not derive isContentEditable from the attribute.
    Object.defineProperty(editor, 'isContentEditable', { value: true })
    editor.focus()
    await userEvent.keyboard('j')
    expect(cursor()).toBe('-1')
  })
})

describe('useListKeyboard — disabled', () => {
  it('binds no listener at all when disabled', async () => {
    const onOpen = vi.fn()
    render(<Harness count={3} onOpen={onOpen} enabled={false} />)
    await userEvent.keyboard('j{Enter}')
    expect(cursor()).toBe('-1')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('releases the listener on unmount', async () => {
    const onOpen = vi.fn()
    const { unmount } = render(<Harness count={3} onOpen={onOpen} />)
    await userEvent.keyboard('j')
    unmount()
    // Nothing left listening: a later keypress must not reach the handler.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(onOpen).not.toHaveBeenCalled()
  })
})
