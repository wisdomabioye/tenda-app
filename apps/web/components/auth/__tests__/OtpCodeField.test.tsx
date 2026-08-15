import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OtpCodeField } from '@/components/auth/OtpCodeField'

function Harness({ onChange }: { onChange: (digits: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <OtpCodeField
      value={value}
      onChange={(digits) => {
        setValue(digits)
        onChange(digits)
      }}
    />
  )
}

describe('OtpCodeField', () => {
  it('accepts digits up to the length', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Verification code'), '123456')
    expect(onChange).toHaveBeenLastCalledWith('123456')
  })

  it('filters non-digits instead of passing them through', async () => {
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('Verification code'), '12ab34')
    expect(onChange).toHaveBeenLastCalledWith('1234')
  })

  it('is announced and autofill-ready', () => {
    render(<Harness onChange={vi.fn()} />)
    const input = screen.getByLabelText('Verification code')
    expect(input).toHaveAttribute('autocomplete', 'one-time-code')
    expect(input).toHaveAttribute('inputmode', 'numeric')
  })

  it('respects disabled', () => {
    render(<OtpCodeField value="" onChange={vi.fn()} disabled />)
    expect(screen.getByLabelText('Verification code')).toBeDisabled()
  })
})
