// Barrel for the new collapsed schema. See ./README.md for layout + cutover.
//
// Carry-forward tables (conversations, messages, device_tokens,
// gig_subscriptions, reports, announcements, blocked_keywords) stay in the
// legacy schema.ts during planning. At Stage 0 cutover they're copied here
// into a `messaging.ts` + `reports.ts` split — Stage 6 then deletes
// `blocked_keywords` (replaced by the moderation feature module).
export * from './chains'
export * from './escrow'
export * from './governance'
export * from './identity'
export * from './ops'
export * from './reputation'
export * from './moderation'
