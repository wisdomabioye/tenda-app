import { create } from 'zustand'
import type { Gig } from '@tenda/shared'
import { api } from '@/api/client'

interface UserGigsState {
  postedGigs: Gig[]
  workedGigs: Gig[]
  isLoading: boolean
  error: string | null
  fetchPostedGigs: (userId: string) => Promise<void>
  fetchWorkedGigs: (userId: string) => Promise<void>
  fetchAll: (userId: string) => Promise<void>
}

export const useUserGigsStore = create<UserGigsState>((set) => ({
  postedGigs: [],
  workedGigs: [],
  isLoading: false,
  error: null,

  fetchPostedGigs: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.users.gigs({ id: userId }, { role: 'poster', limit: 100 })
      set({ postedGigs: data, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  fetchWorkedGigs: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const { data } = await api.users.gigs({ id: userId }, { role: 'worker', limit: 100 })
      set({ workedGigs: data, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },

  fetchAll: async (userId) => {
    set({ isLoading: true, error: null })
    try {
      const [posted, worked] = await Promise.all([
        api.users.gigs({ id: userId }, { role: 'poster', limit: 100 }),
        api.users.gigs({ id: userId }, { role: 'worker', limit: 100 }),
      ])
      set({ postedGigs: posted.data, workedGigs: worked.data, isLoading: false })
    } catch (e) {
      set({ error: (e as Error).message, isLoading: false })
    }
  },
}))
