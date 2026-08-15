import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@/components/app/ThemeToggle'
import { THEME_STORAGE_KEY } from '@/lib/theme'

beforeEach(() => {
  window.localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('ThemeToggle', () => {
  it('system (light-matching) → dark on first toggle', async () => {
    render(<ThemeToggle />)
    await userEvent.click(screen.getByLabelText('Toggle theme'))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('dark → light on the next toggle', async () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    document.documentElement.dataset.theme = 'dark'
    render(<ThemeToggle />)
    await userEvent.click(screen.getByLabelText('Toggle theme'))
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
