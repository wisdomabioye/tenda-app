'use client'

/**
 * Email entry (mobile's continue-with, email branch). Sends the OTP challenge
 * ANONYMOUSLY — the server treats a present bearer as link intent and would
 * hard-401 a stale one. The identifier rides the in-memory signin-flow store,
 * never the URL (PII in query strings ends up in history and logs).
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { normalizeEmail, verifyErrorMessage } from '@tenda/shared'
import { api } from '@/api/client'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { AUTH_COPY } from '@/components/auth/copy'
import { Button, FormError, TextField } from '@/components/ui'
import { useSigninFlowStore } from '@/stores/signin-flow.store'

export default function SignInEmailPage() {
  const router = useRouter()
  const begin = useSigninFlowStore((s) => s.begin)
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const normalized = normalizeEmail(email) ?? ''
  const valid = normalized !== ''
  const showInvalid = email.trim() !== '' && !valid

  async function handleSendCode() {
    if (!valid || busy) return
    setBusy(true)
    setError(null)
    try {
      // `expires_in` is the server's own validity window; the verify step
      // counts it down rather than repeating a number typed into this app.
      const { expires_in } = await api.auth.challenge({ method: 'email', identifier: normalized })
      begin('email', normalized, expires_in ?? null)
      router.push('/signin/verify')
    } catch (e) {
      setError(verifyErrorMessage(e, AUTH_COPY.email.failed))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel
      title={AUTH_COPY.email.title}
      lede={AUTH_COPY.email.lede}
      back={{ href: '/signin', label: AUTH_COPY.email.back }}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSendCode()
        }}
      >
        <TextField
          label={AUTH_COPY.email.label}
          type="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          error={showInvalid ? AUTH_COPY.email.invalid : null}
        />
        <FormError message={error} />
        <Button type="submit" disabled={!valid || busy} fullWidth>
          {busy ? AUTH_COPY.email.sending : AUTH_COPY.email.cta}
        </Button>
      </form>

      {/* Answers the question this step actually raises: someone who cannot
          remember whether they already signed up needs to know that typing
          the address is safe either way. */}
      <p className="mt-4 text-[13px] leading-5 text-content-tertiary">
        {AUTH_COPY.email.collision}
      </p>
    </AuthPanel>
  )
}
