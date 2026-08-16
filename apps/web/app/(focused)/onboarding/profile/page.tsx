'use client'

/**
 * First-run profile (mobile's profile-setup, name-first web cut): a name is
 * all that's required; avatar/location arrive with the Stage-6 profile
 * editor. Requires a session — the OTP step just created one — and updates
 * profileComplete from the SERVER'S response, not a local guess.
 */
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ApiClientError } from '@tenda/shared'
import { api } from '@/api/client'
import { AuthPanel } from '@/components/auth/AuthPanel'
import { Button, FormError, TextField } from '@/components/ui'
import { useAuthStore } from '@/stores/auth.store'

export default function OnboardingProfilePage() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const loadSession = useAuthStore((s) => s.loadSession)

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Arriving straight from verify the store is warm; on a hard reload it
  // bootstraps here. Unauthenticated visitors go to the method chooser.
  useEffect(() => {
    if (isLoading) void loadSession()
  }, [isLoading, loadSession])
  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/signin')
  }, [isLoading, isAuthenticated, router])
  useEffect(() => {
    if (user !== null) {
      setFirstName((current) => (current === '' ? user.first_name : current))
      setLastName((current) => (current === '' ? user.last_name : current))
    }
  }, [user])

  const canSubmit = firstName.trim() !== '' && lastName.trim() !== '' && !saving

  async function handleSubmit() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      // is_seeker is deliberately NOT sent: it is the Solana Seeker DEVICE
      // fee-tier flag (device-derived at signup, see mobile lib/device.ts),
      // not a preference a web form may set.
      const updated = await api.users.updateMe({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      })
      useAuthStore.getState().setProfileComplete(updated.profile_complete)
      void useAuthStore.getState().refreshUser()
      router.replace('/home')
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : 'Could not save your profile, please try again')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading || !isAuthenticated) return null

  return (
    <AuthPanel
      title="Set up your profile"
      lede="A name is all you need to start. Everything else is optional — add a photo and location later from Settings."
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void handleSubmit()
        }}
      >
        <TextField
          label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="e.g. Akin"
          autoFocus
        />
        <TextField
          label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="e.g. Beela"
        />
        <FormError message={error} />
        <Button type="submit" disabled={!canSubmit} fullWidth>
          {saving ? 'Saving…' : 'Finish'}
        </Button>
      </form>
    </AuthPanel>
  )
}
