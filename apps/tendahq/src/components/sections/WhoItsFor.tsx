import { Briefcase, ClipboardList, Check } from 'lucide-react'
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
        <div className="premium-surface overflow-hidden">
          <div className="border-b border-[var(--border)] px-6 py-12 sm:px-10">
            <div className="mx-auto max-w-3xl text-center">
              <SectionBadge>Who it&apos;s for</SectionBadge>
              <h2 className="mt-2 text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
                Two sides.
                <br />
                <span className="text-[var(--text-muted)]">One trustless workflow.</span>
              </h2>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-2">
            <div className="rounded-[calc(var(--radius)+4px)] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] p-6 sm:p-8">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_72%,var(--surface))]">
                <Briefcase className="h-5 w-5 text-[var(--primary)]" />
              </div>

              <h3 className="text-2xl font-black tracking-[-0.03em] text-[var(--heading)]">
                Workers
              </h3>
              <p className="mt-3 text-base leading-7 text-[var(--text-muted)]">
                Complete real-world tasks and get paid in SOL without platform delays or custodial risk.
              </p>

              <ul className="mt-7 space-y-3">
                {workers.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[var(--text)]">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary-tint)_78%,var(--surface))]">
                      <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                    </span>
                    <span className="text-sm leading-6 sm:text-base">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <Button href={APP_INFO.apkUrl} variant="primary" size="md">
                  Start earning
                </Button>
              </div>
            </div>

            <div className="rounded-[calc(var(--radius)+4px)] border border-[color-mix(in_oklab,var(--primary)_18%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary-tint)_56%,var(--surface))_0%,color-mix(in_oklab,var(--surface)_96%,transparent)_100%)] p-6 sm:p-8">
              <div className="mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_82%,var(--surface))]">
                <ClipboardList className="h-5 w-5 text-[var(--primary)]" />
              </div>

              <h3 className="text-2xl font-black tracking-[-0.03em] text-[var(--heading)]">
                Posters
              </h3>
              <p className="mt-3 text-base leading-7 text-[var(--text-muted)]">
                Publish tasks, review proof, and release payment through a cleaner, verifiable process.
              </p>

              <ul className="mt-7 space-y-3">
                {posters.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-[var(--text)]">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--primary-tint)_82%,var(--surface))]">
                      <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                    </span>
                    <span className="text-sm leading-6 sm:text-base">{item}</span>
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
      </div>
    </section>
  )
}
