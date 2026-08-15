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
