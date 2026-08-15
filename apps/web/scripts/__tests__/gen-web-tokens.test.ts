// @vitest-environment node
/**
 * Token-generator core. The behaviors that matter: light and dark schemes
 * emit the SAME property set in the same order (a token added to one scheme
 * only is exactly the "colour defined in a single theme block" bug), hex
 * shorthand converts correctly (not just the all-zero '#000'), shadow values
 * match the design brief, and output is deterministic so the CI drift gate
 * compares apples to apples.
 */
import { colors } from '../../../mobile/theme/tokens'
import { flattenScheme, hexToRgb, kebab, render, shadowToCss } from '../gen-web-tokens/core'

describe('kebab', () => {
  it('splits camelCase and lowercases', () => {
    expect(kebab('backgroundAlt')).toBe('background-alt')
    expect(kebab('inputBackgroundDisabled')).toBe('input-background-disabled')
  })

  it('leaves already-flat keys alone', () => {
    expect(kebab('2xs')).toBe('2xs')
    expect(kebab('card')).toBe('card')
  })
})

describe('hexToRgb', () => {
  it('parses 6-digit hex', () => {
    expect(hexToRgb('#2E5BD6')).toEqual([46, 91, 214])
  })

  it('expands 3-digit shorthand instead of misparsing it', () => {
    expect(hexToRgb('#000')).toEqual([0, 0, 0])
    expect(hexToRgb('#abc')).toEqual([170, 187, 204])
  })

  it('rejects unsupported formats loudly', () => {
    expect(() => hexToRgb('#12345')).toThrow(/unsupported hex/)
    expect(() => hexToRgb('rgba(0,0,0,1)')).toThrow(/unsupported hex/)
  })
})

describe('shadowToCss', () => {
  it('collapses RN shadows to the design-brief box-shadow values', () => {
    expect(
      shadowToCss({
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -24 },
        shadowOpacity: 0.1,
        shadowRadius: 48,
      }),
    ).toBe('0px -24px 48px rgba(0,0,0,0.1)')
    expect(
      shadowToCss({
        shadowColor: '#2E5BD6',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
      }),
    ).toBe('0px 10px 24px rgba(46,91,214,0.18)')
  })
})

describe('scheme flattening', () => {
  it('light and dark emit the SAME properties in the SAME order', () => {
    const light = flattenScheme(colors.light).map(([property]) => property)
    const dark = flattenScheme(colors.dark).map(([property]) => property)
    expect(dark).toEqual(light)
    expect(light.length).toBeGreaterThan(0)
  })

  it('flattens nested tones into the appendix naming', () => {
    const names = new Set(flattenScheme(colors.light).map(([property]) => property))
    expect(names.has('--surface-background')).toBe(true)
    expect(names.has('--feedback-danger-text')).toBe(true)
    expect(names.has('--category-errand-surface')).toBe(true)
    expect(names.has('--control-input-background-disabled')).toBe(true)
  })
})

describe('render', () => {
  const css = render()

  it('is deterministic', () => {
    expect(render()).toBe(css)
  })

  it('emits all three theme blocks with color-scheme hints', () => {
    expect(css).toContain(':root{\n  color-scheme:light;')
    expect(css).toContain('@media (prefers-color-scheme:dark){\n  :root:not([data-theme="light"]){')
    expect(css).toContain(':root[data-theme="dark"]{\n  color-scheme:dark;')
  })

  it('carries known light and dark values from the mobile tokens', () => {
    expect(css).toContain('--surface-background:#F7F5F0')
    expect(css).toContain('--surface-background:#0D1018')
    expect(css).toContain('--radius-card:20px')
    expect(css).toContain('--space-2xs:4px')
    expect(css).toContain('--shadow-sheet:0px -24px 48px rgba(0,0,0,0.1)')
  })

  it('maps every colour token into the Tailwind theme block', () => {
    for (const [property] of flattenScheme(colors.light)) {
      expect(css).toContain(`--color-${property.slice(2)}:var(${property});`)
    }
  })
})
