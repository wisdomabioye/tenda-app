import { create } from 'zustand'

/**
 * Ephemeral state between the contact step and the OTP step. Mobile passes
 * these as navigation params; on web that would put the EMAIL IN THE URL
 * (history, logs, referrers), so the pending challenge rides in memory and
 * /signin/verify bounces back to /signin/email when it is absent (reload,
 * deep link).
 */
export type OtpChannel = 'email' | 'phone'

interface PendingChallenge {
  channel: OtpChannel
  identifier: string
  /** Drives the resend cooldown across the email → verify navigation. */
  sentAt: number
}

interface SigninFlowState {
  pending: PendingChallenge | null
  begin: (channel: OtpChannel, identifier: string) => void
  markResent: () => void
  clear: () => void
}

export const useSigninFlowStore = create<SigninFlowState>((set) => ({
  pending: null,
  begin: (channel, identifier) => set({ pending: { channel, identifier, sentAt: Date.now() } }),
  markResent: () => set((s) => (s.pending === null ? {} : { pending: { ...s.pending, sentAt: Date.now() } })),
  clear: () => set({ pending: null }),
}))
