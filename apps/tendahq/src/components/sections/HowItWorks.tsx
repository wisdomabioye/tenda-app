import { useState } from 'react'
import { SectionBadge } from '../ui/SectionBadge'
import { APP_INFO } from '../../app-info'

type Tab = 'earn' | 'post'

export function HowItWorks() {
  const [tab, setTab] = useState<Tab>('earn')

  const steps = tab === 'earn' ? APP_INFO.howItWorksEarn : APP_INFO.howItWorksPost

  return (
    <section id="how-it-works" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="premium-surface overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-12 sm:px-10">
            <div className="mx-auto max-w-3xl text-center">
              <SectionBadge>How it works</SectionBadge>

              <h2 className="mt-2 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
                Simple flow.
                <br />
                <span className="text-[var(--text-muted)]">Trust built into every step.</span>
              </h2>

              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
                Whether you want to earn or post a gig, Tenda keeps the process direct, verifiable, and
                non-custodial from start to finish.
              </p>

              <div className="mt-8 inline-flex rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <button
                  type="button"
                  onClick={() => setTab('earn')}
                  className={`min-w-[128px] rounded-xl px-5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                    tab === 'earn'
                      ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_8px_20px_rgba(29,69,129,0.18)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--heading)]'
                  }`}
                >
                  Earn SOL
                </button>

                <button
                  type="button"
                  onClick={() => setTab('post')}
                  className={`min-w-[128px] rounded-xl px-5 py-2.5 text-sm font-semibold transition-all cursor-pointer ${
                    tab === 'post'
                      ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-[0_8px_20px_rgba(29,69,129,0.18)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--heading)]'
                  }`}
                >
                  Post a gig
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-8 sm:px-10 sm:py-10">
            <div className="mx-auto max-w-4xl">
              <div className="flex flex-col gap-4">
                {steps.map((step, i) => (
                  <div
                    key={step.step}
                    className="grid gap-4 md:grid-cols-[72px_1fr]"
                  >
                    <div className="relative flex md:justify-center">
                      <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_66%,var(--surface))] text-sm font-bold text-[var(--heading)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                        {step.step}
                      </div>

                      {i < steps.length - 1 && (
                        <div className="absolute left-6 top-12 hidden h-[calc(100%+1rem)] w-px bg-[color-mix(in_oklab,var(--border-strong)_82%,transparent)] md:block" />
                      )}
                    </div>

                    <div
                      className={`rounded-[calc(var(--radius)+2px)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-5 sm:p-6 ${
                        i === steps.length - 1 ? '' : ''
                      }`}
                    >
                      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
                        Step {step.step}
                      </div>

                      <h3 className="text-lg font-bold leading-7 text-[var(--heading)] sm:text-xl">
                        {step.title}
                      </h3>

                      <p className="mt-2 text-sm leading-7 text-[var(--text-muted)] sm:text-base">
                        {step.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
