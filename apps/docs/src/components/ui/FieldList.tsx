/**
 * A list of named things the document describes: an operation's parameters,
 * and the headers a response carries.
 *
 * One component for both because they are the same shape — a name, a
 * qualifier, the document's sentence about it, and sometimes a recorded value.
 * They were not always: parameters rendered their own `<dl>` and headers
 * rendered nothing at all, so `x-payment-response` — declared on the 201
 * precisely because reviewers could not confirm the receipt comes back — was
 * invisible on the page that exists to show the document.
 *
 * A recorded value is shown INLINE rather than in a CodeBlock: these are
 * single scalars, and a boxed, collapsible panel around one base64 string
 * would weigh more than the value it holds.
 */
import type { ExampleValue } from '@tenda/api-doc'

export interface Field {
  name: string
  /** Where it lives, and whether it is required — the qualifier beside the name. */
  meta?: string
  description?: string
  /** The value the document recorded for it, when it recorded one. */
  example?: ExampleValue
}

/** A scalar as the wire carries it; anything structured falls back to JSON. */
const shown = (value: ExampleValue): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

export function FieldList({ fields }: { fields: readonly Field[] }) {
  return (
    <dl className="grid gap-1.5">
      {fields.map((field) => (
        <div key={`${field.meta ?? ''}:${field.name}`} className="grid gap-0.5">
          <dt className="flex items-baseline gap-2">
            <code className="font-mono text-[12.5px]">{field.name}</code>
            {field.meta !== undefined && (
              <span className="text-[11px]" style={{ color: 'var(--content-tertiary)' }}>{field.meta}</span>
            )}
          </dt>
          {field.description !== undefined && (
            <dd className="m-0 text-[13px]" style={{ color: 'var(--content-secondary)' }}>{field.description}</dd>
          )}
          {field.example !== undefined && (
            <dd
              className="m-0 overflow-x-auto rounded-[var(--radius-xs)] px-2 py-1 font-mono text-[11px]"
              style={{ background: 'var(--surface-inset)', color: 'var(--content-secondary)' }}
            >
              {shown(field.example)}
            </dd>
          )}
        </div>
      ))}
    </dl>
  )
}
