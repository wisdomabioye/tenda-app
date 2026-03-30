import { useState } from 'react'
import { SectionBadge } from '../ui/SectionBadge'
import { APP_INFO } from '../../app-info'

type Tab = 'earn' | 'post'

export function HowItWorks() {
  const [tab, setTab] = useState<Tab>('earn')

  const steps = tab === 'earn' ? APP_INFO.howItWorksEarn : APP_INFO.howItWorksPost

  return (
    <section id="how-it-works" className="px-4 py-24 sm:px-6">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionBadge>How it works</SectionBadge>

          <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
            Simple flow.
            <br />
            <span className="text-[var(--text-muted)]">Trust in every step.</span>
          </h2>

          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            Whether you want to earn or post a gig, the process stays direct, verifiable, and
            non-custodial from start to finish.
          </p>

          <div className="mt-8 inline-flex rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-1.5">
            <button
              type="button"
              onClick={() => setTab('earn')}
              className={`min-w-[132px] rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                tab === 'earn'
                  ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--heading)]'
              }`}
            >
              Earn SOL
            </button>
            <button
              type="button"
              onClick={() => setTab('post')}
              className={`min-w-[132px] rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                tab === 'post'
                  ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--heading)]'
              }`}
            >
              Post a gig
            </button>
          </div>
        </div>

        <div className="relative pl-0 sm:pl-6">
          <div className="absolute left-5 top-2 hidden h-[calc(100%-1rem)] w-px bg-[color-mix(in_oklab,var(--border-strong)_88%,transparent)] sm:block" />

          <div className="space-y-5">
            {steps.map((step) => (
              <div key={step.step} className="relative grid gap-4 sm:grid-cols-[56px_1fr]">
                <div className="relative z-10 hidden sm:flex">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_54%,var(--surface))] text-sm font-bold text-[var(--heading)]">
                    {step.step}
                  </div>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-xs)] sm:p-6">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                    Step {step.step}
                  </div>
                  <h3 className="text-lg font-bold text-[var(--heading)] sm:text-xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                    {step.description}
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
