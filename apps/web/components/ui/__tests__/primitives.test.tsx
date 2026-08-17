import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Button, buttonVariants, FormError, TextField } from '@/components/ui'
import { cn } from '@/lib/cn'

describe('Button', () => {
  it('defaults to type=button so it can never submit a form by accident', () => {
    render(<Button>Go</Button>)
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button')
  })

  it('honours an explicit submit type and disabled state', async () => {
    const onClick = vi.fn()
    render(
      <Button type="submit" disabled onClick={onClick}>
        Save
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'submit')
    expect(button).toBeDisabled()
    await userEvent.click(button).catch(() => {})
    expect(onClick).not.toHaveBeenCalled()
  })

  it('buttonVariants produces distinct classes per variant for link styling', () => {
    expect(buttonVariants({ variant: 'primary' })).not.toBe(buttonVariants({ variant: 'outline' }))
    expect(buttonVariants({ variant: 'ghost' })).toContain('text-content-secondary')
  })
})

describe('TextField', () => {
  it('associates the label and shows a field error only when present', () => {
    const { rerender } = render(<TextField label="Email" value="" onChange={() => {}} error={null} />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument()
    rerender(<TextField label="Email" value="" onChange={() => {}} error="Enter a valid email address" />)
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
  })

  it('sets the label the way the comps do — the shared Eyebrow, not its own type', () => {
    // 13 of the 14 labels across the six comps are mono/uppercase/0.13em, and
    // `Eyebrow` has carried `as`/`htmlFor` since it shipped without a single
    // form using it. Class presence only; the computed treatment is asserted
    // in e2e, where a real browser resolves the font.
    render(<TextField label="First name" value="" onChange={() => {}} />)
    const label = screen.getByText('First name')
    expect(label.className).toContain('uppercase')
    expect(label.className).toContain('tracking-[0.13em]')
    // Not the comps' `content-tertiary`: 5.12:1 against the page where the
    // generated label token is 7.19:1, and this one is read while typing.
    expect(label.className).toContain('text-control-input-label')
  })

  it('sets the input at 16px, the size iOS Safari does not zoom', () => {
    // Below 16px, Safari zooms the viewport on focus and does not zoom back —
    // on the sign-in step that is the page jumping under someone's email.
    render(<TextField label="Email" value="" onChange={() => {}} />)
    expect(screen.getByLabelText('Email').className).toContain('text-base')
  })
})

describe('FormError', () => {
  it('renders nothing for null and the message otherwise', () => {
    const { rerender, container } = render(<FormError message={null} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<FormError message="boom" />)
    expect(screen.getByText('boom')).toBeInTheDocument()
  })
})

describe('cn', () => {
  it('merges conflicting tailwind classes with last-wins semantics', () => {
    expect(cn('px-4 py-3', 'py-2')).toBe('px-4 py-2')
  })
})
