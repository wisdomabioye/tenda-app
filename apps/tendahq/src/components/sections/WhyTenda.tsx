import { Zap, Camera, Lock, Scale } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'
import type { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const features: Feature[] = [
  {
    icon: Zap,
    title: 'Instant Escrow',
    description: 'Funds lock the moment a gig is published — no waiting, no manual holds.',
  },
  {
    icon: Camera,
    title: 'Proof-Based Approval',
    description: 'Workers submit photo or video proof. Posters review before releasing payment.',
  },
  {
    icon: Lock,
    title: 'Non-Custodial',
    description: 'Your keys, your money. Tenda never touches your SOL — the smart contract does.',
  },
  {
    icon: Scale,
    title: 'Built-in Disputes',
    description: 'Structured resolution backed by admin arbitration when a task is contested.',
  },
]

export function WhyTenda() {
  return (
    <section id="why-tenda" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="premium-surface overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-12 sm:px-10">
            <div className="mx-auto max-w-3xl text-center">
              <SectionBadge>Why Tenda</SectionBadge>
              <h2 className="mt-2 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
                Built for trust,
                <br />
                <span className="text-[var(--text-muted)]">not extraction.</span>
              </h2>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                Every feature is designed to reduce friction, protect both sides, and keep payouts verifiable.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-[calc(var(--radius)+2px)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-6"
              >
                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_72%,var(--surface))]">
                  <f.icon className="h-5 w-5 text-[var(--primary)]" />
                </div>

                <h3 className="text-xl font-bold tracking-[-0.02em] text-[var(--heading)]">
                  {f.title}
                </h3>

                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
