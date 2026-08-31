/**
 * Every pixel of the Signal circuit, as plain functions over a 2D context.
 *
 * NO REACT HERE, and no token lookups either — the palette arrives resolved, so
 * these run identically under the visitor's light theme, their dark theme, and
 * a test. Keeping the drawing separate from the component is what lets the
 * geometry be reasoned about (and the layout switch be unit-tested) without a
 * canvas mock.
 */
import type { FlowLane, FlowTone } from '@/content/agent-flow'

export type Palette = Record<FlowTone | 'line' | 'ink' | 'text' | 'faint', string>

export interface Point { x: number; y: number }
type Curve = readonly [Point, Point, Point, Point]

export interface Geometry {
  left: Point
  right: Point
  vault: Point
  feed: Point
  fund: Curve
  job: Curve
  proof: Curve
  pay: Curve
  fee: Curve
  feedIn: Curve
  feedOut: Curve
  direct: Curve
  /** Below this width the circuit stacks instead of spanning. */
  stacked: boolean
}

const p = (x: number, y: number): Point => ({ x, y })

/**
 * Normalised layout, in two arrangements.
 *
 * The stacked one is not a shrunk copy: on a phone a left-to-right circuit
 * collapses into an unreadable smear, so below the breakpoint the actors sit
 * top and bottom with the vault between them and the same curves re-aimed.
 * Canvas makes that cheap — the positions are all normalised, so one branch
 * here replaces what would be a second component in DOM.
 */
export function geometryFor(width: number): Geometry {
  const stacked = width < 620
  if (stacked) {
    return {
      stacked,
      left: p(0.28, 0.13), right: p(0.72, 0.87), vault: p(0.5, 0.5), feed: p(0.5, 0.16),
      fund:    [p(0.28, 0.2), p(0.28, 0.32), p(0.4, 0.36), p(0.46, 0.42)],
      job:     [p(0.54, 0.58), p(0.62, 0.66), p(0.7, 0.72), p(0.72, 0.79)],
      proof:   [p(0.66, 0.82), p(0.58, 0.72), p(0.52, 0.64), p(0.5, 0.58)],
      pay:     [p(0.5, 0.58), p(0.62, 0.66), p(0.7, 0.72), p(0.72, 0.79)],
      fee:     [p(0.5, 0.58), p(0.36, 0.68), p(0.28, 0.74), p(0.24, 0.8)],
      feedIn:  [p(0.34, 0.13), p(0.42, 0.11), p(0.46, 0.12), p(0.5, 0.13)],
      feedOut: [p(0.5, 0.2), p(0.62, 0.3), p(0.7, 0.6), p(0.72, 0.8)],
      direct:  [p(0.3, 0.2), p(0.22, 0.45), p(0.3, 0.7), p(0.66, 0.85)],
    }
  }
  return {
    stacked,
    left: p(0.13, 0.3), right: p(0.87, 0.3), vault: p(0.5, 0.655), feed: p(0.5, 0.13),
    fund:    [p(0.13, 0.3), p(0.28, 0.28), p(0.36, 0.52), p(0.47, 0.6)],
    job:     [p(0.53, 0.58), p(0.66, 0.5), p(0.74, 0.3), p(0.87, 0.3)],
    proof:   [p(0.87, 0.36), p(0.76, 0.52), p(0.64, 0.7), p(0.53, 0.68)],
    pay:     [p(0.5, 0.72), p(0.62, 0.86), p(0.76, 0.52), p(0.87, 0.36)],
    fee:     [p(0.5, 0.72), p(0.44, 0.9), p(0.3, 0.9), p(0.22, 0.82)],
    feedIn:  [p(0.15, 0.26), p(0.24, 0.1), p(0.38, 0.09), p(0.47, 0.13)],
    feedOut: [p(0.53, 0.13), p(0.62, 0.09), p(0.76, 0.1), p(0.85, 0.26)],
    direct:  [p(0.17, 0.3), p(0.4, 0.3), p(0.6, 0.3), p(0.83, 0.3)],
  }
}

const cubic = (a: number, b: number, c: number, d: number, u: number): number => {
  const m = 1 - u
  return m * m * m * a + 3 * m * m * u * b + 3 * m * u * u * c + u * u * u * d
}

export function pointOn(curve: Curve, u: number, w: number, h: number): Point {
  return {
    x: cubic(curve[0].x, curve[1].x, curve[2].x, curve[3].x, u) * w,
    y: cubic(curve[0].y, curve[1].y, curve[2].y, curve[3].y, u) * h,
  }
}

export const easeInOut = (x: number): number =>
  x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
export const easeOut = (x: number): number => 1 - Math.pow(1 - x, 3)

export interface Ctx {
  ctx: CanvasRenderingContext2D
  w: number
  h: number
  pal: Palette
  /** Stacked layout has no room for floating captions beside the packets. */
  hideCaptions: boolean
}

export function strokeCurve(
  c: Ctx, curve: Curve, upTo: number, color: string, width: number, alpha: number,
  dash?: [number, number], dashOffset = 0,
): void {
  const { ctx } = c
  ctx.save()
  ctx.strokeStyle = color; ctx.globalAlpha = alpha; ctx.lineWidth = width; ctx.lineCap = 'round'
  if (dash) { ctx.setLineDash(dash); ctx.lineDashOffset = dashOffset }
  ctx.beginPath()
  const N = 60
  for (let i = 0; i <= N * upTo; i += 1) {
    const q = pointOn(curve, i / N, c.w, c.h)
    if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y)
  }
  ctx.stroke(); ctx.restore()
}

