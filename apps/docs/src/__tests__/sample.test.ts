/**
 * Every response code gets a body, and neither kind of body lies about itself.
 *
 * The failures worth catching: a status the document answers with that the
 * reason-phrase register has never heard of (the sample then says `undefined`
 * where the wire says "Conflict"), a recorded example quietly replaced by a
 * shaped one, and a schema that nests into itself taking the renderer with it.
 */
import { describe, expect, it } from 'vitest'
import type { SchemaObject } from '@tenda/api-doc'
import { apiDocument } from '@/lib/document'
import { codeNamedIn, errorCodesIn, REASON_PHRASE, sampleForResponse } from '@/lib/sample'

const schemas = apiDocument.components.schemas

/** Every (status, response) pair the document declares. */
const responses = Object.values(apiDocument.paths).flatMap((item) =>
  [item.get, item.post]
    .filter((operation) => operation !== undefined)
    .flatMap((operation) => Object.entries(operation.responses)),
)

describe('the reason-phrase register', () => {
  it('covers every status this document answers with', () => {
    const missing = [...new Set(responses.map(([status]) => status))].filter(
      (status) => !Object.hasOwn(REASON_PHRASE, status),
    )
    expect(responses.length).toBeGreaterThan(10)
    expect(missing, 'a status with no reason phrase renders `undefined` as the error').toEqual([])
  })
})

describe('sampleForResponse', () => {
  it('gives every documented response a body, and says where it came from', () => {
    for (const [status, response] of responses) {
      const sample = sampleForResponse(status, response, schemas)
      expect(sample, `${status} has no sample`).not.toBeNull()
      expect(['recorded', 'derived']).toContain(sample?.source)
    }
  })

  it('passes a recorded example through untouched', () => {
    const created = apiDocument.paths['/v1/agent/tasks'].post?.responses['201']
    expect(created).toBeDefined()
    const sample = sampleForResponse('201', created!, schemas)
    expect(sample?.source).toBe('recorded')
    expect(sample?.value).toEqual(created!.content?.['application/json'].example)
  })

  it('fills an error envelope from the document, not from the schema’s placeholders', () => {
    const conflict = apiDocument.paths['/v1/agent/tasks'].post?.responses['409']
    expect(conflict).toBeDefined()
    const sample = sampleForResponse('409', conflict!, schemas)
    expect(sample?.source).toBe('derived')
    expect(sample?.value).toMatchObject({
      statusCode: 409,
      error: 'Conflict',
      message: conflict!.description,
    })
  })

  it('answers null when a response declares no body', () => {
    expect(sampleForResponse('204', { description: 'No content' }, schemas)).toBeNull()
  })
})

describe('shaping a schema', () => {
  const book = (extra: Record<string, SchemaObject> = {}) => ({ ...schemas, ...extra })

  it('prefers const, then enum, then default for a constrained leaf', () => {
    const schema: SchemaObject = {
      type: 'object',
      properties: {
        fixed: { type: 'string', const: 'only' },
        choice: { type: 'string', enum: ['first', 'second'] },
        fallback: { type: 'string', default: 'unset' },
      },
    }
    const sample = sampleForResponse('200', { description: 'x', content: { 'application/json': { schema } } }, book())
    expect(sample?.value).toEqual({ fixed: 'only', choice: 'first', fallback: 'unset' })
  })

  it('names the field in its placeholder, so a reader sees which value goes where', () => {
    const schema: SchemaObject = { type: 'object', properties: { escrow_id: { type: 'string' } } }
    const sample = sampleForResponse('200', { description: 'x', content: { 'application/json': { schema } } }, book())
    expect(sample?.value).toEqual({ escrow_id: '<escrow_id>' })
  })

  it('shows one array item, not an empty list', () => {
    const schema: SchemaObject = { type: 'array', items: { type: 'object', properties: { id: { type: 'string' } } } }
    const sample = sampleForResponse('200', { description: 'x', content: { 'application/json': { schema } } }, book())
    expect(sample?.value).toEqual([{ id: '<id>' }])
  })

  it('takes the non-null branch of a nullable field — null shows a reader nothing', () => {
    const schema: SchemaObject = {
      type: 'object',
      properties: { city: { oneOf: [{ type: 'string' }, { type: 'null' }] } },
    }
    const sample = sampleForResponse('200', { description: 'x', content: { 'application/json': { schema } } }, book())
    expect(sample?.value).toEqual({ city: '<city>' })
  })

  it('stops at a cycle instead of recursing forever', () => {
    // A real component name made self-referential: `$ref` is typed as the
    // union of the names this document declares, so an invented one would not
    // compile — which is the type system doing its job, not an obstacle.
    const extra: Record<string, SchemaObject> = {
      AuthNonce: { type: 'object', properties: { child: { $ref: '#/components/schemas/AuthNonce' } } },
    }
    const schema: SchemaObject = { $ref: '#/components/schemas/AuthNonce' }
    const sample = sampleForResponse('200', { description: 'x', content: { 'application/json': { schema } } }, book(extra))
    expect(sample?.value).toEqual({ child: '<AuthNonce>' })
  })
})

describe('codeNamedIn', () => {
  const codes = errorCodesIn(schemas)

  it('reads the codes from the schema that declares them', () => {
    expect(codes.length).toBeGreaterThan(20)
    expect(codes).toContain('GIG_NOT_FOUND')
  })

  it('finds the code a description names', () => {
    expect(codeNamedIn('the nonce is unknown (AUTH_NONCE_UNKNOWN) or expired', codes)).toBe('AUTH_NONCE_UNKNOWN')
  })

  it('ignores a SHOUTING word that is not a code — a header, a standard', () => {
    // The task operation's prose names X_PAYMENT and EIP_3009; neither is an
    // error the API can send, and a sample claiming one would be a lie.
    expect(codeNamedIn('resend with X_PAYMENT signed per EIP_3009', codes)).toBeNull()
  })

  it('answers null for prose that names none — no invented code', () => {
    expect(codeNamedIn('The same refusals as the feed', codes)).toBeNull()
  })
})

describe('depth', () => {
  it('stops describing rather than nesting forever', () => {
    // Six levels is enough to show a shape and short enough to read; past it
    // the sample names the field instead of unfolding another object.
    const deep = (level: number): SchemaObject =>
      level === 0 ? { type: 'string' } : { type: 'object', properties: { down: deep(level - 1) } }
    const sample = sampleForResponse(
      '200',
      { description: 'x', content: { 'application/json': { schema: deep(9) } } },
      schemas,
    )
    expect(JSON.stringify(sample?.value)).toContain('<down>')
  })
})
