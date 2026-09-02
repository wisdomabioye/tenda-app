/**
 * The gas-seed CLAIM, on mobile — the whole feature, in one directory.
 *
 * WHY IT IS SHAPED THIS WAY (user, 2026-09-02): the claim must be reachable
 * from two places — the wallet screen, where it is findable, and the moment a
 * user has no gas on a chain, where it is most needed — and BOTH of those must
 * be nothing more than an import and a render. Every decision (what to fetch,
 * which states exist, what each one says, when the button may appear) lives
 * here; a host contributes placement and nothing else.
 *
 * That is not tidiness. Two placements with two copies of "when may I offer
 * this?" is how one of them ends up offering a claim to a user who already has
 * the money.
 *
 * HOW TO ADD A PLACEMENT
 *   `<GasClaimSection />`                        — the full block, fetches for itself
 *   `<GasClaimCard offer={…} variant="inline" />` — one chain, inside a host that
 *                                                   already holds the offers
 *
 * REMOVAL RECIPE — keep this true:
 *   1. delete this directory;
 *   2. delete the `<GasClaimSection />` line from `app/(tabs)/wallet.tsx`;
 *   3. delete the `wallet:` line from `createApiClient` in
 *      `@tenda/shared/api/client` and `api/client/wallet.ts` beside it.
 * The session client stamp in `api/request.ts` STAYS: it records which client
 * minted a session, which is a generic fact this feature happens to read.
 */

export { GasClaimSection, type GasClaimSectionProps } from './GasClaimSection'
export { GasClaimCard, type GasClaimCardProps } from './GasClaimCard'
export { useGasClaim, gasClaimForChain, type GasClaimState } from './useGasClaim'
export { gasClaimWalletByChain } from './wallet-map'
export {
  GAS_CLAIM_COPY,
  GAS_CLAIM_REASON_COPY,
  GAS_CLAIM_STATE_COPY,
  GAS_CLAIM_UNAVAILABLE_FALLBACK,
  gasClaimMessage,
} from './copy'
