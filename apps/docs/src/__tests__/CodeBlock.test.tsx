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

/** An object whose pretty-printed form is `lines` long, near enough. */
const body = (fields: number) => Object.fromEntries(Array.from({ length: fields }, (_, i) => [`field_${i}`, i]))

describe('CodeBlock', () => {
  it('shows a short body whole, with no control to press', () => {
    render(<CodeBlock value={body(3)} label="Recorded" />)
    expect(screen.getByText(/field_0/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('collapses a long one and says how much is hidden', async () => {
    render(<CodeBlock value={body(COLLAPSE_OVER_LINES + 20)} label="Recorded" />)
    const button = screen.getByRole('button')
    expect(button.textContent).toMatch(/Show all \d+ lines/)

    await userEvent.click(button)
    expect(screen.getByRole('button').textContent).toBe('Collapse')

    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button').textContent).toMatch(/Show all/)
  })

  it('offers no control without a label — there is no bar to put one on', () => {
    render(<CodeBlock value={body(COLLAPSE_OVER_LINES + 20)} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
