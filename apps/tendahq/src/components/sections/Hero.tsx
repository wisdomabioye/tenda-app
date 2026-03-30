import { ChevronDown } from 'lucide-react'
import { Button } from '../ui/Button'
import { APP_INFO } from '../../app-info'
import tendaIcon from '../../assets/tenda-icon-blue.png'

export function Hero() {
  return (
    <section className="relative isolate flex min-h-[92svh] items-center overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_top,rgba(122,168,242,0.14),transparent_62%)]" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-[color-mix(in_oklab,var(--border)_80%,transparent)]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 pt-16 sm:px-6 md:pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface-strong)_96%,transparent)] px-4 py-2 text-sm text-[var(--text-muted)] shadow-[var(--shadow-soft)]">
            <img src={tendaIcon} alt="" className="h-4 w-4" />
            <span>Trustless escrow on Solana</span>
          </div>

          <h1 className="mx-auto max-w-4xl text-4xl font-black leading-[1.02] tracking-[-0.04em] text-[var(--heading)] sm:text-6xl md:text-7xl">
            {APP_INFO.tagline}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
            {APP_INFO.description}
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/#download" variant="primary" size="lg">
              Download for Android
            </Button>

            <Button href="/#how-it-works" variant="outline" size="lg">
              See how it works
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--text-muted)]">
            <span>No custodial risk</span>
            <span className="hidden sm:inline text-[var(--border-strong)]">•</span>
            <span>Proof-based payouts</span>
            <span className="hidden sm:inline text-[var(--border-strong)]">•</span>
            <span>Open-source contracts</span>
          </div>
        </div>

        <div className="mt-14 flex justify-center opacity-45">
          <ChevronDown className="h-5 w-5 text-[var(--text-muted)] animate-bounce" />
        </div>
      </div>
    </section>
  )
}
