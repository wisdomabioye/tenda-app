/**
 * One operation's rendering, at the edges the whole-page test never reaches:
 * an operation with no parameters, one that needs a token, and — the point of
 * this redesign — a body under EVERY status it can answer with.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { OperationObject } from '@tenda/api-doc'
import { Operation } from '@/components/docs/Operation'
import { apiDocument } from '@/lib/document'

const schemas = apiDocument.components.schemas

const base: OperationObject = {
  operationId: 'sample',
  summary: 'A sample operation',
  description: 'What it **does**.',
  tags: ['gigs'],
  responses: {
    '200': { description: 'Fine', content: { 'application/json': { schema: { type: 'object', properties: { id: { type: 'string' } } } } } },
    '404': { description: 'No such gig (GIG_NOT_FOUND)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } } },
  },
}

describe('Operation', () => {
  it('shows the method, the path and where the reader is', () => {
    render(<Operation method="GET" path="/v1/sample" operation={base} schemas={schemas} />)
    expect(screen.getByText('GET')).toBeTruthy()
    expect(screen.getByText('/v1/sample')).toBeTruthy()
    expect(screen.getByRole('heading', { name: base.summary })).toBeTruthy()
  })

  it('says an operation is anonymous when it declares no security, and names the scheme when it does', () => {
    const anonymous = render(<Operation method="GET" path="/v1/sample" operation={base} schemas={schemas} />)
    expect(within(anonymous.container).getByText('Anonymous')).toBeTruthy()
    anonymous.unmount()

    render(<Operation method="POST" path="/v1/sample" operation={{ ...base, security: [{ bearer: [] }] }} schemas={schemas} />)
    expect(screen.getByText(/Bearer · bearer/)).toBeTruthy()
  })

  it('renders a body for EVERY status, labelled by where it came from', () => {
    const { container } = render(<Operation method="GET" path="/v1/sample" operation={base} schemas={schemas} />)
    expect(screen.getByText('200')).toBeTruthy()
    expect(screen.getByText('404')).toBeTruthy()
    // Two shaped bodies: neither status carries a recorded example here.
    expect(container.querySelectorAll('pre')).toHaveLength(2)
    expect(screen.getAllByText(/Shaped from the schema/i)).toHaveLength(2)
  })

  it('fills the error envelope from the document — status, reason and the code its prose names', () => {
    const { container } = render(<Operation method="GET" path="/v1/sample" operation={base} schemas={schemas} />)
    const bodies = [...container.querySelectorAll('pre')].map((pre) => pre.textContent ?? '')
    const error = bodies.find((text) => text.includes('statusCode')) ?? ''
    expect(error).toContain('"statusCode": 404')
    expect(error).toContain('"error": "Not Found"')
    expect(error).toContain('"code": "GIG_NOT_FOUND"')
  })

  it('renders a request body only when the document recorded one', () => {
    const without = render(<Operation method="GET" path="/v1/sample" operation={base} schemas={schemas} />)
    expect(within(without.container).queryByText('Request body')).toBeNull()
    without.unmount()

    const withBody: OperationObject = {
      ...base,
      requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' }, example: { title: 'Paint the fence' } } } },
    }
    render(<Operation method="POST" path="/v1/sample" operation={withBody} schemas={schemas} />)
    expect(screen.getByText('Request body')).toBeTruthy()
    expect(screen.getByText(/Paint the fence/)).toBeTruthy()
  })

  it('renders no Parameters section when there are none, and the required mark when there are', () => {
    const without = render(<Operation method="GET" path="/v1/sample" operation={base} schemas={schemas} />)
    expect(within(without.container).queryByText('Parameters')).toBeNull()
    without.unmount()

    render(
      <Operation
        method="GET"
        path="/v1/sample"
        operation={{
          ...base,
          parameters: [{ name: 'cursor', in: 'query', required: true, description: 'Where to resume', schema: { type: 'string' } }],
        }}
        schemas={schemas}
      />,
    )
    expect(screen.getByText('Parameters')).toBeTruthy()
    expect(screen.getByText(/query · required/)).toBeTruthy()
    expect(screen.getByText('Where to resume')).toBeTruthy()
  })
})
