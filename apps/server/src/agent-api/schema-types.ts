/**
 * The subset of JSON Schema (draft 2020-12, as OpenAPI 3.1 embeds it) the
 * Agent API document uses — typed so the document is checked at compile time
 * instead of being an untyped blob. Deliberately small: every keyword here is
 * one the drift test validates with, so nothing in the spec is decoration.
 */

type JsonPrimitive = string | number | boolean | null

/** A JSON Schema type name, or a list of them (`['string', 'null']`). */
type SchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'

export interface SchemaObject {
  $ref?: string
  type?: SchemaType | readonly SchemaType[]
  description?: string
  /** Documentary only — the drift test does not validate formats. */
  format?: string
  pattern?: string
  enum?: readonly JsonPrimitive[]
  const?: JsonPrimitive
  minimum?: number
  /** Numeric, per draft 2020-12 (the boolean form is draft-4 and strict ajv refuses it). */
  exclusiveMinimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  properties?: Readonly<Record<string, SchemaObject>>
  required?: readonly string[]
  additionalProperties?: boolean | SchemaObject
  items?: SchemaObject
  maxItems?: number
  oneOf?: readonly SchemaObject[]
}

/** `{ $ref: '#/components/schemas/<name>' }` — the one place the prefix is spelled. */
export function ref(name: string): SchemaObject {
  return { $ref: `#/components/schemas/${name}` }
}

/** A closed object: every documented field listed, nothing else admitted. */
export function closed(
  properties: Readonly<Record<string, SchemaObject>>,
  required: readonly string[],
  description?: string,
): SchemaObject {
  return {
    type: 'object',
    ...(description !== undefined ? { description } : {}),
    properties,
    required,
    additionalProperties: false,
  }
}

/**
 * `schema | null`. A schema with its own `type` gains 'null' in that list
 * (once — an already-nullable list is returned as it is); one without (a
 * `$ref`, a `oneOf`) is wrapped instead — `type: ['null']` beside a `oneOf`
 * would contradict every branch, and strict ajv refuses to compile it.
 *
 * Strict validators admit no other type list than `X | null`, so a list that
 * is not already nullable is the caller's own violation, not one made here.
 */
export function nullable(schema: SchemaObject): SchemaObject {
  if (schema.type === undefined) return { oneOf: [schema, { type: 'null' }] }
  if (typeof schema.type === 'string') return { ...schema, type: [schema.type, 'null'] }
  return schema.type.includes('null') ? schema : { ...schema, type: [...schema.type, 'null'] }
}
