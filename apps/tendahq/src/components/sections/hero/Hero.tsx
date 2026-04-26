import { Download } from 'lucide-react'
import { SectionShell } from '@/components/ui/SectionShell'
import { Pill } from '@/components/ui/Pill'
import { Button } from '@/components/ui/Button'
import { LiveDot } from '@/components/ui/LiveDot'
import { Placeholder } from '@/components/ui/Placeholder'
import { APP_INFO } from '@/app-info'
import { HERO_CONTENT, HERO_OPEN_OFFERS_PLACEHOLDER } from './content'
import { HeroStatRow } from './HeroStatRow'
import { CurrencyMarquee } from './CurrencyMarquee'
import { EscrowWall } from './EscrowWall'

/**
 * Hero anatomy mirrors `Tenda V2/landing/sections/01-hero-final.html`:
 *
 *   - Background: dual radial gradients (brand-blue at 82%/38%, accent-orange
 *     at 8%/75%) + a 32px-spaced horizontal scanline grid for trading-desk feel.
 *   - Left column:  pills · h1 (italic accent on line 3) · ribbon copy ·
 *                   stat row · dual CTA.
 *   - Right column: 3D drifting wall of 9 escrow mini cards with featured
 *                   MockEscrowCard sitting forward at left:8/top:168.
 *   - Below shell:  full-bleed currency rate marquee.
 */
export function Hero() {
  return (
    <>
      <SectionShell
        tone="dark"
        padY="lg"
        noReveal
        className="overflow-hidden pt-32 md:pt-40"
      >
        <HeroBackground />

        <div className="relative z-10 grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="neutral" size="md">
                {HERO_CONTENT.stamps.versionLabel}
              </Pill>
              <Pill tone="live" size="md">
                <LiveDot size={6} className="mr-1" />
                <Placeholder issue={HERO_OPEN_OFFERS_PLACEHOLDER.issue}>
                  {HERO_OPEN_OFFERS_PLACEHOLDER.value}
                </Placeholder>
                <span className="ml-1">offers open now</span>
              </Pill>
            </div>

            <h1 className="h-hero text-[var(--content-primary)]">
              {HERO_CONTENT.h1.line1}
              <br />
              {HERO_CONTENT.h1.line2}
              <br />
              <em className="not-italic text-[var(--accent)]">{HERO_CONTENT.h1.line3}</em>
            </h1>

            <p className="body-lg max-w-[58ch] text-[var(--content-secondary)]">
              {HERO_CONTENT.ribbon[0]}{' '}
              <span className="font-semibold text-[var(--content-primary)]">
                {HERO_CONTENT.ribbon[1]}
              </span>
            </p>

            <HeroStatRow />

            <div className="flex flex-wrap items-center gap-3">
              <Button href={APP_INFO.apkUrl} variant="primary" size="xl">
                <Download className="h-5 w-5" />
                {HERO_CONTENT.cta.primary}
              </Button>
              <Button href={HERO_CONTENT.cta.secondaryHref} variant="outline-subtle" size="xl">
                {HERO_CONTENT.cta.secondary}
              </Button>
            </div>
          </div>

          <div className="relative">
            <EscrowWall />
          </div>
        </div>
      </SectionShell>

      <CurrencyMarquee />
    </>
  )
}

function HeroBackground() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px)',
          backgroundSize: '100% 32px',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(circle at 82% 38%, rgba(94,135,232,0.10), transparent 55%), radial-gradient(circle at 8% 75%, rgba(240,163,101,0.06), transparent 50%)',
        }}
      />
    </>
  )
}
