/**
 * The header states the contract's identity — and it must state the version
 * the document carries, not one typed here.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { APP_INFO } from '@/content'
import { apiBaseUrl } from '@/env'
import { AGENT_API_DOCUMENT_PATH } from '@/lib/document'
import { Header } from '@/components/layout/Header'

describe('Header', () => {
  it('shows the document’s title as the page heading and its version beside it', () => {
    render(<Header title="Tenda Agent API" version="2.0.0" theme="light" onToggleTheme={() => {}} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Tenda Agent API' })).toBeTruthy()
    expect(screen.getByText('v2.0.0')).toBeTruthy()
  })

  it('offers the opposite theme, in both directions, and says which', () => {
    const toggle = vi.fn()
    const light = render(<Header title="t" version="1" theme="light" onToggleTheme={toggle} />)
    expect(screen.getByRole('button', { name: /switch to dark/i })).toBeTruthy()
    expect(screen.getByText(/Light/)).toBeTruthy()
    light.unmount()

    render(<Header title="t" version="1" theme="dark" onToggleTheme={toggle} />)
    expect(screen.getByRole('button', { name: /switch to light/i })).toBeTruthy()
    expect(screen.getByText(/Dark/)).toBeTruthy()
  })

  it('links to the JSON document at the path the document declares for itself', () => {
    render(<Header title="t" version="1" theme="light" onToggleTheme={() => {}} />)
    const link = screen.getByText(AGENT_API_DOCUMENT_PATH)
    expect(link.getAttribute('href')).toBe(`${apiBaseUrl()}${AGENT_API_DOCUMENT_PATH}`)
  })

  it('shows the real mark, and swaps it for the dark ground', () => {
    const light = render(<Header title="t" version="1" theme="light" onToggleTheme={() => {}} />)
    const onLight = screen.getByAltText(APP_INFO.name).getAttribute('src')
    light.unmount()

    render(<Header title="t" version="1" theme="dark" onToggleTheme={() => {}} />)
    const onDark = screen.getByAltText(APP_INFO.name).getAttribute('src')
    expect(onLight).not.toBe(onDark)
  })
})
