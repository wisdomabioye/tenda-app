/**
 * Test-only helpers shipped as `@tenda/shared/testing` (#140) — the one place
 * a fixture gets the fields of a wire type that no test asserts on.
 *
 * WHY IT EXISTS. Every REQUIRED field added to `ChainRegistryEntry` was paid
 * for by hand in every fixture that builds one: `roles` (#129) ~24 sites,
 * then `relayed_funding_available` / `rpc_url` / `explorer_url` /
 * `faucet_url` (#132/#137) 32 sites, and the sweep missed inline literals
 * twice. None of those suites care about the values; they were typing them to
 * satisfy the type. With the fields spread from here, the next required field
 * is ONE edit in this module, and the compiler then names every fixture that
 * still needs something only it can supply.
 *
 * HONEST BY CONSTRUCTION. A known chain id gets the manifest's real public
 * facts through the same `chainPublicFacts` the route serves; a fabricated id
 * gets nulls, which is what the route would also answer for a chain the
 * manifest does not know. `relayed_funding_available` is the one
 * per-deployment fact, defaulted to false — a fixture that needs a relaying
 * chain says so by overriding it after the spread.
 *
 * Runtime code must never import this module: it is a fixture seam, exported
 * under its own subpath so the main barrel stays runtime-only.
 */
import type { ChainRegistryEntry } from '../api/contracts/platform.contract'
import { chainPublicFacts } from '../chains/manifest-queries'

/** The registry-entry fields a fixture should not have to spell: deployment + public facts. */
export type RegistryEntryDefaults = Pick<
  ChainRegistryEntry,
  'relayed_funding_available' | 'rpc_url' | 'explorer_url' | 'faucet_url'
>

/**
 * Spread AFTER a fixture's own identity fields and BEFORE any override:
 *
 *   { id, namespace, display_name, escrow_address, ...registryEntryDefaults(id), assets }
 */
export function registryEntryDefaults(id: string): RegistryEntryDefaults {
  return { relayed_funding_available: false, ...chainPublicFacts(id) }
}
