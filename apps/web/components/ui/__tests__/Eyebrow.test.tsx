import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Eyebrow } from '@/components/ui'

describe('Eyebrow', () => {
  it('carries the comps\' letterforms: mono, uppercase, 0.13em tracking', () => {
    render(<Eyebrow>Locked in escrow</Eyebrow>)
    const el = screen.getByText('Locked in escrow')
    expect(el.className).toContain('font-numeric')
    expect(el.className).toContain('uppercase')
    expect(el.className).toContain('tracking-[0.13em]')
  })

  it('is a paragraph by default — a label is not automatically a heading', () => {
    render(<Eyebrow>Amount</Eyebrow>)
    expect(screen.getByText('Amount').tagName).toBe('P')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('publishes a heading only when asked to', () => {
    render(<Eyebrow as="h2">Terms</Eyebrow>)
    expect(screen.getByRole('heading', { level: 2, name: 'Terms' })).toBeInTheDocument()
  })

  it('labels a control when used as a label', () => {
    render(
      <>
        <Eyebrow as="label" htmlFor="sort">
          Sort
        </Eyebrow>
        <select id="sort" />
      </>,
    )
    expect(screen.getByLabelText('Sort')).toBeInTheDocument()
  })

  it('does not emit htmlFor on a non-label tag', () => {
    render(<Eyebrow>Plain</Eyebrow>)
    expect(screen.getByText('Plain')).not.toHaveAttribute('for')
  })

  it('tones without leaving the token palette', () => {
    render(<Eyebrow tone="warning">Closing</Eyebrow>)
    expect(screen.getByText('Closing').className).toContain('text-feedback-warning-text')
  })

  it('has a bolder small variant for labels that carry a figure', () => {
    render(<Eyebrow strong>4 unread</Eyebrow>)
    const el = screen.getByText('4 unread')
    expect(el.className).toContain('font-bold')
    expect(el.className).toContain('text-[11px]')
  })

  it('lets a caller override the colour — category tones are dynamic', () => {
    // twMerge must drop the default tone rather than emit both.
    render(<Eyebrow className="text-category-photo-base">Photo</Eyebrow>)
    const className = screen.getByText('Photo').className
    expect(className).toContain('text-category-photo-base')
    expect(className).not.toContain('text-content-tertiary')
  })
})
