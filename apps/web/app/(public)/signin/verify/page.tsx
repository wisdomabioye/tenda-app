'use client'

/**
 * OTP entry (mobile's verify-code, sign-in mode). Auto-verifies at 6 digits,
 * clears the field on failure, 60s resend cooldown carried in the flow store
 * so navigation does not reset it. Success routes by the server's own
 * profile-complete predicate: /home or /onboarding/profile.
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { verifyErrorMessage } from '@tenda/shared'
import { api } from '@/api/client'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { Button, FormError } from '@/components/ui'
import { OtpCodeField } from '@/components/auth/OtpCodeField'
import { useAuthStore } from '@/stores/auth.store'
import { useSigninFlowStore } from '@/stores/signin-flow.store'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_S = 60

function cooldownLeft(sentAt: number): number {
  return Math.max(0, RESEND_COOLDOWN_S - Math.floor((Date.now() - sentAt) / 1_000))
}

export default function SignInVerifyPage() {
  const router = useRouter()
  const pending = useSigninFlowStore((s) => s.pending)
  const markResent = useSigninFlowStore((s) => s.markResent)
  const clearFlow = useSigninFlowStore((s) => s.clear)
  const signInWithVerify = useAuthStore((s) => s.signInWithVerify)

  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(() => (pending !== null ? cooldownLeft(pending.sentAt) : 0))
  // A successful verify clears the flow store, which would otherwise trip the
  // no-pending bounce below and race the post-sign-in navigation.
  const succeeded = useRef(false)

  // Reload or deep link: there is no pending challenge in memory — restart.
  useEffect(() => {
    if (pending === null && !succeeded.current) router.replace('/signin/email')
  }, [pending, router])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((s) => s - 1), 1_000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleVerify(value: string) {
    if (pending === null || value.length !== CODE_LENGTH || verifying) return
    setVerifying(true)
    setError(null)
    try {
      await signInWithVerify({ method: pending.channel, identifier: pending.identifier, code: value })
      succeeded.current = true
      const { profileComplete } = useAuthStore.getState()
      router.replace(profileComplete === true ? '/home' : '/onboarding/profile')
      clearFlow()
    } catch (e) {
      setCode('')
      setError(verifyErrorMessage(e, 'Verification failed, please try again'))
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    if (pending === null || cooldown > 0) return
    setError(null)
    try {
      await api.auth.challenge({ method: pending.channel, identifier: pending.identifier })
      markResent()
      setCooldown(RESEND_COOLDOWN_S)
    } catch (e) {
      setError(verifyErrorMessage(e, 'Could not resend the code'))
    }
  }

  if (pending === null) return null

  return (
    <AuthPanel
      title="Enter your code"
      lede={`We sent a 6-digit code to your ${pending.channel}. Enter it below to continue.`}
    >
      <div className="flex flex-col gap-3">
        <OtpCodeField
          value={code}
          onChange={(digits) => {
            setCode(digits)
            if (digits.length === CODE_LENGTH) void handleVerify(digits)
          }}
          length={CODE_LENGTH}
          autoFocus
          disabled={verifying}
        />
        <FormError message={error} />
        <Button
          disabled={code.length !== CODE_LENGTH || verifying}
          onClick={() => void handleVerify(code)}
          fullWidth
        >
          {verifying ? 'Verifying…' : 'Verify'}
        </Button>
        <Button variant="ghost" disabled={cooldown > 0} onClick={() => void handleResend()} fullWidth>
          {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
        </Button>
      </div>
    </AuthPanel>
  )
}
