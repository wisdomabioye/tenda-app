'use client'

import { useSyncExternalStore } from 'react'
import { Moon, Sun } from 'lucide-react'
import { applyTheme, themeStore } from '@/lib/theme'

/**
 * Light/dark toggle over the data-theme contract. Reads the preference
 * through the theme store's useSyncExternalStore seam: the server snapshot
 * is 'system', the client one is the stored choice, and React reconciles
 * them at hydration without a mismatch or a setState-in-effect.
 */
export function ThemeToggle() {
  const preference = useSyncExternalStore(
    themeStore.subscribe,
    themeStore.getSnapshot,
    themeStore.getServerSnapshot,
  )

  function toggle() {
    const isDark =
      preference === 'dark' ||
      (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    applyTheme(isDark ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle theme"
      className="rounded-control p-2 text-content-secondary hover:bg-surface-inset hover:text-content-primary"
    >
      {preference === 'dark' ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
    </button>
  )
}
