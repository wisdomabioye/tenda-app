import { useEffect, useState } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { Mail, Phone, Wallet, ArrowLeft } from 'lucide-react-native'
import { isE164, normalizeEmail } from '@tenda/shared'
import { ScreenContainer, Text, Header, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { useAuthStore } from '@/stores/auth.store'
import { api, ApiClientError } from '@/api/client'
import { signInWithGoogle, configureGoogleSignIn, GoogleSignInError } from '@/lib/google-signin'
import { signInWithApple, isAppleAvailable, AppleSignInError } from '@/lib/apple-signin'
import { classifyVerifyError, TIER0_MESSAGE, postAuthRoute } from '@/lib/auth-flow'

type Busy = null | 'google' | 'apple' | 'contact'
type ContactMode = null | 'phone' | 'email'

/**
 * Stage 9C get-started — the multi-method entry. Phone/email issue an OTP then
 * route to verify-code; Google/Apple verify an id_token inline; wallet routes
 * to the existing connect-wallet flow. A new account is born from a
 * contact-bearing method (decision #3 — wallet signs in, never creates).
 */
export default function GetStartedScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const signInWithVerify = useAuthStore((s) => s.signInWithVerify)

  const [busy, setBusy] = useState<Busy>(null)
  const [appleAvailable, setAppleAvailable] = useState(false)
  const [contactMode, setContactMode] = useState<ContactMode>(null)
  const [identifier, setIdentifier] = useState('')

  useEffect(() => {
    void isAppleAvailable().then(setAppleAvailable)
    // Client IDs are USER-ACTION env (undefined → Google sign-in fails cleanly).
    configureGoogleSignIn(
      process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    )
  }, [])

  function reportError(e: unknown): void {
    const tier0 = classifyVerifyError(e)
    showToast(
      'error',
      tier0
        ? TIER0_MESSAGE[tier0]
        : e instanceof ApiClientError
          ? e.message
          : 'Something went wrong — please try again',
    )
  }

  function afterAuth(): void {
    router.replace(postAuthRoute(useAuthStore.getState().profileComplete))
  }

  async function handleGoogle(): Promise<void> {
    setBusy('google')
    try {
      const idToken = await signInWithGoogle()
      await signInWithVerify({ method: 'google', id_token: idToken })
      afterAuth()
    } catch (e) {
      if (e instanceof GoogleSignInError && e.reason === 'cancelled') return
      reportError(e)
    } finally {
      setBusy(null)
    }
  }

  async function handleApple(): Promise<void> {
    setBusy('apple')
    try {
      const { idToken } = await signInWithApple()
      await signInWithVerify({ method: 'apple', id_token: idToken })
      afterAuth()
    } catch (e) {
      if (e instanceof AppleSignInError && e.reason === 'cancelled') return
      reportError(e)
    } finally {
      setBusy(null)
    }
  }

  async function handleContinueContact(): Promise<void> {
    if (contactMode === null) return
    const value =
      contactMode === 'phone' ? identifier.trim() : (normalizeEmail(identifier) ?? '')
    const valid = contactMode === 'phone' ? isE164(value) : value !== ''
    if (!valid) {
      showToast('error', `Enter a valid ${contactMode} ${contactMode === 'phone' ? '(+234…)' : 'address'}`)
      return
    }
    setBusy('contact')
    try {
      await api.auth.challenge({ method: contactMode, identifier: value })
      router.push({ pathname: '/(auth)/verify-code', params: { channel: contactMode, identifier: value } })
    } catch (e) {
      reportError(e)
    } finally {
      setBusy(null)
    }
  }

  const anyBusy = busy !== null

  // Contact sub-view: collect the phone/email, then issue the OTP.
  if (contactMode !== null) {
    return (
      <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
        <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Header title={contactMode === 'phone' ? 'Your phone number' : 'Your email'} showBack transparent />
          <View style={s.body}>
            <Input
              label={contactMode === 'phone' ? 'Phone number' : 'Email'}
              placeholder={contactMode === 'phone' ? '+2348012345678' : 'you@example.com'}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={contactMode === 'phone' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoFocus
            />
            <Button variant="primary" size="lg" fullWidth loading={busy === 'contact'} onPress={handleContinueContact}>
              Send code
            </Button>
            <Button
              variant="ghost"
              size="md"
              fullWidth
              icon={<ArrowLeft size={16} color={theme.colors.content.secondary} />}
              onPress={() => { setContactMode(null); setIdentifier('') }}
            >
              Back to all options
            </Button>
          </View>
        </KeyboardAvoidingView>
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <View style={s.flex}>
        <Header title="Get started" transparent />
        <View style={s.body}>
          <Text style={[s.lede, { color: theme.colors.content.secondary }]}>
            Choose how you’d like to continue. You can link a wallet later when you’re ready to transact.
          </Text>

          <Button variant="outline" size="lg" fullWidth loading={busy === 'google'} disabled={anyBusy}
            onPress={handleGoogle}>
            Continue with Google
          </Button>

          {appleAvailable && (
            <Button variant="outline" size="lg" fullWidth loading={busy === 'apple'} disabled={anyBusy}
              onPress={handleApple}>
              Continue with Apple
            </Button>
          )}

          <Button variant="outline" size="lg" fullWidth disabled={anyBusy}
            icon={<Phone size={18} color={theme.colors.content.primary} />}
            onPress={() => setContactMode('phone')}>
            Continue with phone
          </Button>

          <Button variant="outline" size="lg" fullWidth disabled={anyBusy}
            icon={<Mail size={18} color={theme.colors.content.primary} />}
            onPress={() => setContactMode('email')}>
            Continue with email
          </Button>

          <Button variant="ghost" size="md" fullWidth disabled={anyBusy}
            icon={<Wallet size={16} color={theme.colors.content.secondary} />}
            onPress={() => router.push('/(auth)/connect-wallet')}>
            Sign in with a wallet
          </Button>
        </View>
      </View>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  lede: { fontSize: 14, lineHeight: 21, marginBottom: 4 },
})
