import { Camera, Lock, Scale, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const featured: Feature = {
  icon: Zap,
  title: 'Escrow is part of the workflow',
  description:
    'On Tenda, payment readiness is visible from the start. Funds are locked when a gig is created, so workers know the payout path is real before they begin.',
}

const supporting: Feature[] = [
  {
    icon: Camera,
    title: 'Proof before payout',
    description: 'Workers submit clear photo or video proof before payment is released.',
  },
  {
    icon: Lock,
    title: 'Non-custodial by default',
    description: 'Tenda never takes custody of your funds. The contract handles settlement.',
  },
  {
    icon: Scale,
    title: 'Structured dispute flow',
    description: 'If a task is contested, resolution follows a defined path instead of guesswork.',
  },
]

export function WhyTenda() {
  return (
    <section id="why-tenda" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <SectionBadge>Why Tenda</SectionBadge>
          <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
            Built for trust,
            <br />
            <span className="text-[var(--text-muted)]">not extraction.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            Every part of the product is designed to reduce platform dependency and make completion,
            approval, and payout easier to verify.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-[color-mix(in_oklab,var(--primary)_20%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary-tint)_52%,var(--surface))_0%,color-mix(in_oklab,var(--surface)_96%,transparent)_100%)] p-7 shadow-[var(--shadow-soft)] sm:p-8">
            <div className="mb-8 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_70%,var(--surface))]">
              <featured.icon className="h-6 w-6 text-[var(--primary)]" />
            </div>

            <div className="max-w-xl">
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                Core advantage
              </div>
              <h3 className="text-2xl font-black tracking-[-0.03em] text-[var(--heading)] sm:text-3xl">
                {featured.title}
              </h3>
              <p className="mt-4 text-base leading-8 text-[var(--text)]">
                {featured.description}
              </p>
            </div>
          </div>

          <div className="grid gap-4">
            {supporting.map((item) => (
              <div
                key={item.title}
                className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-6 shadow-[var(--shadow-xs)]"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-soft)_80%,transparent)]">
                  <item.icon className="h-5 w-5 text-[var(--primary)]" />
                </div>

                <h3 className="text-lg font-bold text-[var(--heading)]">{item.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
