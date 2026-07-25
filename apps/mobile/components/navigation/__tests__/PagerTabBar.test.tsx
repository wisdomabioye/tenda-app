/**
 * PagerTabBar — the shared underline tab row. Counts are the interesting part:
 * an absent count must render no chip at all (so a tab with no meaningful
 * total isn't decorated), and a zero count must still render (a real "you have
 * none" is information, not an absence).
 */
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Animated } from 'react-native'

jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: {
      colors: {
        border: { subtle: '#eee' },
        brand: { primary: '#50f', primarySurface: '#eef' },
        content: { primary: '#000', tertiary: '#888' },
        surface: { inset: '#f5f5f5' },
      },
    },
  }),
}))

import { PagerTabBar } from '../PagerTabBar'

const scrollX = new Animated.Value(0)

function renderBar(tabs: { key: string; label: string; count?: number }[], onTabPress = jest.fn()) {
  render(
    <PagerTabBar
      tabs={tabs}
      activeIndex={0}
      scrollX={scrollX}
      pageWidth={375}
      onTabPress={onTabPress}
    />,
  )
  return onTabPress
}

test('renders a label per tab', () => {
  renderBar([{ key: 'a', label: 'Posted' }, { key: 'b', label: 'Working' }])
  expect(screen.getByText('Posted')).toBeTruthy()
  expect(screen.getByText('Working')).toBeTruthy()
})

test('renders the count chip when a count is supplied', () => {
  renderBar([{ key: 'a', label: 'Posted', count: 12 }, { key: 'b', label: 'Working', count: 3 }])
  expect(screen.getByText('12')).toBeTruthy()
  expect(screen.getByText('3')).toBeTruthy()
})

test('renders a zero count — "none" is a real answer, not a missing one', () => {
  renderBar([{ key: 'a', label: 'Working', count: 0 }])
  expect(screen.getByText('0')).toBeTruthy()
})

test('renders no chip when the tab has no count', () => {
  renderBar([{ key: 'a', label: 'Market' }])
  expect(screen.queryByText('0')).toBeNull()
})

test('reports the pressed tab index', () => {
  const onTabPress = renderBar([
    { key: 'a', label: 'Posted' },
    { key: 'b', label: 'Working' },
  ])
  fireEvent.press(screen.getByText('Working'))
  expect(onTabPress).toHaveBeenCalledWith(1)
})

test('marks the active tab for accessibility', () => {
  renderBar([{ key: 'a', label: 'Posted' }, { key: 'b', label: 'Working' }])
  const tabs = screen.getAllByRole('tab')
  expect(tabs[0].props.accessibilityState.selected).toBe(true)
  expect(tabs[1].props.accessibilityState.selected).toBe(false)
})
