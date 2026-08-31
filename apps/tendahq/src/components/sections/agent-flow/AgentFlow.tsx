/**
 * §02 The hire loop — one circuit, two ways in.
 *
 * WHAT THIS FILE OWNS: the heading, the lane controls, the readable step list,
 * and the decision to run at all. WHAT IT DOES NOT OWN: the diagram.
 * `SignalCircuit` is imported once, below, and swapping treatments is that one
 * line — copy, sequencing, viewport gating and reduced motion are unaffected.
 *
 * ACCESSIBILITY. The steps are published as a real ordered list carrying each
 * one's actor, detail and gas payer, and that list — not the canvas — is the
 * content. Nothing is revealed only by the animation: every step is in the
 * document at every moment, and the active one is emphasised rather than
 * uncovered. The section is therefore complete with motion off, with CSS off,
 * and to a screen reader.
 *
 * The lane cycles on its own instead of hiding half the section behind a tab a
 * visitor will not press. The buttons pin a lane for anyone who wants to read
 * one properly, and say so.
 */
import { SectionShell } from '@/components/ui/SectionShell'
import { Eyebrow } from '@/components/ui/Eyebrow'
import { Pill } from '@/components/ui/Pill'
import { useIntersect } from '@/hooks/useIntersect'
import { FLOW_LANES } from '@/content/agent-flow'
import { cn } from '@/lib/cn'
import { AGENT_FLOW_HEADER, AGENT_FLOW_STEPS_LABEL, LANE_PIN_HINT } from './content'
import { useFlowTimeline } from './useFlowTimeline'
// THE SWAP POINT — one import, one line. See the file header.
import { SignalCircuit } from './SignalCircuit'

export function AgentFlow() {
  // The loop only runs on screen: a landing has no business burning frames on
  // a section nobody is looking at.
  const { ref, isVisible } = useIntersect<HTMLDivElement>({ threshold: 0.2 })
  const { lane, activeIndex, progress, pinnedId, togglePin } = useFlowTimeline({ running: isVisible })

  return (
    <SectionShell id="hire-loop" surface="alt" padY="lg">
      <div className="mb-8 flex max-w-[62ch] flex-col gap-4">
        <Eyebrow tone="brand" dot>
          {AGENT_FLOW_HEADER.eyebrow}
        </Eyebrow>
        <h2 className="h1 text-[var(--content-primary)]">
          {AGENT_FLOW_HEADER.h2.lead}{' '}
          <span className="text-[var(--brand)]">{AGENT_FLOW_HEADER.h2.emphasis}</span>
        </h2>
        <p className="body-lg text-[var(--content-secondary)]">{AGENT_FLOW_HEADER.sub}</p>
      </div>

      {/* Lane controls. Not a tab rail — Onboarding below already is one, and
          the lane changes by itself, so these are an override rather than the
          only way to see the second lane. */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FLOW_LANES.map((l) => {
          const showing = l.id === lane.id
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => togglePin(l.id)}
              aria-pressed={pinnedId === l.id}
              className={cn(
                'mono-sm inline-flex h-9 items-center gap-2 rounded-full border px-4 font-semibold transition-colors',
                showing
                  ? 'border-[var(--brand-border)] bg-[var(--brand-surface)] text-[var(--brand)]'
                  : 'border-[var(--border-default)] bg-[var(--surface-card)] text-[var(--content-tertiary)] hover:text-[var(--content-primary)]',
              )}
            >
              {l.title}
            </button>
          )
        })}
        <span className="caption text-[var(--content-tertiary)]">
          {pinnedId === null ? LANE_PIN_HINT.cycling : LANE_PIN_HINT.pinned}
        </span>
      </div>

      <div
        ref={ref}
        className="rounded-3xl border border-[var(--border-default)] bg-[var(--surface-card)] p-4 shadow-[var(--shadow-card)] md:p-6"
      >
        <SignalCircuit lane={lane} activeIndex={activeIndex} progress={progress} />

        <h3 className="sr-only">{AGENT_FLOW_STEPS_LABEL}</h3>
        <ol className="mt-6 grid gap-4 border-t border-[var(--border-default)] pt-6 md:grid-cols-3">
          {lane.steps.map((step, i) => (
            <li
              key={step.id}
              className={cn(
                'flex flex-col gap-1.5 transition-opacity duration-500',
                // Presentational only — every step stays in the document and
                // stays readable, at every point in the loop.
                i <= activeIndex ? 'opacity-100' : 'opacity-50',
              )}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="caption font-bold uppercase tracking-[0.08em] text-[var(--content-tertiary)]">
                  {step.actor}
                </span>
                <Pill tone={step.gas === null ? 'success' : 'neutral'} size="sm">
                  {step.gas ?? 'no transaction'}
                </Pill>
              </span>
              <span className="body font-semibold text-[var(--content-primary)]">{step.label}</span>
              <span className="body-sm text-[var(--content-secondary)]">{step.note}</span>
            </li>
          ))}
        </ol>
      </div>
    </SectionShell>
  )
}
