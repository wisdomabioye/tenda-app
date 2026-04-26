import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import {
  CORRIDOR_ARCS,
  CORRIDOR_DOTS,
  COVERAGE_FLOATING_LABEL,
  COVERAGE_MAP_LABELS,
  COVERAGE_MARKETS,
  type CoverageMarket,
  type MarketStatus,
} from './content'
import { WorldMapDots } from './WorldMapDots'
import { cn } from '@/lib/cn'

/**
 * Pre-launch tone map. `pilot` = team's home market (accent orange — pops
 * against the dark spine). `devnet` = supported but no pilot yet (success
 * green — same green as the corridor scatter dots, blends as "supported
 * everywhere"). No third tier — we have no liquidity to grade.
 */
const PING_TONE: Record<MarketStatus, string> = {
  pilot:  'var(--accent)',
  devnet: 'var(--success)',
}

/** Three zoom levels mapped to specific 1600×800 viewBox crops. */
type ZoomLevel = 'out' | 'mid' | 'in'

const VIEWBOXES: Record<ZoomLevel, string> = {
  out: '0 0 1600 800',     // Full world — desktop default
  mid: '200 130 1240 540', // Eurasia + Africa + Americas trimmed — tablet default
  in:  '600 130 840 540',  // Tight on Europe + Africa + Mid East + India — mobile default
}

const ZOOM_ORDER: ZoomLevel[] = ['out', 'mid', 'in']

function pickInitialZoom(): ZoomLevel {
  if (typeof window === 'undefined') return 'out'
  const w = window.innerWidth
  if (w < 640) return 'in'
  if (w < 1024) return 'mid'
  return 'out'
}

/**
 * Project (lat, lon) to the wireframe's 1600×800 viewBox so pings + halos +
 * labels line up with the WorldMapDots continent silhouettes.
 */
function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * 1600,
    y: ((90 - lat) / 180) * 800,
  }
}

/**
 * Map card. Layered, in z-order from back to front:
 *   1. Continent dot clouds (WorldMapDots — wireframe data)
 *   2. Decorative active-corridor scatter dots (CORRIDOR_DOTS, success-tinted)
 *   3. Hub glow halos (radial gradients) on every supported corridor
 *   4. Dashed corridor arcs between hubs (CORRIDOR_ARCS as Bézier paths)
 *   5. Pulsing animated rings on every supported corridor
 *   6. Hub markers — solid dot + outer ring + label rectangle + city name
 */
export function CoverageMap() {
  const [zoom, setZoom] = useState<ZoomLevel>('out')

  // Set initial zoom based on viewport once the component mounts (SSR-safe).
  useEffect(() => {
    setZoom(pickInitialZoom())
  }, [])

  const zoomIdx = ZOOM_ORDER.indexOf(zoom)
  const canZoomIn = zoomIdx < ZOOM_ORDER.length - 1
  const canZoomOut = zoomIdx > 0

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)]">
      <TopBar
        zoom={zoom}
        canZoomIn={canZoomIn}
        canZoomOut={canZoomOut}
        onZoomIn={() => canZoomIn && setZoom(ZOOM_ORDER[zoomIdx + 1])}
        onZoomOut={() => canZoomOut && setZoom(ZOOM_ORDER[zoomIdx - 1])}
      />
      <div
        className="relative w-full overflow-hidden bg-[var(--surface-inset)] text-[var(--content-primary)]"
        style={{ aspectRatio: '16 / 9', minHeight: 320 }}
      >
        <WorldMapDots viewBox={VIEWBOXES[zoom]} />

        <svg
          viewBox={VIEWBOXES[zoom]}
          preserveAspectRatio="xMidYMid meet"
          className="absolute inset-0 h-full w-full transition-[viewBox] duration-300 ease-out"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            {(['pilot', 'devnet'] as const).map((status) => (
              <radialGradient key={status} id={`coverage-glow-${status}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={PING_TONE[status]} stopOpacity={0.45} />
                <stop offset="60%" stopColor={PING_TONE[status]} stopOpacity={0.08} />
                <stop offset="100%" stopColor={PING_TONE[status]} stopOpacity={0} />
              </radialGradient>
            ))}
            <style>
              {`@keyframes coverage-ring {
                  0%   { r: 6;  opacity: 0.6; }
                  70%  { r: 26; opacity: 0;   }
                  100% { r: 26; opacity: 0;   }
                }
                .coverage-ring { animation: coverage-ring 2.4s ease-out infinite; }
                @media (prefers-reduced-motion: reduce) {
                  .coverage-ring { animation: none; opacity: 0.35; }
                }`}
            </style>
          </defs>

          {/* Decorative active-corridor scatter — small green dots */}
          <g fill="var(--success)">
            {CORRIDOR_DOTS.map((d, i) => (
              <circle key={i} cx={d.x} cy={d.y} r={d.r} opacity={d.opacity} />
            ))}
          </g>

          {/* Hub glow halos */}
          {COVERAGE_MARKETS.map((m) => {
            const { x, y } = project(m.lat, m.lon)
            const radius = m.status === 'pilot' ? 60 : 40
            return (
              <circle
                key={`glow-${m.code}`}
                cx={x}
                cy={y}
                r={radius}
                fill={`url(#coverage-glow-${m.status})`}
              />
            )
          })}

          {/* Dashed corridor arcs between top hubs */}
          <g
            fill="none"
            stroke="color-mix(in oklab, var(--success) 32%, transparent)"
            strokeWidth={1}
            strokeDasharray="3 4"
          >
            {CORRIDOR_ARCS.map((d, i) => (
              <path key={i} d={d} />
            ))}
          </g>

          {/* Pulsing animated rings on every supported corridor */}
          {COVERAGE_MARKETS.map((m) => {
            const { x, y } = project(m.lat, m.lon)
            const tone = PING_TONE[m.status]
            return (
              <circle
                key={`ring-${m.code}`}
                cx={x}
                cy={y}
                r={6}
                fill={tone}
                fillOpacity={0.35}
                className="coverage-ring"
              />
            )
          })}

          {/* Hub markers — solid dot + outer ring + label */}
          <g fontFamily="var(--font-mono)" fontSize={11} fontWeight={700}>
            {COVERAGE_MARKETS.map((m) => {
              const { x, y } = project(m.lat, m.lon)
              return <HubMarker key={m.code} market={m} x={x} y={y} />
            })}
          </g>
        </svg>

        <FloatingLabel />
      </div>
    </div>
  )
}

