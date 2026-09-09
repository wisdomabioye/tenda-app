/**
 * The whole site: one page, rendered from the document.
 *
 * ONE PAGE ON PURPOSE. A client router would need a rewrite rule on whichever
 * host serves `dist/`, and that rule is the platform coupling this site is
 * built to avoid. In-page anchors do the same job for a reference document and
 * survive being served from a bare directory.
 */
import { anchorFor, apiDocument, operationsByTag } from '@/document'
import { Markdown } from './components/Markdown'
import { Operation } from './components/Operation'

const tags = operationsByTag()

export function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-rule bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-baseline gap-x-4 gap-y-1 px-6 py-4">
          <h1 className="text-base font-semibold">{apiDocument.info.title}</h1>
          <span className="font-mono text-xs text-ink-faint">v{apiDocument.info.version}</span>
          <span className="font-mono text-xs text-ink-faint">OpenAPI {apiDocument.openapi}</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-10 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Operations" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="space-y-4 text-sm">
            {tags.map((tag) => (
              <li key={tag.name}>
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{tag.name}</span>
                <ul className="mt-1 space-y-1">
                  {tag.operations.map(({ operation }) => (
                    <li key={operation.operationId}>
                      <a className="text-ink-soft hover:text-accent" href={`#${anchorFor(operation.operationId)}`}>
                        {operation.summary}
                      </a>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        <main>
          {/* The document's own description — since #157 stage 3 this carries
              the integration guide, so the page needs no walkthrough of its own. */}
          <Markdown className="max-w-3xl">{apiDocument.info.description}</Markdown>

          <section className="mt-10 max-w-3xl">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
              What this contract guarantees
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              {apiDocument.info['x-tenda-stability'].map((line) => (
                <li key={line} className="border-l-2 border-rule pl-3">
                  {line}
                </li>
              ))}
            </ul>
          </section>

          {tags.map((tag) => (
            <section key={tag.name} className="mt-12">
              <h2 className="text-xl font-semibold">{tag.name}</h2>
              <p className="mt-1 max-w-3xl text-sm text-ink-soft">{tag.description}</p>
              {tag.operations.map((entry) => (
                <Operation
                  key={entry.operation.operationId}
                  method={entry.method}
                  path={entry.path}
                  operation={entry.operation}
                />
              ))}
            </section>
          ))}
        </main>
      </div>
    </div>
  )
}
