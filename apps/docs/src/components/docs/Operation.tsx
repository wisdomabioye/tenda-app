/**
 * One endpoint, as the document declares it: what it is, what it takes, what
 * every answer means and looks like. Nothing is written here — every string
 * comes from the document, so an endpoint cannot read one way in the JSON an
 * agent parses and another way on this page.
 */
import type { OperationObject } from '@tenda/api-doc'
import { DOCS_COPY } from '@/content'
import { anchorFor } from '@/lib/document'
import type { SchemaBook } from '@/lib/sample'
import { Chip } from '@/components/ui/Chip'
import { CodeBlock } from '@/components/ui/CodeBlock'
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
  const body = operation.requestBody?.content['application/json']
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
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.9px]" style={{ color: 'var(--content-tertiary)' }}>
            {DOCS_COPY.parameters}
          </h4>
          <dl className="grid gap-1.5">
            {operation.parameters.map((parameter) => (
              <div key={`${parameter.in}:${parameter.name}`} className="grid gap-0.5">
                <dt className="flex items-baseline gap-2">
                  <code className="font-mono text-[12.5px]">{parameter.name}</code>
                  <span className="text-[11px]" style={{ color: 'var(--content-tertiary)' }}>
                    {parameter.in}
                    {parameter.required === true ? ' · required' : ''}
                  </span>
                </dt>
                {parameter.description !== undefined && (
                  <dd className="m-0 text-[13px]" style={{ color: 'var(--content-secondary)' }}>{parameter.description}</dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      )}

      {body?.example !== undefined && (
        <section className="grid gap-2">
          <h4 className="font-mono text-[10px] font-semibold uppercase tracking-[0.9px]" style={{ color: 'var(--content-tertiary)' }}>
            {DOCS_COPY.requestBody}
          </h4>
          <CodeBlock value={body.example} label={DOCS_COPY.sampleRecorded} />
        </section>
      )}

      <ResponseList responses={operation.responses} schemas={schemas} />
    </article>
  )
}
