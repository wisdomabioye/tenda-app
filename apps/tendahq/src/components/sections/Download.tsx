import { Download, Smartphone } from 'lucide-react'
import { APP_INFO } from '../../app-info'
import { Button } from '../ui/Button'

export function DownloadCTA() {
  return (
    <section id="download" className="px-4 py-24 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-[calc(var(--radius)+8px)] border border-[color-mix(in_oklab,var(--primary)_18%,var(--border))] bg-[linear-gradient(180deg,color-mix(in_oklab,var(--primary-tint)_54%,var(--surface))_0%,color-mix(in_oklab,var(--surface-strong)_100%,transparent)_100%)] px-6 py-14 shadow-[var(--shadow)] sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top,rgba(122,168,242,0.16),transparent_62%)]" />

          <div className="relative mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-[20px] border border-[color-mix(in_oklab,var(--primary)_22%,var(--border))] bg-[color-mix(in_oklab,var(--primary-tint)_78%,var(--surface))]">
              <Smartphone className="h-7 w-7 text-[var(--primary)]" />
            </div>

            <h2 className="text-4xl font-black leading-[1.04] tracking-[-0.04em] text-[var(--heading)] sm:text-5xl md:text-6xl">
              Ready to get paid?
            </h2>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--text-muted)] sm:text-lg">
              Download Tenda for Android and start posting or accepting gigs with wallet-based access and on-chain escrow.
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href={APP_INFO.apkUrl} variant="primary" size="lg">
                <span className="inline-flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Download APK
                </span>
              </Button>

              <span className="text-sm text-[var(--text-muted)]">
                iOS version coming soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
