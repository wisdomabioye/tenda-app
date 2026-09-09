/**
 * Every response an operation can answer with — and what each one looks like.
 *
 * The listing used to be a status and a sentence, which told a reader that a
 * 409 has no shape. Each row now carries a body: the document's recorded
 * example where it has one, otherwise a body shaped from the schema the
 * response already references (lib/sample.ts). The row says which, because a
 * shaped body is a truthful sketch and a recorded one is what the wire sent.
 *
 * A row also carries the HEADERS its status declares. Only one response has
 * any — the 201's settlement receipt — and it is declared there because prose
 * alone left two reviewers unable to confirm it comes back (#111).
 */
import type { ResponseObject } from '@tenda/api-doc'
import { DOCS_COPY } from '@/content'
import { sampleForResponse, type SchemaBook } from '@/lib/sample'
import { Chip } from '@/components/ui/Chip'
import { FieldList } from '@/components/ui/FieldList'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { toneForStatus } from '@/components/ui/status-tone'
import { CodeBlock } from '@/components/ui/CodeBlock'

export function ResponseList({
  responses,
  schemas,
}: {
  responses: Readonly<Record<string, ResponseObject>>
  schemas: SchemaBook
}) {
  return (
    <section className="grid gap-3">
      <SectionLabel as="h4">{DOCS_COPY.responses}</SectionLabel>
      {Object.entries(responses).map(([status, response]) => {
        const sample = sampleForResponse(status, response, schemas)
        return (
          <div key={status} className="grid gap-2">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <Chip tone={toneForStatus(status)}>{status}</Chip>
              <span className="text-[13px]" style={{ color: 'var(--content-secondary)' }}>
                {response.description}
              </span>
            </div>
            {response.headers !== undefined && (
              <FieldList
                fields={Object.entries(response.headers).map(([name, header]) => ({
                  name,
                  meta: DOCS_COPY.responseHeader,
                  description: header.description,
                }))}
              />
            )}
            {sample !== null && (
              <CodeBlock
                value={sample.value}
                label={sample.source === 'recorded' ? DOCS_COPY.sampleRecorded : DOCS_COPY.sampleDerived}
              />
            )}
          </div>
        )
      })}
    </section>
  )
}
