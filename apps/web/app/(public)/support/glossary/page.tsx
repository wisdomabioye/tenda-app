import type { Metadata } from 'next'
import { SUPPORT_GLOSSARY, APP_INFO } from '@tenda/shared'
import { SupportShell } from '@/components/public/SupportArticle'

export const metadata: Metadata = {
  title: `Glossary · ${APP_INFO.name}`,
  description: 'Plain-English definitions of blockchain and escrow terms.',
}

export default function GlossaryPage() {
  return (
    <SupportShell title="Glossary">
      <dl className="flex flex-col gap-4">
        {SUPPORT_GLOSSARY.map((entry) => (
          <div key={entry.term} className="rounded-card border border-border-subtle bg-surface-card p-4">
            <dt className="text-sm font-semibold text-content-primary">{entry.term}</dt>
            <dd className="mt-1 text-sm leading-6 text-content-secondary">{entry.definition}</dd>
          </div>
        ))}
      </dl>
    </SupportShell>
  )
}
