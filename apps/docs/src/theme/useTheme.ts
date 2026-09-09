/**
 * Which side of every `light-dark()` pair this page shows.
 *
 * Three states, not two: no stamp means "follow the system", and the two
 * stamps override it in either direction — the same contract the landing's
 * ThemeProvider has, because both read the same generated tokens.
 *
 * Local to this app rather than shared: `@tenda/shared` is deliberately
 * React-free and zero-dependency, so every client keeps its own small theme
 * hook (mobile has one, the landing has one). What IS shared is the token file
 * they all render, which is the part that could drift.
 */
import { useCallback, useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark'

const STORAGE_KEY = 'tenda-docs-theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * `matchMedia` is absent in some environments (jsdom without a shim, very old
 * browsers). A docs page that threw there would render nothing at all, so the
 * missing case resolves to light rather than crashing.
 */
const media = (): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(DARK_QUERY) : null

const systemTheme = (): ThemeChoice => (media()?.matches === true ? 'dark' : 'light')

/** The stored choice, or null when the reader has never chosen. */
export function storedTheme(
  storage: Pick<Storage, 'getItem'> | undefined = globalThis.localStorage,
): ThemeChoice | null {
  try {
    const saved = storage?.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : null
  } catch {
    // A browser with storage blocked still gets a working page — it just
    // follows the system every visit.
    return null
  }
}

export function useTheme(): { theme: ThemeChoice; chosen: boolean; toggle: () => void } {
  const [choice, setChoice] = useState<ThemeChoice | null>(() => storedTheme())
  const [system, setSystem] = useState<ThemeChoice>(systemTheme)

  useEffect(() => {
    const query = media()
    if (query === null) return
    const onChange = (): void => { setSystem(query.matches ? 'dark' : 'light') }
    query.addEventListener('change', onChange)
    return () => { query.removeEventListener('change', onChange) }
  }, [])

  const theme = choice ?? system

  useEffect(() => {
    // No stamp while the reader is following the system: the un-stamped state
    // is the one `color-scheme: light dark` is written for.
    if (choice === null) document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', choice)
  }, [choice])

  const toggle = useCallback(() => {
    setChoice((current) => {
      const next: ThemeChoice = (current ?? systemTheme()) === 'dark' ? 'light' : 'dark'
      try { globalThis.localStorage?.setItem(STORAGE_KEY, next) } catch { /* storage blocked — the choice lasts this visit */ }
      return next
    })
  }, [])

  return { theme, chosen: choice !== null, toggle }
}
