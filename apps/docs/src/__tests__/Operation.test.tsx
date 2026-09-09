/**
 * One operation's rendering, at the edges the page as a whole never reaches:
 * a method the document does not use today, and an operation with no
 * parameters. Both are shapes the document is allowed to contain, and both
 * would first be seen by a reader rather than by a test.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OperationObject } from '@tenda/api-doc'
import { Operation } from '@/components/Operation'

const base: OperationObject = {
  operationId: 'sample',
  summary: 'A sample operation',
  description: 'What it **does**.',
  tags: ['gigs'],
  responses: { '200': { description: 'Fine' } },
}

describe('Operation', () => {
  it('renders a method the document does not use today without losing the row', () => {
    // METHOD_TONE has no entry for it; the tone falls back and the method must
    // still be legible — a blank badge is how an unstyled method disappears.
    render(<Operation method="PATCH" path="/v1/sample" operation={base} />)
    expect(screen.getByText('PATCH')).toBeTruthy()
    expect(screen.getByText('/v1/sample')).toBeTruthy()
  })

  it('says an operation is anonymous when it declares no security', () => {
    render(<Operation method="GET" path="/v1/sample" operation={base} />)
    expect(screen.getByText('Anonymous')).toBeTruthy()
  })

  it('names the scheme when one is required', () => {
    render(
      <Operation
        method="POST"
        path="/v1/sample"
        operation={{ ...base, security: [{ bearer: [] }] }}
      />,
    )
    expect(screen.getByText(/Bearer \(bearer\)/)).toBeTruthy()
  })

  it('renders no Parameters section when there are none', () => {
    render(<Operation method="GET" path="/v1/sample" operation={base} />)
    expect(screen.queryByText('Parameters')).toBeNull()
    // …and one when there are, with the "required" mark the document carries.
    render(
      <Operation
        method="GET"
        path="/v1/sample"
        operation={{
          ...base,
          parameters: [{ name: 'cursor', in: 'query', required: true, description: 'Where to resume', schema: { type: 'string' } }],
        }}
      />,
    )
    expect(screen.getByText('Parameters')).toBeTruthy()
    expect(screen.getByText(/query · required/)).toBeTruthy()
    expect(screen.getByText('Where to resume')).toBeTruthy()
  })
})