/** A travelling value packet: a trail, a bloom, a core, and its caption. */
export function packet(
  c: Ctx, curve: Curve, u: number, color: string, size: number, caption?: string,
): void {
  const { ctx } = c
  for (let k = 10; k >= 1; k -= 1) {
    const q = pointOn(curve, Math.max(0, u - k * 0.016), c.w, c.h)
    ctx.save(); ctx.globalAlpha = 0.055 * (10 - k); ctx.fillStyle = color
    ctx.beginPath(); ctx.arc(q.x, q.y, size * (1 - k / 14), 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  const q = pointOn(curve, u, c.w, c.h)
  const bloom = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, size * 5)
  bloom.addColorStop(0, color); bloom.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = bloom
  ctx.beginPath(); ctx.arc(q.x, q.y, size * 5, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  ctx.fillStyle = c.pal.text
  ctx.beginPath(); ctx.arc(q.x, q.y, size, 0, Math.PI * 2); ctx.fill()
  if (caption !== undefined && !c.hideCaptions) {
    ctx.save()
    ctx.font = '400 10px "JetBrains Mono", ui-monospace, monospace'; ctx.textAlign = 'center'
    const width = ctx.measureText(caption).width + 14
    ctx.fillStyle = c.pal.ink; ctx.globalAlpha = 0.88
    ctx.fillRect(q.x - width / 2, q.y - 30, width, 18)
    ctx.globalAlpha = 1; ctx.fillStyle = color
    ctx.fillText(caption, q.x, q.y - 17)
    ctx.restore()
  }
}

export function caption(
  c: Ctx, x: number, y: number, text: string, color: string,
  align: CanvasTextAlign = 'left', weight = '400',
): void {
  const { ctx } = c
  ctx.save()
  ctx.font = weight + ' 10px "JetBrains Mono", ui-monospace, monospace'
  ctx.textAlign = align; ctx.fillStyle = color
  ctx.fillText(text, x, y); ctx.restore()
}

export function actorNode(
  c: Ctx, at: Point, text: string, color: string, hot: boolean, pulse: number,
): void {
  const { ctx } = c
  const x = at.x * c.w, y = at.y * c.h, r = 30
  if (hot) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2)
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.save(); ctx.globalAlpha = 0.2 + 0.12 * pulse; ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill(); ctx.restore()
  }
  ctx.save()
  ctx.strokeStyle = hot ? color : c.pal.line; ctx.lineWidth = 1.4; ctx.fillStyle = c.pal.ink
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
  if (hot) {
    ctx.globalAlpha = 1 - pulse; ctx.strokeStyle = color
    ctx.beginPath(); ctx.arc(x, y, r + pulse * 22, 0, Math.PI * 2); ctx.stroke()
  }
  ctx.restore()
  caption(c, x, y + r + 20, text.toUpperCase(), hot ? c.pal.text : c.pal.faint, 'center', '600')
}

/** The escrow, with a fill level that is the whole point of the section. */
export function vaultBox(c: Ctx, at: Point, level: number, hot: boolean, pulse: number): void {
  const { ctx, pal } = c
  const x = at.x * c.w, y = at.y * c.h, w = 96, h = 66
  const left = x - w / 2, top = y - h / 2, rr = 12
  ctx.save()
  if (hot) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 130)
    g.addColorStop(0, pal.value); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.globalAlpha = 0.16 + 0.1 * pulse; ctx.fillStyle = g
    ctx.fillRect(x - 140, y - 140, 280, 280); ctx.globalAlpha = 1
  }
  ctx.beginPath()
  ctx.moveTo(left + rr, top)
  ctx.arcTo(left + w, top, left + w, top + h, rr)
  ctx.arcTo(left + w, top + h, left, top + h, rr)
  ctx.arcTo(left, top + h, left, top, rr)
  ctx.arcTo(left, top, left + w, top, rr)
  ctx.closePath()
  ctx.fillStyle = pal.ink; ctx.fill()
  if (level > 0.001) {
    ctx.save(); ctx.clip()
    const fh = h * Math.min(1, level)
    ctx.globalAlpha = 0.35; ctx.fillStyle = pal.value
    ctx.fillRect(left, top + h - fh, w, fh)
    ctx.globalAlpha = 0.9; ctx.strokeStyle = pal.value; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(left, top + h - fh); ctx.lineTo(left + w, top + h - fh); ctx.stroke()
    ctx.restore()
  }
  ctx.strokeStyle = hot ? pal.value : pal.line; ctx.lineWidth = 1.4; ctx.stroke()
  ctx.restore()
  caption(c, x, top + h + 22, 'ESCROW', hot ? pal.text : pal.faint, 'center', '600')
}

/** The open feed, drawn only while the human lane is choosing its worker. */
export function feedPill(c: Ctx, at: Point, alpha: number): void {
  const { ctx, pal } = c
  const x = at.x * c.w, y = at.y * c.h, w = 108, h = 26
  ctx.save(); ctx.globalAlpha = alpha
  ctx.beginPath()
  ctx.rect(x - w / 2, y - h / 2, w, h)
  ctx.fillStyle = pal.ink; ctx.fill()
  ctx.strokeStyle = pal.worker; ctx.lineWidth = 1; ctx.stroke()
  ctx.restore()
  ctx.save(); ctx.globalAlpha = alpha
  caption(c, x, y + 3.5, 'OPEN FEED', pal.worker, 'center', '600')
  ctx.restore()
}

/** Which step of a lane funds the escrow — human on 1, agent on 2. */
export function fundStepOf(lane: FlowLane): number {
  return lane.id === 'human' ? 1 : 2
}
