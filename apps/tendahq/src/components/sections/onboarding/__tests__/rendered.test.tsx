import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ONBOARDING_FEATURES } from '@/content'
import { Onboarding } from '../Onboarding'

/**
 * The section is a selector rail over ONE panel, so the static markup carries
 * every rail's TAB but only the default rail's prose — these assertions pin
 * exactly that contract (its interaction is a useState swap the static render
 * cannot exercise; what it CAN prove is that the rail is complete, the
 * default is the first rail, and the tablist wiring is real).
 */
describe('onboarding rendered', () => {
  const html = renderToStaticMarkup(createElement(Onboarding))

  it('renders a tab for every rail, in content order', () => {
    for (const feature of ONBOARDING_FEATURES) {
      expect(html).toContain(`onboarding-tab-${feature.id}`)
      expect(html).toContain(feature.tab)
    }
    const tabPositions = ONBOARDING_FEATURES.map((f) => html.indexOf(`onboarding-tab-${f.id}`))
    expect([...tabPositions].sort((a, b) => a - b)).toEqual(tabPositions)
  })

  it('shows the FIRST rail in the panel by default, and only that rail', () => {
    const first = ONBOARDING_FEATURES[0]
    expect(html).toContain(first.title)
    expect(html).toContain(first.body)
    expect(html).toContain(first.fact)
    for (const other of ONBOARDING_FEATURES.slice(1)) {
      expect(html).not.toContain(other.body)
    }
  })

  it('wires the tablist: one panel, one selected tab, labelled by it', () => {
    expect(html.match(/role="tabpanel"/g)).toHaveLength(1)
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1)
    expect(html).toContain(`aria-labelledby="onboarding-tab-${ONBOARDING_FEATURES[0].id}"`)
    expect(html.match(/role="tab"/g)).toHaveLength(ONBOARDING_FEATURES.length)
  })

  it('marks every roadmap rail on its tab, and none of the live ones', () => {
    const roadmapCount = ONBOARDING_FEATURES.filter((f) => f.status !== 'live').length
    expect(roadmapCount).toBeGreaterThan(0)
    expect(html.match(/title="On the roadmap"/g)).toHaveLength(roadmapCount)
  })
})
