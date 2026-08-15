import type { ReactNode } from 'react'

/** Centered card every auth step renders inside — one look for the whole flow. */
export function AuthPanel({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight text-content-primary">{title}</h1>
        {lede !== undefined && <p className="text-sm leading-5 text-content-secondary">{lede}</p>}
      </header>
      {children}
    </section>
  )
}
