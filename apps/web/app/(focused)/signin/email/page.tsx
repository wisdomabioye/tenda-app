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
      await api.auth.challenge({ method: 'email', identifier: normalized })
      begin('email', normalized)
      router.push('/signin/verify')
    } catch (e) {
      setError(verifyErrorMessage(e, 'Something went wrong, please try again'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPanel title="Your email" lede="We’ll email you a 6-digit code to confirm it’s you.">
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSendCode()
        }}
      >
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
          error={showInvalid ? 'Enter a valid email address' : null}
        />
        <FormError message={error} />
        <Button type="submit" disabled={!valid || busy} fullWidth>
          {busy ? 'Sending…' : 'Send code'}
        </Button>
      </form>
    </AuthPanel>
  )
}
