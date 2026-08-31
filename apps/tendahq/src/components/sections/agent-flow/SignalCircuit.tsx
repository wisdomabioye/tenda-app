/**
 * THE SWAPPABLE VISUAL — the hire loop as a live circuit.
 *
 * REPLACING THIS IS ONE IMPORT in AgentFlow.tsx. Nothing else names this file:
 * the section owns the heading, the readable step list and the lane controls,
 * and hands this component the two things any diagram of the same data needs.
 *
 * It is `aria-hidden` and renders no text a reader depends on. The steps are
 * published beneath it as a real ordered list, so this is presentation of
 * content stated elsewhere — not the only copy of it.
 *
 * The palette is READ FROM THE LIVE ELEMENT rather than hardcoded, because the
 * landing has a light theme and a dark one and a canvas cannot resolve `var()`.
 * It is re-read on resize and whenever the theme changes.
 */
import { useEffect, useRef } from 'react'
import { AGENT_COLOR, TONE_VARS, type FlowLane, type FlowTone } from '@/content/agent-flow'
import {
  actorNode, caption, easeInOut, easeOut, feedPill, fundStepOf, geometryFor,
  packet, strokeCurve, vaultBox, type Ctx, type Palette,
} from './circuit-paint'

export interface FlowVisualProps {
  lane: FlowLane
  activeIndex: number
  /** 0..1 through the active step. */
  progress: number
}

function readPalette(el: HTMLElement): Palette {
  const s = getComputedStyle(el)
  const v = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback
  const tone = (t: FlowTone) => v(TONE_VARS[t], '#888')
  return {
    poster: tone('poster'),
    worker: tone('worker'),
    // 0G's own colour when the manifest still carries the family, so the agent
    // reads as the chain it belongs to rather than as generic brand paint.
    agent: AGENT_COLOR ?? tone('agent'),
    value: tone('value'),
    line: v('--border-strong', '#888'),
    ink: v('--surface-card', '#fff'),
    text: v('--content-primary', '#000'),
    faint: v('--content-tertiary', '#888'),
  }
}

export function SignalCircuit({ lane, activeIndex, progress }: FlowVisualProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const pal = useRef<Palette | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (canvas === null) return
    const refresh = () => { pal.current = readPalette(canvas) }
    refresh()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', refresh)
    // An explicit theme choice stamps data-theme on <html>; the media query
    // never fires for that, so the attribute is watched as well.
    const observer = new MutationObserver(refresh)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    window.addEventListener('resize', refresh)
    return () => {
      mq.removeEventListener('change', refresh)
      observer.disconnect()
      window.removeEventListener('resize', refresh)
    }
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (canvas === null) return
    const ctx2d = canvas.getContext('2d')
    if (ctx2d === null) return
    const rect = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
    ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (pal.current === null) pal.current = readPalette(canvas)

    const g = geometryFor(rect.width)
    const c: Ctx = { ctx: ctx2d, w: rect.width, h: rect.height, pal: pal.current, hideCaptions: g.stacked }
    const { pal: P } = c
    const i = activeIndex, p = progress
    const pulse = easeOut(Math.min(1, p * 2.2))
    const fundStep = fundStepOf(lane)
    const leftCol = P[lane.left.tone]
    const rightCol = P[lane.right.tone]

    ctx2d.clearRect(0, 0, c.w, c.h)
    for (const curve of [g.fund, g.job, g.proof]) strokeCurve(c, curve, 1, P.line, 1.2, 0.5)

    let level = 0
    if (i === fundStep) level = easeInOut(p)
    else if (i > fundStep && i < 5) level = 1
    else if (i === 5) level = 1 - easeInOut(Math.min(1, Math.max(0, (p - 0.35) / 0.5)))

    vaultBox(c, g.vault, level, i >= fundStep, pulse)
    actorNode(c, g.left, lane.left.label, leftCol, i === 0 || i === fundStep || i === 5, pulse)
    actorNode(c, g.right, lane.right.label, rightCol, i === 3 || i === 4 || (i === 5 && p > 0.5), pulse)

    const dashOffset = -(p * 40)
    // Steps before the chain: a signal that deliberately stops short of it.
    if (i < fundStep) {
      strokeCurve(c, g.direct, 0.28, leftCol, 1.4, 0.5, [4, 7], dashOffset)
      if (!g.stacked) {
        const x = g.left.x * c.w + 34, y = g.left.y * c.h
        caption(c, x, y - 14, lane.id === 'agent'
          ? (i === 0 ? 'POST /v1/agent/tasks' : '402 Payment Required → X-PAYMENT')
          : 'draft · off-chain', P.faint)
        if (lane.id === 'agent' && i === 1) caption(c, x, y - 30, 'x402', P.agent, 'left', '700')
      }
    }
    // The human lane's fork: the open feed, or a direct invite that skips it.
    if (lane.id === 'human' && i === 2) {
      const a = easeOut(Math.min(1, p * 1.6))
      feedPill(c, g.feed, a)
      strokeCurve(c, g.feedIn, a, P.worker, 1.6, 0.75, [5, 6], dashOffset)
      strokeCurve(c, g.feedOut, a, P.worker, 1.6, 0.75, [5, 6], dashOffset)
      strokeCurve(c, g.direct, a, P.worker, 1.6, 0.4, [3, 8], dashOffset)
      if (!g.stacked) {
        caption(c, g.feed.x * c.w, g.feed.y * c.h - 24, 'applies, then the poster assigns', P.faint, 'center')
        caption(c, g.direct[0].x * c.w + 24, g.direct[0].y * c.h - 12, 'or invited directly', P.faint)
      }
    }
    if (i === fundStep) {
      strokeCurve(c, g.fund, p, P.value, 2, 0.9)
      packet(c, g.fund, p, P.value, 4.5, '25.00 USDC')
    }
    if (i === 3) { strokeCurve(c, g.job, p, rightCol, 2, 0.9); packet(c, g.job, p, rightCol, 4, 'the job') }
    if (i === 4) { strokeCurve(c, g.proof, p, rightCol, 2, 0.9); packet(c, g.proof, p, rightCol, 4, 'proof') }
    if (i === 5 && p > 0.35) {
      const u = Math.min(1, (p - 0.35) / 0.55)
      strokeCurve(c, g.pay, u, P.worker, 2.6, 0.95); packet(c, g.pay, u, P.worker, 5)
      strokeCurve(c, g.fee, u, P.faint, 1.6, 0.8); packet(c, g.fee, u, P.faint, 3)
    }
  }, [lane, activeIndex, progress])

  return <canvas ref={ref} aria-hidden className="block h-[380px] w-full md:h-[440px]" />
}
