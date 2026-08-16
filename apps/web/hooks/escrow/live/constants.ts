/**
 * Live-refresh tuning, mirroring mobile hooks/escrow-live/constants.ts.
 * Leaf file on purpose: the timer tests import these names directly so
 * they can never drift from the tuning.
 */
export const ESCROW_EVENT_DEBOUNCE_MS = 400
export const ESCROW_FOCUSED_POLL_MS = 15_000
