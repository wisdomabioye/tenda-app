import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'

const problems = [
  {
    old: 'Payment held indefinitely',
    next: 'Funds released in seconds on-chain',
  },
  {
    old: 'No proof of work — trust issues',
    next: 'Workers submit verifiable proof before payout',
  },
  {
    old: 'Platform takes 10–30% cut',
    next: '2.5% platform fee, minimal long-term',
  },
  {
    old: 'Accounts banned, funds frozen',
    next: 'Non-custodial — no one can touch your funds',
  },
]

export function Problem() {
  return (
    <section className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="premium-surface overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-12 sm:px-10">
            <div className="max-w-3xl">
              <SectionBadge>The problem</SectionBadge>

              <h2 className="mt-2 text-4xl font-black tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
                Gig platforms are
                <br />
                <span className="text-[var(--text-muted)]">built on friction.</span>
              </h2>

              <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                Traditional marketplaces delay payouts, raise trust issues, and take too much from both sides.
                Tenda replaces platform dependency with verifiable, on-chain execution.
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6">
            {problems.map((item, index) => (
              <div
                key={index}
                className="grid gap-4 rounded-[calc(var(--radius)+2px)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-4 sm:grid-cols-[1fr_auto_1fr] sm:p-5"
              >
                <div className="rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-soft)_78%,transparent)] p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    <XCircle className="h-4 w-4" />
                    <span>Old way</span>
                  </div>
                  <p className="text-base font-medium leading-7 text-[var(--text)]">
                    {item.old}
                  </p>
                </div>

                <div className="hidden items-center justify-center sm:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-strong)_96%,transparent)] text-[var(--text-muted)]">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>

                <div className="rounded-2xl border border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_68%,var(--surface))] p-5">
                  <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Tenda</span>
                  </div>
                  <p className="text-base font-semibold leading-7 text-[var(--heading)]">
                    {item.next}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
