import { Fuel, Sparkles, Wallet, Zap } from 'lucide-react'
import { Pill } from '@/components/ui/Pill'
import { LiveDot } from '@/components/ui/LiveDot'
import { type OnboardingFeature } from '@/content'
import { cn } from '@/lib/cn'

const ICONS = { Fuel, Sparkles, Wallet, Zap } as const

interface Props {
  feature: OnboardingFeature
  className?: string
}

/**
 * One onboarding rail. Everything decorative is brand-blue or neutral; the
 * chains a rail covers appear as micro-dots next to their names — a list, not
 * a single chain, because a rail is a GAS POLICY and a policy can span several
 * chains (and gains chains without any copy change). Status pills stay honest:
 * live rails pulse, roadmap rails are muted and say they aren't here yet.
 */
export function FeatureCard({ feature, className }: Props) {
  const Icon = ICONS[feature.icon]

  return (
    <article
      className={cn(
        'flex flex-col gap-4 rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-6',
        'shadow-[var(--shadow-card)] transition-transform duration-300 ease-out hover:-translate-y-1',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand-surface)] text-[var(--brand)]">
          <Icon className="h-5 w-5" />
        </span>
        {feature.status === 'live' ? (
          <Pill tone="live" size="sm" className="ml-auto">
            <LiveDot size={5} className="mr-1" />
            Live
          </Pill>
        ) : (
          <Pill tone="neutral" size="sm" className="ml-auto">
            Roadmap
          </Pill>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {feature.chains.length > 0 && (
          <span className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1 text-[var(--content-tertiary)]">
            {feature.chains.map((chain) => (
              <span key={chain.id} className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: chain.color }}
                />
                {chain.name}
              </span>
            ))}
          </span>
        )}
        <h3 className="h3 text-[var(--content-primary)]">{feature.title}</h3>
        <p className="body text-[var(--content-secondary)]">{feature.body}</p>
      </div>

      <p className="mono-sm mt-auto border-t border-[var(--border-subtle)] pt-3 text-[var(--content-tertiary)]">
        {feature.fact}
      </p>
    </article>
  )
}
