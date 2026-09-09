/**
 * A body long enough to bury the page opens collapsed.
 *
 * The recorded 402 is the sample that matters most and the one that runs
 * longest; shown whole it pushes every other response off the screen. What is
 * tested is the behaviour, not the height: the control appears only when there
 * is something to expand, it says how much, and it opens.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CodeBlock, COLLAPSE_OVER_LINES } from '@/components/ui/CodeBlock'

/** An object whose pretty-printed form is `fields + 2` lines long. */
const body = (fields: number) => Object.fromEntries(Array.from({ length: fields }, (_, i) => [`field_${i}`, i]))

/**
 * Sizes stated OUTRIGHT rather than derived from COLLAPSE_OVER_LINES. Sized
 * from the constant, these cases scale with it: the threshold could be raised
 * to nine thousand and every one of them would still pass, which is a suite
 * that cannot see the limit it exists to guard.
 */
const SHORT = 3
const LONG = 30

describe('CodeBlock', () => {
  it('shows a short body whole, with no control to press', () => {
    render(<CodeBlock value={body(SHORT)} label="Recorded" />)
    expect(screen.getByText(/field_0/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('cuts in between the two sizes the other cases use', () => {
    // The threshold is the whole behaviour; without this the suite passes at
    // any value of it. SHORT must sit under it and LONG over it.
    expect(SHORT + 2).toBeLessThanOrEqual(COLLAPSE_OVER_LINES)
    expect(LONG + 2).toBeGreaterThan(COLLAPSE_OVER_LINES)
  })

  it('collapses a long one and says how much is hidden', async () => {
    render(<CodeBlock value={body(LONG)} label="Recorded" />)
    const button = screen.getByRole('button')
    expect(button.textContent).toMatch(/Show all \d+ lines/)

    await userEvent.click(button)
    expect(screen.getByRole('button').textContent).toBe('Collapse')

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toMatch(/Show all/)
  })

  it('still offers the control on a long body with no label', async () => {
    // The bar used to render only for a labelled block, so an unlabelled long
    // body was collapsed with no way to open it — permanently truncated.
    render(<CodeBlock value={body(LONG)} />)
    const button = screen.getByRole('button')
    expect(button.textContent).toMatch(/Show all \d+ lines/)

    await userEvent.click(button)
    expect(screen.getByRole('button').textContent).toBe('Collapse')
  })

  it('draws no bar at all when there is neither a label nor anything to expand', () => {
    const { container } = render(<CodeBlock value={body(SHORT)} />)
    expect(screen.queryByRole('button')).toBeNull()
    // One child: the <pre>. A bar would be a second.
    expect(container.firstElementChild?.children.length).toBe(1)
  })
})
