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
  /**
   * How long the SERVER said this code is good for, in seconds — or null when
   * it did not say.
   *
   * The challenge response has always carried `expires_in` and both call sites
   * threw it away, so the verify step could only say "it is valid for a while".
   * Kept here so the countdown is the server's number rather than a constant
   * this app would have to keep in step with the OTP service by hand. The
   * field is OPTIONAL on the wire ("OTP channels only"), and null propagates
   * rather than defaulting: a countdown invented from a guessed TTL would tell
   * someone their code is dead while it still works, or the reverse.
   */
  expiresIn: number | null
}

interface SigninFlowState {
  pending: PendingChallenge | null
  begin: (channel: OtpChannel, identifier: string, expiresIn: number | null) => void
  markResent: (expiresIn: number | null) => void
  clear: () => void
}

export const useSigninFlowStore = create<SigninFlowState>((set) => ({
  pending: null,
  begin: (channel, identifier, expiresIn) =>
    set({ pending: { channel, identifier, sentAt: Date.now(), expiresIn } }),
  // A resend restarts BOTH clocks: the new code has its own validity window,
  // and the old one's remaining time says nothing about it.
  markResent: (expiresIn) =>
    set((s) => (s.pending === null ? {} : { pending: { ...s.pending, sentAt: Date.now(), expiresIn } })),
  clear: () => set({ pending: null }),
}))
