/**
 * Pure rendering core for the design-token generator. No filesystem, no
 * process — main.ts owns the CLI. Kept separate so the transforms are unit-
 * testable (scripts/__tests__/gen-web-tokens.test.ts) while the CI drift gate
 * (`gen:tokens:check`) exercises the full pipeline for real.
 */
import { colors, radius, shadows, spacing, type ColorScheme } from '../../../mobile/theme/tokens'

export const kebab = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** Flattens the nested ColorScheme into ordered [--custom-property, value] pairs. */
export function flattenScheme(scheme: ColorScheme): Array<[string, string]> {
  const pairs: Array<[string, string]> = []
  const walk = (node: Record<string, unknown>, path: string[]) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === 'string') {
        pairs.push([`--${path.concat(key).map(kebab).join('-')}`, value])
      } else {
        walk(value as Record<string, unknown>, path.concat(key))
      }
    }
  }
  walk(scheme as unknown as Record<string, unknown>, [])
  return pairs
}

export function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace('#', '')
  // '#abc' is shorthand for '#aabbcc' — expanding first keeps the math right
  // for any future mobile token, not just the all-zero '#000'.
  const value = raw.length === 3 ? [...raw].map((c) => c + c).join('') : raw
  if (value.length !== 6 || /[^0-9a-fA-F]/.test(value)) {
    throw new Error(`hexToRgb: unsupported hex colour "${hex}"`)
  }
  const int = parseInt(value, 16)
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
}

/** The fields a CSS box-shadow needs — RN's `elevation` is Android-only noise here. */
export interface ShadowToken {
  shadowColor: string
  shadowOffset: { width: number; height: number }
  shadowOpacity: number
  shadowRadius: number
}

/** Collapses an RN shadow token into a CSS box-shadow value. */
export function shadowToCss(shadow: ShadowToken): string {
  const [r, g, b] = hexToRgb(shadow.shadowColor)
  return `${shadow.shadowOffset.width}px ${shadow.shadowOffset.height}px ${shadow.shadowRadius}px rgba(${r},${g},${b},${shadow.shadowOpacity})`
}

function geometryBlock(): string {
  const lines: string[] = []
  for (const [key, value] of Object.entries(radius)) {
    lines.push(`  --radius-${kebab(key)}:${value}px;`)
  }
  for (const [key, value] of Object.entries(spacing)) {
    lines.push(`  --space-${kebab(key)}:${value}px;`)
  }
  for (const [key, value] of Object.entries(shadows)) {
    lines.push(`  --shadow-${kebab(key)}:${shadowToCss(value)};`)
  }
  return lines.join('\n')
}

function colourLines(scheme: ColorScheme): string {
  return flattenScheme(scheme)
    .map(([property, value]) => `  ${property}:${value};`)
    .join('\n')
}

/**
 * Maps every token into Tailwind v4 theme namespaces so utilities exist for
 * all of them (bg-surface-card, text-content-primary, rounded-card, p-md,
 * shadow-elevated) while the values keep flowing through the :root custom
 * properties — theme switching stays pure CSS.
 */
function themeMapBlock(): string {
  const lines: string[] = []
  for (const [property] of flattenScheme(colors.light)) {
    lines.push(`  --color-${property.slice(2)}:var(${property});`)
  }
  for (const key of Object.keys(radius)) {
    lines.push(`  --radius-${kebab(key)}:var(--radius-${kebab(key)});`)
  }
  for (const key of Object.keys(spacing)) {
    lines.push(`  --spacing-${kebab(key)}:var(--space-${kebab(key)});`)
  }
  for (const key of Object.keys(shadows)) {
    lines.push(`  --shadow-${kebab(key)}:var(--shadow-${kebab(key)});`)
  }
  return `/* ── Tailwind utility mapping ──────────────────────────────── */
@theme inline{
${lines.join('\n')}
}
`
}

export function render(): string {
  const light = colourLines(colors.light)
  const dark = colourLines(colors.dark)
  return `/* GENERATED from apps/mobile/theme/tokens.ts — do not edit.
 * Regenerate: pnpm --filter web gen:tokens
 * CI guard:   pnpm --filter web gen:tokens:check
 */

/* ── Colour: light ─────────────────────────────────────────── */
:root{
  color-scheme:light;
${light}

/* ── Geometry: theme-independent ───────────────────────────── */
${geometryBlock()}
}

/* ── Colour: dark (system preference) ──────────────────────── */
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    color-scheme:dark;
${dark
  .split('\n')
  .map((line) => `  ${line}`)
  .join('\n')}
  }
}

/* ── Colour: dark (explicit toggle) ────────────────────────── */
:root[data-theme="dark"]{
  color-scheme:dark;
${dark}
}

${themeMapBlock()}`
}
