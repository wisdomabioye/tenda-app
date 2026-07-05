/**
 * "My gigs" store (post-#34): own listings via GET /v1/gigs?mine=,
 * identity rides the JWT, all statuses included (drafts too), and rows
 * are full GigSummary so the card components render unchanged.
 */
import { create } from 'zustand'
import type { GigSummary } from '@tenda/shared'
import { api } from '@/api/client'

interface UserGigsState {
  postedGigs: GigSummary[]
  workedGigs: GigSummary[]
  isLoading: boolean
  error: string | null
  fetchPostedGigs: () => Promise<void>
  fetchWorkedGigs: () => Promise<void>
  fetchAll: () => Promise<void>
}

export const useUserGigsStore = create<UserGigsState>((set) => ({
  postedGigs: [],
  workedGigs: [],
  isLoading: false,
  error: null,

  fetchPostedGigs: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.gigs.list({ mine: 'created', limit: 100 })
      set({ postedGigs: data, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  fetchWorkedGigs: async () => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.gigs.list({ mine: 'working', limit: 100 })
      set({ workedGigs: data, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  fetchAll: async () => {
    set({ isLoading: true, error: null })
    try {
      const [posted, worked] = await Promise.all([
        api.gigs.list({ mine: 'created', limit: 100 }),
        api.gigs.list({ mine: 'working', limit: 100 }),
      ])
      set({ postedGigs: posted.data, workedGigs: worked.data, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },
}))
