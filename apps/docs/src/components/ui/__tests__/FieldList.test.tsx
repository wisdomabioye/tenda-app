/**
 * The list both the parameters and the response headers are drawn with.
 *
 * What is worth holding: that an OPTIONAL part of a field is absent when the
 * document does not supply it, and that a recorded value survives whatever
 * type the document recorded it as. A parameter example is usually a string —
 * the X-PAYMENT header's base64 — but nothing in the document's own types says
 * it must be, and a value rendered as `[object Object]` is worse than none.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FieldList } from '@/components/ui/FieldList'

describe('FieldList', () => {
  it('renders a field that is nothing but a name', () => {
    const { container } = render(<FieldList fields={[{ name: 'cursor' }]} />)
    expect(screen.getByText('cursor')).toBeTruthy()
    // No qualifier, no sentence, no value — one <dt> and no <dd>.
    expect(container.querySelectorAll('dd')).toHaveLength(0)
  })

  it('renders the qualifier, the sentence and the recorded value when it has them', () => {
    render(<FieldList fields={[{ name: 'x-payment', meta: 'header · required', description: 'The signed authorisation.', example: 'eyJhIjoxfQ==' }]} />)
    expect(screen.getByText('header · required')).toBeTruthy()
    expect(screen.getByText('The signed authorisation.')).toBeTruthy()
    expect(screen.getByText('eyJhIjoxfQ==')).toBeTruthy()
  })

  it('shows a non-string recorded value as JSON rather than as [object Object]', () => {
    render(<FieldList fields={[{ name: 'limit', example: 25 }, { name: 'filter', example: { remote: true } }]} />)
    expect(screen.getByText('25')).toBeTruthy()
    expect(screen.getByText('{"remote":true}')).toBeTruthy()
  })

  it('keeps two fields of the same name apart by where they live', () => {
    // `status` can be both a query key and a header. Keyed by name alone React
    // still RENDERS both — it only warns — so counting rows proves nothing;
    // the warning is the observable, and it means reconciliation is unsound.
    const warn = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const { container } = render(
      <FieldList fields={[{ name: 'status', meta: 'query' }, { name: 'status', meta: 'header' }]} />,
    )
    expect(container.querySelectorAll('dt')).toHaveLength(2)
    const duplicateKey = warn.mock.calls.flat().some((arg) => String(arg).includes('same key'))
    expect(duplicateKey, 'two rows share a React key — the list cannot reconcile').toBe(false)
    warn.mockRestore()
  })
})
