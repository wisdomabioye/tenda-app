/**
 * §02 header copy. The SEQUENCE lives in content/agent-flow.ts — it is the
 * section's subject, and a replacement diagram must not have to restate it.
 *
 * The heading carries the contrast in words, because the two lanes take about
 * eighteen seconds to both play and a visitor who sees only one must still get
 * the point. It claims a capability, not a deployment, and names no chain — so
 * it stays true before and after mainnet, and clear of the whole-page
 * deployment-claim guard.
 */

export const AGENT_FLOW_HEADER = {
  eyebrow: 'The hire loop',
  h2: { lead: 'A person hires a person.', emphasis: 'Or software does.' },
  sub: 'Same escrow, same proof, same payout — the only thing that changes is who walks in the door, and who pays to get through it. Watch the money: it never sits with us.',
} as const

/** Heading for the plain-text sequence assistive tech reads. */
export const AGENT_FLOW_STEPS_LABEL = 'How a job runs, step by step'

/** Said next to the lane buttons, so the control explains itself. */
export const LANE_PIN_HINT = {
  cycling: 'both play in turn · pick one to hold it',
  pinned: 'holding · pick it again to resume',
} as const
