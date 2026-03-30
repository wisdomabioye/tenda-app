import { Briefcase, Check, ClipboardList } from 'lucide-react'
import { SectionBadge } from '../ui/SectionBadge'
import { Button } from '../ui/Button'
import { APP_INFO } from '../../app-info'

const workers = [
  'Side hustlers between jobs',
  'Freelancers tired of payment delays',
  'Crypto-native earners',
  'Anyone wanting instant SOL payouts',
]

const posters = [
  'Small businesses needing quick help',
  'Individuals posting one-time tasks',
  'Crypto-savvy entrepreneurs',
  'Anyone who wants verified work done',
]

export function WhoItsFor() {
  return (
    <section id="for-who" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <SectionBadge>Who it&apos;s for</SectionBadge>
          <h2 className="mt-3 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
            Two sides.
            <br />
            <span className="text-[var(--text-muted)]">One verifiable marketplace.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="relative lg:pr-8">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)]">
              <Briefcase className="h-5 w-5 text-[var(--primary)]" />
            </div>

            <h3 className="text-2xl font-black tracking-[-0.03em] text-[var(--heading)]">Workers</h3>
            <p className="mt-3 max-w-lg text-base leading-7 text-[var(--text-muted)]">
              Accept real-world tasks, submit proof, and receive SOL without waiting on platform approval cycles.
            </p>

            <ul className="mt-8 space-y-4">
              {workers.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary-tint)_78%,var(--surface))]">
                    <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                  </span>
                  <span className="text-sm leading-6 text-[var(--text)] sm:text-base">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button href={APP_INFO.apkUrl} variant="primary" size="md">
                Start earning
              </Button>
            </div>

            <div className="mt-10 hidden h-full w-px bg-[color-mix(in_oklab,var(--border-strong)_88%,transparent)] lg:absolute lg:right-0 lg:top-0 lg:block" />
          </div>

          <div className="lg:pl-8">
            <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)]">
              <ClipboardList className="h-5 w-5 text-[var(--primary)]" />
            </div>

            <h3 className="text-2xl font-black tracking-[-0.03em] text-[var(--heading)]">Posters</h3>
            <p className="mt-3 max-w-lg text-base leading-7 text-[var(--text-muted)]">
              Publish tasks, confirm delivery with proof, and release payment through a cleaner workflow with less ambiguity.
            </p>

            <ul className="mt-8 space-y-4">
              {posters.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary-tint)_78%,var(--surface))]">
                    <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                  </span>
                  <span className="text-sm leading-6 text-[var(--text)] sm:text-base">{item}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              <Button href={APP_INFO.apkUrl} variant="outline" size="md">
                Post your first gig
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
