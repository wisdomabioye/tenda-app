/**
 * The three schema builders behind the Agent API document. They are what
 * make "closed" and "nullable" mean one thing everywhere in src/agent-api —
 * a builder that quietly produced an open object, or a null-union that a
 * strict validator refuses to compile, would undo the drift guarantee at its
 * root.
 */
import { test } from 'node:test'
import assert from 'node:assert'
import { closed, nullable, ref } from '@server/agent-api/schema-types'
import { strictAjv } from '../helpers/agent-api-validator'

test('closed() admits exactly the documented keys, requires the listed ones, and carries the description', () => {
  const schema = closed({ a: { type: 'string' }, b: { type: 'integer' } }, ['a'], 'pair')
  assert.strictEqual(schema.additionalProperties, false)
  assert.strictEqual(schema.description, 'pair')
  const validate = strictAjv().compile(schema)
  assert.strictEqual(validate({ a: 'x' }), true)
  assert.strictEqual(validate({ a: 'x', b: 2 }), true)
  assert.strictEqual(validate({ b: 2 }), false, 'a required key is missing')
  assert.strictEqual(validate({ a: 'x', c: true }), false, 'an undocumented key is refused')
  // No description → no `description` key, so the emitted JSON has no `undefined`.
  assert.strictEqual('description' in closed({}, []), false)
})

test('nullable() adds null to a single type ONCE, and wraps type-less schemas in oneOf', () => {
  assert.deepStrictEqual(nullable({ type: 'string' }).type, ['string', 'null'])
  // Already nullable: returned as it is, never `['string', 'null', 'null']`.
  const already = nullable({ type: 'string' })
  assert.strictEqual(nullable(already), already)
  // A list without null gains it — the arm a single type never exercises.
  assert.deepStrictEqual(nullable({ type: ['integer'] }).type, ['integer', 'null'])
  const wrapped = nullable({ oneOf: [{ type: 'string' }] })
  assert.deepStrictEqual(wrapped, { oneOf: [{ oneOf: [{ type: 'string' }] }, { type: 'null' }] })
  const wrappedRef = nullable(ref('Thing'))
  assert.deepStrictEqual(wrappedRef, { oneOf: [{ $ref: '#/components/schemas/Thing' }, { type: 'null' }] })
})

test('every nullable() form compiles under a STRICT validator and accepts null', () => {
  // Strict ajv refuses every type list but `X | null` — including the
  // contradictory `type: ['null']` beside a oneOf from the document's first
  // draft, and a doubled `['string', 'null', 'null']`.
  const ajv = strictAjv()
  for (const schema of [
    nullable({ type: 'string' }),
    nullable(nullable({ type: 'string' })),
    nullable({ type: ['string'] }),
    nullable({ oneOf: [{ type: 'string' }, { type: 'number' }] }),
  ]) {
    const validate = ajv.compile(schema)
    assert.strictEqual(validate(null), true)
    assert.strictEqual(validate('x'), true)
    assert.strictEqual(validate(true), false)
  }
})

test('ref() spells the components prefix once', () => {
  assert.deepStrictEqual(ref('GigSummary'), { $ref: '#/components/schemas/GigSummary' })
})
