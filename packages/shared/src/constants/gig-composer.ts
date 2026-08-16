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

export function getGigStepMissingRequirement(
  step: GigComposerStep,
  values: GigValidationValues,
): string | null {
  if (step === 'details') {
    if (values.category === null) return 'Pick a category'
    if (values.title.trim().length === 0) return 'Add a title'
    if (values.description.trim().length === 0) return 'Add a description'
    if (!values.remote && values.country === null) return 'Select a country'
    if (!values.remote && values.city === null) return 'Select a city'
    return null
  }

  if (step === 'payment') {
    if (!isValidGigAmountRaw(values.asset, values.paymentRaw)) return 'Set a budget'
    if (!isValidCompletionDuration(values.completionDuration)) return 'Set a delivery time'
  }

  return null
}

export function getGigMissingRequirement(values: GigValidationValues): string | null {
  for (const step of GIG_COMPOSER_STEPS) {
    const missing = getGigStepMissingRequirement(step.key, values)
    if (missing !== null) return missing
  }
  return null
}
