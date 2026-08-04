/**
 * Operational alerts — the public face of the feature.
 *
 * Consumers import from `@server/features/alerts` and get the contracts plus
 * the registry lookups. Concrete channels are deliberately NOT re-exported:
 * they are reached only through the registry, which is what keeps plugging one
 * in or pulling one out a single-line change (see ./registry).
 *
 * Listed by name rather than `export *`, which the older barrels in this repo
 * use, because this module is mostly TYPES. The split below is the useful part:
 * `export type` says "erased at compile time", `export` says "a real value at
 * runtime", so the two lines state exactly which of these nine names survive
 * into the emitted JavaScript — two of them. `export *` states the opposite of
 * nothing, and emits an `__exportStar` loop that walks the module's properties
 * at import time to move those same two values.
 *
 * The cost is that a contract added to ./types must be added here too. That
 * drift is loud, not silent: a consumer importing a name the barrel does not
 * re-export fails to compile, at the import.
 */

export { ALERT_KINDS, ALERT_CHANNEL_NAMES } from './types'
export type {
  Alert,
  AlertChannel,
  AlertChannelName,
  AlertDeps,
  AlertKind,
  AlertLogger,
  AlertRef,
} from './types'

export { ALERT_CHANNELS, alertChannelNames, channelByName, channelsFor } from './registry'
