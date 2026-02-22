import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { UnistylesRuntime } from 'react-native-unistyles'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'tenda_settings'

interface SettingsState {
  theme: Theme
  currency: 'NGN'
  loadSettings: () => Promise<void>
  setTheme: (theme: Theme) => void
  setCurrency: (currency: 'NGN') => void
}

function applyTheme(theme: Theme) {
  if (theme === 'system') {
    UnistylesRuntime.setAdaptiveThemes(true)
  } else {
    UnistylesRuntime.setAdaptiveThemes(false)
    UnistylesRuntime.setTheme(theme)
  }
}

async function persist(state: { theme: Theme; currency: 'NGN' }) {
  await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(state))
}

export const useSettingsStore = create<SettingsState>((set) => ({
  theme: 'system',
  currency: 'NGN',

  loadSettings: async () => {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as { theme?: Theme; currency?: 'NGN' }
      const theme = saved.theme ?? 'system'
      const currency = saved.currency ?? 'NGN'
      set({ theme, currency })
      applyTheme(theme)
    } catch {
      // Use defaults if storage is corrupt
    }
  },

  setTheme: (theme) => {
    set({ theme })
    applyTheme(theme)
    persist({ theme, currency: 'NGN' }).catch(() => {})
  },

  setCurrency: (currency) => {
    set({ currency })
    useSettingsStore.getState()
    persist({ theme: useSettingsStore.getState().theme, currency }).catch(() => {})
  },
}))
