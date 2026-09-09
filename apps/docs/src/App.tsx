/**
 * The reference: a rail of every operation, and one reading column.
 *
 * The page states nothing about the API on its own account — the guide, the
 * guarantees, the endpoints and every sample body come from the document that
 * `scripts/generate-document.ts` bakes in from `@tenda/api-doc`. Editing the
 * docs means editing the package.
 *
 * ONE PAGE with in-page anchors, deliberately: `dist/` has to serve from any
 * static host, and a client router would need a rewrite rule to survive a
 * refresh — the platform coupling this build avoids.
 */
import { DOCS_COPY } from '@/content'
import { apiDocument, operationsByTag } from '@/lib/document'
import { useTheme } from '@/theme/useTheme'
import { Header } from '@/components/layout/Header'
import { Rail } from '@/components/layout/Rail'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Markdown } from '@/components/docs/Markdown'
import { Operation } from '@/components/docs/Operation'

const tags = operationsByTag()

export function App() {
  const { theme, toggle } = useTheme()

  return (
    <>
      <Header
        title={apiDocument.info.title}
        version={apiDocument.info.version}
        theme={theme}
        onToggleTheme={toggle}
      />

      <div className="mx-auto grid max-w-[var(--page-width)] gap-10 px-6 py-10 lg:grid-cols-[var(--rail-width)_minmax(0,1fr)]">
        <Rail tags={tags} />

        <main className="min-w-0">
          {/* The document's own description — the integration guide since #157
              stage 3, so the page needs no walkthrough of its own. */}
          <Markdown>{apiDocument.info.description}</Markdown>

          <section className="mt-10" style={{ maxWidth: 'var(--measure)' }}>
            <SectionLabel as="h2">{DOCS_COPY.guarantees}</SectionLabel>
            <ul className="mt-3 grid gap-2 pl-0" style={{ listStyle: 'none', margin: '12px 0 0' }}>
              {apiDocument.info['x-tenda-stability'].map((line) => (
                <li
                  key={line}
                  className="border-l-2 pl-3 text-[13.5px] leading-[21px]"
                  style={{ borderColor: 'var(--border-default)', color: 'var(--content-secondary)' }}
                >
                  {line}
                </li>
              ))}
            </ul>
          </section>

          {tags.map((tag) => (
            <section key={tag.name} className="mt-14">
              <h2 className="type-h2">{tag.name}</h2>
              <p className="mt-1 text-[14px]" style={{ maxWidth: 'var(--measure)', color: 'var(--content-secondary)' }}>
                {tag.description}
              </p>
              {tag.operations.map((entry) => (
                <Operation
                  key={entry.operation.operationId}
                  method={entry.method}
                  path={entry.path}
                  operation={entry.operation}
                  schemas={apiDocument.components.schemas}
                />
              ))}
            </section>
          ))}
        </main>
      </div>
    </>
  )
}
