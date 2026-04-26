import { ESCROW_WALL } from '@/data/mock-feed'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { MockEscrowMini } from './MockEscrowMini'
import { MockEscrowCard } from '@/components/product/MockEscrowCard'
import { cn } from '@/lib/cn'

const DRIFT_DELAYS = ['0s', '-2.2s', '-4.4s', '-1.5s', '-3.0s', '-0.7s', '-2.9s', '-1.8s', '-3.6s'] as const
const DRIFT_DURATIONS = ['7s', '7s', '9s', '8s', '7s', '7s', '9s', '8s', '7s'] as const

/**
 * 3D wall of 9 drifting escrow mini-cards arranged in a 3×3 grid, with the
 * featured MockEscrowCard sitting forward at left:8 / top:168 (rotated -2.5deg,
 * brand-glow border). Mirrors `Tenda V2/landing/sections/01-hero-final.html`:
 *   .wall-stage   — perspective container, 620h, vignette mask
 *   .wall-inner   — rotateY(-18deg) rotateX(6deg) rotateZ(-1.5deg) origin 100% 50%
 *   .escrow-mini  — drift ±7px / 7s ease-in-out, staggered delays
 *   .hero-card    — featured, flat (rotate -2.5deg only), brand glow throbs 4s
 *
 * Reduced-motion: no drift, no glow throb, all cards static.
 */
export function EscrowWall() {
  const reduced = useReducedMotion()

  return (
    <div className="relative h-[560px] w-full lg:h-[620px]" aria-hidden style={{ pointerEvents: 'none' }}>
      <div
        className="absolute inset-0 z-10"
        style={{
          background:
            'linear-gradient(180deg, var(--surface-bg) 0%, transparent 12%, transparent 82%, var(--surface-bg) 100%)',
        }}
      />

      <div
        className="absolute right-[-40px] top-[-10px] grid w-[628px] grid-cols-3 gap-3.5"
        style={{
          transform: 'rotateY(-18deg) rotateX(6deg) rotateZ(-1.5deg)',
          transformOrigin: '100% 50%',
          perspective: 1600,
        }}
      >
        {ESCROW_WALL.map((mini, i) => (
          <div
            key={mini.id}
            style={
              reduced
                ? undefined
                : {
                    animation: `escrow-drift ${DRIFT_DURATIONS[i]} ease-in-out infinite`,
                    animationDelay: DRIFT_DELAYS[i],
                  }
            }
          >
            <MockEscrowMini mini={mini} />
          </div>
        ))}
      </div>

      <div
        className={cn('absolute left-2 top-[168px] z-20 w-[320px] rounded-[28px]')}
        style={{
          transform: 'rotate(-2.5deg)',
          animation: reduced ? undefined : 'featured-glow 4s ease-in-out infinite',
        }}
      >
        <MockEscrowCard featured staticState />
      </div>
    </div>
  )
}
