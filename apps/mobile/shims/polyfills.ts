/**
 * Web-ish globals expected by `@metamask/connect-multichain` (browser-first,
 * treats RN as a degenerate browser). Imported once during app bootstrap;
 * `react-native-get-random-values` must run BEFORE this file so
 * `crypto.getRandomValues` is in place by the time anything else uses it.
 *
 * Mirrors the official quickstart at
 * https://docs.metamask.io/metamask-connect/multichain/quickstart/react-native/
 *
 * Critical: the Event/CustomEvent shims here are required for MM Connect's
 * `invokeMethod` responses to propagate. Without them, sign requests appear
 * to "time out" even though MM has signed.
 */
import { Buffer } from 'buffer'

// MM Connect's RN bundle dynamically `import()`s these transitive deps. Under
// Expo/Metro that lands in an async-require pipeline which can fail to resolve
// module IDs in pnpm monorepos. Importing them statically here forces Metro
// to bundle them into the main chunk so async-require can find them. Side-
// effect imports do nothing themselves.
import 'eciesjs'
import '@metamask/mobile-wallet-protocol-core'
import '@metamask/mobile-wallet-protocol-dapp-client'

class EventPolyfill {
  type: string
  bubbles: boolean
  cancelable: boolean
  defaultPrevented = false
  constructor(type: string, options?: EventInit) {
    this.type = type
    this.bubbles = options?.bubbles ?? false
    this.cancelable = options?.cancelable ?? false
  }
  preventDefault(): void {
    this.defaultPrevented = true
  }
  stopPropagation(): void {}
  stopImmediatePropagation(): void {}
}

class CustomEventPolyfill<T = unknown> extends EventPolyfill {
  detail: T | null
  constructor(type: string, options?: CustomEventInit<T>) {
    super(type, options)
    this.detail = options?.detail ?? null
  }
}

const g = globalThis

if (!g.Buffer) g.Buffer = Buffer

// @ts-expect-error — RN has no DOM `window`; minimal shim is sufficient.
if (!g.window) g.window = {}
if (!g.window.location) {
  // @ts-expect-error — partial Location shim is enough for MM Connect's reads.
  g.window.location = { hostname: 'tendahq.com', href: 'https://tendahq.com' }
}
if (typeof g.window.addEventListener !== 'function') {
  g.window.addEventListener = () => {}
}
if (typeof g.window.removeEventListener !== 'function') {
  g.window.removeEventListener = () => {}
}
if (typeof g.window.dispatchEvent !== 'function') {
  g.window.dispatchEvent = () => true
}

if (typeof g.Event === 'undefined') {
  // @ts-expect-error — partial Event polyfill (no NONE/CAPTURING_PHASE etc.)
  g.Event = EventPolyfill
  // @ts-expect-error
  g.window.Event = EventPolyfill
}

if (typeof g.CustomEvent === 'undefined') {
  // @ts-expect-error — partial CustomEvent polyfill (no initCustomEvent etc.)
  g.CustomEvent = CustomEventPolyfill
  // @ts-expect-error
  g.window.CustomEvent = CustomEventPolyfill
}
