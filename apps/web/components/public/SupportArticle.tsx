/**
 * Presentational building blocks for the public support pages — server
 * components (native <details> accordions, zero client JS): the SSR/SEO
 * requirement of S6.6 comes free.
 */
import type { ReactNode } from 'react'

export function SupportShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <h1 className="font-display text-3xl font-bold text-content-primary">{title}</h1>
      {children}
    </article>
  )
}

export function SupportAccordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-card border border-border-subtle bg-surface-card"
    >
      <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-content-primary marker:hidden [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="flex flex-col gap-3 border-t border-border-subtle px-4 py-3">{children}</div>
    </details>
  )
}

export interface GuideStepData {
  title: string
  description: string
  warning?: string
  tip?: string
}

export function GuideSteps({ steps }: { steps: readonly GuideStepData[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={step.title} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-primary-surface font-numeric text-xs font-bold text-brand-primary">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-content-primary">{step.title}</p>
            <p className="text-sm leading-6 text-content-secondary">{step.description}</p>
            {step.warning !== undefined && (
              <p className="mt-1 text-xs font-semibold text-feedback-warning-text">⚠ {step.warning}</p>
            )}
            {step.tip !== undefined && (
              <p className="mt-1 text-xs text-content-tertiary">Tip: {step.tip}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}

export function InfoCard({ label, body, children }: { label: string; body?: string; children?: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-card border border-border-subtle bg-surface-card p-4">
      <h2 className="text-sm font-semibold text-content-primary">{label}</h2>
      {body !== undefined && <p className="text-sm leading-6 text-content-secondary">{body}</p>}
      {children}
    </section>
  )
}
