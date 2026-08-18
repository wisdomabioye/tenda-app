/**
 * The gig composer's cross-client contract: form value shape, field limits,
 * per-category hints, step metadata and the step/whole-form validation both
 * clients run (moved from apps/mobile/components/gig/gig-form/{constants,
 * gig-composer.steps}.ts 2026-08-15). Pure — the React form controllers stay
 * per-client, but what a VALID gig is can never fork between them.
 */
import type { GigCategory } from './categories'
import type { ProofType } from './proofs'
import { isValidCompletionDuration, isValidGigAmountRaw } from '../utils/validation'

export const TITLE_MAX = 80
export const DESC_MAX = 1500

/**
 * Completion window a gig starts with — the form's initial value and the
 * fallback when a draft has none. Both readers share it so the two can't drift.
 */
export const DEFAULT_COMPLETION_SECONDS = 86_400

export const CATEGORY_HINTS: Record<GigCategory, string> = {
  delivery: 'Pickup address, drop-off, package size, fragility notes.',
  photo:    'Type of shoot (product/event/portrait), duration, edits expected.',
  errand:   'What needs doing, where, and any items + budget to purchase.',
  service:  'Type of service, tools/materials, accessibility requirements.',
  digital:  'Scope, deliverable format, revision rounds, tools/accounts.',
}

/** Appended to every description hint — proof is required to complete any gig. */
export const PROOF_NOTE = 'Proof required before the gig can be considered completed.'

export interface GigFormValues {
  title: string
  description: string
  /** CAIP-2 chain + its gig asset (CO5), always a gigAssetByChain pair. */
  chainId: string
  asset: string
  /** Budget in raw units of `asset`. */
  paymentRaw: number
  completionDuration: number
  category: GigCategory | null
  country: string | null
  remote: boolean
  city: string | null
  acceptDeadlineHours: number
  /** Empty = any evidence accepted (the pre-existing behaviour). */
  proofRequirements: ProofType[]
  /**
   * Approval mode: the poster assigns from applications instead of the gig
   * being first-come. Baked on-chain at create and never editable afterwards,
   * which is why it belongs on the create form and nowhere else.
   */
  requiresApproval: boolean
}

export const GIG_COMPOSER_STEPS = [
  { key: 'details', label: 'Details', title: 'Describe the work', subtitle: 'Help the right person understand the job at a glance.' },
  { key: 'payment', label: 'Payment', title: 'Set payment and timing', subtitle: 'Choose a budget, network, and realistic delivery window.' },
  { key: 'delivery', label: 'Delivery', title: 'Define delivery', subtitle: 'Decide who can take the gig and what proof you expect.' },
] as const

export type GigComposerStep = (typeof GIG_COMPOSER_STEPS)[number]['key']

export interface GigValidationValues {
  title: string
  description: string
  category: GigCategory | null
  remote: boolean
  country: string | null
  city: string | null
  asset: string
  paymentRaw: number
  completionDuration: number
}

/** What one field still needs, phrased as the action the poster must take. */
export type GigRequirementCheck = (values: GigValidationValues) => string | null

/**
 * The requirements, one per FIELD rather than per step.
 *
 * Clients group these differently — mobile collects them in three steps, the
 * web wizard in five — but the rule for any single field is defined once,
 * here. A client that restated a threshold locally would be redefining what a
 * valid gig is, which this module exists to prevent.
 */
export const GIG_REQUIREMENTS = {
  category: (v) => (v.category === null ? 'Pick a category' : null),
  title: (v) => (v.title.trim().length === 0 ? 'Add a title' : null),
  description: (v) => (v.description.trim().length === 0 ? 'Add a description' : null),
  /**
   * Remote gigs carry no location at all, so neither field is required; a
   * physical gig needs both, and the country is asked for first because the
   * city list depends on it.
   */
  place: (v) => {
    if (v.remote) return null
    if (v.country === null) return 'Select a country'
    if (v.city === null) return 'Select a city'
    return null
  },
  budget: (v) => (!isValidGigAmountRaw(v.asset, v.paymentRaw) ? 'Set a budget' : null),
  duration: (v) => (!isValidCompletionDuration(v.completionDuration) ? 'Set a delivery time' : null),
} satisfies Record<string, GigRequirementCheck>

/** The first requirement not yet met, in the order the reader meets them. */
export function firstMissingRequirement(
  checks: readonly GigRequirementCheck[],
  values: GigValidationValues,
): string | null {
  for (const check of checks) {
    const missing = check(values)
    if (missing !== null) return missing
  }
  return null
}

const STEP_REQUIREMENTS: Record<GigComposerStep, readonly GigRequirementCheck[]> = {
  details: [
    GIG_REQUIREMENTS.category,
    GIG_REQUIREMENTS.title,
    GIG_REQUIREMENTS.description,
    GIG_REQUIREMENTS.place,
  ],
  payment: [GIG_REQUIREMENTS.budget, GIG_REQUIREMENTS.duration],
  // Proof and acceptance mode both have valid "unset" values: an empty
  // proofRequirements means any evidence is accepted, and instant acceptance
  // is the default. Nothing here can be missing.
  delivery: [],
}

export function getGigStepMissingRequirement(
  step: GigComposerStep,
  values: GigValidationValues,
): string | null {
  return firstMissingRequirement(STEP_REQUIREMENTS[step], values)
}

export function getGigMissingRequirement(values: GigValidationValues): string | null {
  for (const step of GIG_COMPOSER_STEPS) {
    const missing = getGigStepMissingRequirement(step.key, values)
    if (missing !== null) return missing
  }
  return null
}
