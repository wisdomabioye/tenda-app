/**
 * One operation, as the document declares it: what it is, what it takes, and
 * what every answer means. Nothing is written here — every string comes from
 * the document, so an endpoint cannot be described one way in the JSON an
 * agent parses and another way on this page.
 */
import type { OperationObject } from '@tenda/api-doc'
import { anchorFor } from '@/document'
import { Markdown } from './Markdown'

const METHOD_TONE: Readonly<Record<string, string>> = {
  GET: 'bg-[#eef3ec] text-[#3f6b3a]',
  POST: 'bg-[#f6ecdd] text-accent',
}

/** `[{ bearer: [] }]` on the operations that need a token; absent = anonymous. */
function authLabel(operation: OperationObject): string {
  const schemes = (operation.security ?? []).flatMap((requirement) => Object.keys(requirement))
  return schemes.length === 0 ? 'Anonymous' : `Bearer (${schemes.join(', ')})`
}

export function Operation({
  method,
  path,
  operation,
}: {
  method: string
  path: string
  operation: OperationObject
}) {
  return (
    <article id={anchorFor(operation.operationId)} className="border-t border-rule py-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded px-2 py-0.5 font-mono text-xs font-semibold ${METHOD_TONE[method] ?? ''}`}>
          {method}
        </span>
        <code className="font-mono text-sm text-ink">{path}</code>
        <span className="text-xs text-ink-faint">{authLabel(operation)}</span>
      </div>

      <h3 className="mt-3 text-lg font-semibold">{operation.summary}</h3>
      <Markdown className="mt-1 max-w-3xl text-sm text-ink-soft">{operation.description}</Markdown>

      {operation.parameters !== undefined && operation.parameters.length > 0 && (
        <section className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Parameters</h4>
          <dl className="mt-2 space-y-2">
            {operation.parameters.map((parameter) => (
              <div key={`${parameter.in}:${parameter.name}`} className="text-sm">
                <dt className="font-mono text-[13px]">
                  {parameter.name}
                  <span className="ml-2 font-sans text-xs text-ink-faint">
                    {parameter.in}
                    {parameter.required === true ? ' · required' : ''}
                  </span>
                </dt>
                {parameter.description !== undefined && (
                  <dd className="text-ink-soft">{parameter.description}</dd>
                )}
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="mt-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Responses</h4>
        <dl className="mt-2 space-y-1.5">
          {Object.entries(operation.responses).map(([status, response]) => (
            <div key={status} className="flex gap-3 text-sm">
              <dt className="font-mono text-[13px] text-ink">{status}</dt>
              <dd className="text-ink-soft">{response.description}</dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  )
}
