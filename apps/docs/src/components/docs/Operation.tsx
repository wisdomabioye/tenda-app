/**
 * One endpoint, as the document declares it: what it is, what it takes, what
 * every answer means and looks like. Nothing is written here — every string
 * comes from the document, so an endpoint cannot read one way in the JSON an
 * agent parses and another way on this page.
 */
import type { OperationObject } from '@tenda/api-doc'
import { DOCS_COPY } from '@/content'
import { anchorFor } from '@/lib/document'
import { sampleForContent, type SchemaBook } from '@/lib/sample'
import { Chip } from '@/components/ui/Chip'
import { CodeBlock } from '@/components/ui/CodeBlock'
import { FieldList } from '@/components/ui/FieldList'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Markdown } from './Markdown'
import { ResponseList } from './ResponseList'
import { RunPanel } from './RunPanel'

/** `[{ bearer: [] }]` on the operations that need a token; absent = anonymous. */
function authLabel(operation: OperationObject): string {
  const schemes = (operation.security ?? []).flatMap((requirement) => Object.keys(requirement))
  return schemes.length === 0 ? 'Anonymous' : `Bearer · ${schemes.join(', ')}`
}

export function Operation({
  method,
  path,
  operation,
  schemas,
}: {
  method: 'GET' | 'POST'
  path: string
  operation: OperationObject
  schemas: SchemaBook
}) {
  // Every operation that takes a body shows one — recorded where the document
  // has an exchange to quote, otherwise shaped from the schema it references.
  // Two of the three write operations record no example, and step one of the
  // guide is one of them: without this the page said they take nothing.
  const body = sampleForContent(operation.requestBody?.content, schemas)
  return (
    <article
      id={anchorFor(operation.operationId)}
      className="grid gap-4 border-t py-8"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone={method === 'POST' ? 'brand' : 'ok'}>{method}</Chip>
          <code className="font-mono text-[13px]" style={{ color: 'var(--content-primary)' }}>{path}</code>
          <span className="font-mono text-[10.5px]" style={{ color: 'var(--content-tertiary)' }}>
            {authLabel(operation)}
          </span>
          <RunPanel method={method} path={path} operation={operation} />
        </div>
        <h3 className="type-h3" style={{ textWrap: 'balance' }}>{operation.summary}</h3>
      </header>

      <Markdown className="text-[14px]">{operation.description}</Markdown>

      {operation.parameters !== undefined && operation.parameters.length > 0 && (
        <section className="grid gap-2">
          <SectionLabel as="h4">{DOCS_COPY.parameters}</SectionLabel>
          <FieldList
            fields={operation.parameters.map((parameter) => ({
              name: parameter.name,
              meta: `${parameter.in}${parameter.required === true ? ' · required' : ''}`,
              description: parameter.description,
              example: parameter.example,
            }))}
          />
        </section>
      )}

      {body !== null && (
        <section className="grid gap-2">
          <SectionLabel as="h4">{DOCS_COPY.requestBody}</SectionLabel>
          <CodeBlock
            value={body.value}
            label={body.source === 'recorded' ? DOCS_COPY.sampleRecorded : DOCS_COPY.sampleDerived}
          />
        </section>
      )}

      <ResponseList responses={operation.responses} schemas={schemas} />
    </article>
  )
}
