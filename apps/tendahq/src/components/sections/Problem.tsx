import { CheckCircle2, Dot, XCircle } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'

const points = [
  {
    pain: 'Payouts get delayed for reasons workers cannot see or control.',
    answer: 'Escrow is visible from the start, so the path to payment is clear before work begins.',
  },
  {
    pain: 'Proof is informal, inconsistent, and often disputed after the fact.',
    answer: 'Tenda makes proof submission part of the workflow instead of an afterthought.',
  },
  {
    pain: 'Platforms extract too much value while adding friction to both sides.',
    answer: 'A lean fee model keeps more of the transaction with the people doing the work.',
  },
  {
    pain: 'Accounts can be restricted while funds and job history become inaccessible.',
    answer: 'Non-custodial settlement reduces platform control over money already committed on-chain.',
  },
]

export function Problem() {
  return (
    <section className="relative px-4 py-20 sm:px-6 sm:py-24">
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-14">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <SectionBadge>The problem</SectionBadge>

          <h2 className="mt-3 text-4xl font-black tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
            Trust should not be
            <br />
            <span className="text-[var(--text-muted)]">the weakest part of gig work.</span>
          </h2>

          <p className="mt-6 max-w-xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            Most marketplaces still depend on delays, platform control, and vague proof.
            That is not a product feature. It is just friction wearing a user interface.
          </p>

          <div className="mt-10 max-w-sm rounded-r-[20px] border-l border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[linear-gradient(90deg,color-mix(in_oklab,var(--primary-tint)_24%,transparent)_0%,transparent_100%)] pl-4 pr-4 py-1">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
              Tenda thesis
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
              Make payment certainty visible. Make proof structured. Remove unnecessary custody.
            </p>
          </div>
        </div>

        <div className="relative">
          <div className="absolute left-4 top-3 hidden h-[calc(100%-1.5rem)] w-px bg-[linear-gradient(180deg,transparent,color-mix(in_oklab,var(--border)_80%,transparent)_16%,color-mix(in_oklab,var(--border-strong)_72%,transparent)_50%,color-mix(in_oklab,var(--border)_80%,transparent)_84%,transparent)] sm:block" />

          <div className="space-y-6 sm:space-y-7">
            {points.map((item, index) => (
              <article
                key={item.pain}
                className={`relative pl-0 sm:pl-12 ${
                  index === 1 ? 'lg:ml-8' : index === 3 ? 'lg:ml-12' : ''
                }`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="hidden h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-strong)_96%,transparent)] text-xs font-bold text-[var(--heading)] shadow-[var(--shadow-xs)] sm:flex">
                    {index + 1}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                    Friction point 0{index + 1}
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--bg-soft)_78%,transparent)] p-5 shadow-[var(--shadow-xs)]">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
                      <XCircle className="h-4 w-4" />
                      <span>What breaks</span>
                    </div>
                    <p className="text-base leading-7 text-[var(--text)] sm:text-lg">
                      {item.pain}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 pl-1 text-[var(--text-muted)]">
                    <Dot className="h-5 w-5" />
                    <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                      Tenda response
                    </span>
                  </div>

                  <div className="rounded-[22px] border border-[color-mix(in_oklab,var(--primary)_20%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary-tint)_52%,transparent)_0%,color-mix(in_oklab,var(--surface)_94%,transparent)_100%)] p-5 shadow-[var(--shadow-soft)]">
                    <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>What changes</span>
                    </div>
                    <p className="text-base font-semibold leading-7 text-[var(--heading)] sm:text-lg">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
