/**
 * Gig DETAIL store, DISPLAY ONLY post-#34. Detail comes from the read
 * surface (/v1/gigs/:id over escrows ⨝ gig_details); every lifecycle
 * transition goes through the escrow store + wallet dispatch
 * (signSendAndReport). The one off-chain action kept here is the
 * post-completion review.
 *
 * The browse LIST is deliberately not here: it is paginated, filter-scoped
 * and screen-local, so it lives in `usePaginatedList` via `useHomeFeed`.
 * Holding a single global page of gigs was what let a background poll
 * collapse the user's scrolled pages.
 */
import { create } from 'zustand'
import type { GigDetail, ReviewInput } from '@tenda/shared'
import { api } from '@/api/client'
import { classifyDetailLoadError, type DetailLoadError } from '@/lib/detail-load-error'

/**
 * A failed load, and WHICH gig it was for.
 *
 * The id is carried inside the error rather than beside it: this store holds
 * one slot for every gig, so a bare message cannot say what failed, and after
 * any failure opening a different gig would show the previous one's error for
 * the frame before its own fetch starts. One object instead of three
 * independently-nullable fields that must be read together to mean anything.
 */
export interface GigLoadError extends DetailLoadError {
  id: string
}

interface GigsState {
  selectedGig: GigDetail | null
  isLoading: boolean
  error: GigLoadError | null

  fetchGigDetail: (id: string) => Promise<void>
  reviewEscrow: (id: string, input: ReviewInput) => Promise<void>
}

export const useGigsStore = create<GigsState>((set) => ({
  selectedGig: null,
  isLoading: false,
  error: null,

  fetchGigDetail: async (id) => {
    set((state) => ({
      isLoading: true,
      error: null,
      // Drop a gig that is not the one being loaded. Holding it while a
      // different id is in flight is what let a screen render the previous
      // gig — and, since approval mode, the previous VIEWER's actions.
      selectedGig: state.selectedGig?.escrow_id === id ? state.selectedGig : null,
    }))
    try {
      const gig = await api.gigs.get({ id })
      set({ selectedGig: gig, isLoading: false })
    } catch (e) {
      const failure = classifyDetailLoadError(e)
      // A `gone` refetch DROPS the gig it was refreshing. Without this, a gig
      // deleted or taken down mid-session kept rendering from the previous
      // response — pull-to-refresh 404ing quietly while every action button
      // stayed live — because the screen only shows an error when the slot is
      // empty. A transient failure deliberately does NOT drop it: blanking a
      // good screen on one lost packet is the opposite mistake.
      set((state) => ({
        error: { id, ...failure },
        isLoading: false,
        selectedGig:
          failure.gone && state.selectedGig?.escrow_id === id ? null : state.selectedGig,
      }))
    }
  },

  reviewEscrow: async (id, input) => {
    set({ isLoading: true })
    try {
      await api.escrows.review({ id }, input)
      set({ isLoading: false })
    } catch (e) {
      set({ isLoading: false })
      throw e
    }
  },
}))