function HubMarker({ market, x, y }: { market: CoverageMarket; x: number; y: number }) {
  const tone = PING_TONE[market.status]
  // Approximate label width = ~7px per char + 16px padding.
  const w = market.hubLabel.length * 7 + 16
  const h = 22
  // Auto-flip if the explicit placement is `right` but it would overflow the
  // viewBox right edge.
  const explicit = market.labelPlacement ?? 'right'
  const placement = explicit === 'right' && x + 12 + w > 1590 ? 'left' : explicit

  let rectX: number
  let rectY: number
  switch (placement) {
    case 'left':
      rectX = x - 12 - w
      rectY = y - h / 2
      break
    case 'above':
      rectX = x - w / 2
      rectY = y - 12 - h
      break
    case 'below':
      rectX = x - w / 2
      rectY = y + 12
      break
    case 'right':
    default:
      rectX = x + 12
      rectY = y - h / 2
      break
  }
  const textX = rectX + w / 2
  const textY = rectY + 15

  return (
    <g>
      <circle cx={x} cy={y} r={6} fill={tone} />
      <circle
        cx={x}
        cy={y}
        r={11}
        fill="none"
        stroke={tone}
        strokeOpacity={0.55}
        strokeWidth={1.5}
      />
      <rect
        x={rectX}
        y={rectY}
        width={w}
        height={h}
        rx={4}
        fill="color-mix(in oklab, var(--surface-card) 92%, transparent)"
        stroke={`color-mix(in oklab, ${tone} 40%, transparent)`}
      />
      <text x={textX} y={textY} textAnchor="middle" fill="var(--content-primary)">
        {market.hubLabel}
      </text>
    </g>
  )
}

interface TopBarProps {
  zoom: ZoomLevel
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
}

function TopBar({ zoom, canZoomIn, canZoomOut, onZoomIn, onZoomOut }: TopBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-inset)] px-4 py-2.5">
      <span className="mono-sm shrink-0 text-[var(--content-secondary)]">
        <span className="text-[var(--content-tertiary)]">{COVERAGE_MAP_LABELS.path}</span>
        {COVERAGE_MAP_LABELS.pathSuffix}
      </span>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden items-center gap-3 md:flex">
          {COVERAGE_MAP_LABELS.legend.map((l) => (
            <span
              key={l.id}
              className="caption inline-flex items-center gap-1.5 uppercase tracking-[0.12em] text-[var(--content-tertiary)]"
            >
              <LegendDot id={l.id} />
              {l.label}
            </span>
          ))}
        </div>

        <div className="flex items-center overflow-hidden rounded-md border border-[var(--border-subtle)]">
          <ZoomBtn label="Zoom out" disabled={!canZoomOut} onClick={onZoomOut} icon={<Minus className="h-3.5 w-3.5" />} />
          <span className="mono-sm border-x border-[var(--border-subtle)] px-2.5 py-1 uppercase tracking-[0.16em] text-[var(--content-tertiary)]">
            {zoom}
          </span>
          <ZoomBtn label="Zoom in" disabled={!canZoomIn} onClick={onZoomIn} icon={<Plus className="h-3.5 w-3.5" />} />
        </div>
      </div>
    </div>
  )
}

function ZoomBtn({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center text-[var(--content-secondary)] transition-colors',
        'hover:bg-[var(--surface-bg-alt)] hover:text-[var(--content-primary)]',
        'disabled:pointer-events-none disabled:opacity-40',
      )}
    >
      {icon}
    </button>
  )
}

function LegendDot({ id }: { id: 'land' | 'pilot' | 'devnet' }) {
  if (id === 'land') {
    return (
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: 'color-mix(in oklab, var(--content-primary) 32%, transparent)' }}
      />
    )
  }
  if (id === 'pilot') {
    return (
      <span
        className="h-2 w-2 rounded-full"
        style={{
          background: 'var(--accent)',
          boxShadow: '0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent)',
        }}
      />
    )
  }
  return (
    <span
      className="h-2 w-2 rounded-full"
      style={{
        background: 'var(--success)',
        boxShadow: '0 0 0 3px color-mix(in oklab, var(--success) 22%, transparent)',
      }}
    />
  )
}

function FloatingLabel() {
  return (
    <div className="absolute right-3 top-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 py-2">
      <p className="caption uppercase tracking-[0.16em] text-[var(--success)]">
        {COVERAGE_FLOATING_LABEL.eyebrowText}
      </p>
      <p className="mono mt-0.5 text-[var(--content-primary)]">
        {COVERAGE_MARKETS.length}{' '}
        <span className="text-[var(--content-tertiary)]">{COVERAGE_FLOATING_LABEL.countSuffix}</span>
      </p>
    </div>
  )
}
