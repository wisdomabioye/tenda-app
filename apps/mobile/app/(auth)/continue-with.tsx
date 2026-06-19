import { useState } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { isE164, normalizeEmail } from '@tenda/shared'
import { ScreenContainer, Text, Header, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { api, ApiClientError } from '@/api/client'
import { classifyVerifyError, TIER0_MESSAGE } from '@/lib/auth-flow'

/** The two contact channels that issue an OTP from this screen. */
type ContactMethod = 'phone' | 'email'

function isContactMethod(v: string | undefined): v is ContactMethod {
  return v === 'phone' || v === 'email'
}

const COPY: Record<ContactMethod, { title: string; subtitle: string; label: string; placeholder: string; invalid: string }> = {
  phone: {
    title: 'Your phone number',
    subtitle: 'We’ll text you a 6-digit code to confirm it’s you.',
    label: 'Phone number',
    placeholder: '+2348012345678',
    invalid: 'Enter a valid phone number (+234…)',
  },
  email: {
    title: 'Your email',
    subtitle: 'We’ll email you a 6-digit code to confirm it’s you.',
    label: 'Email',
    placeholder: 'you@example.com',
    invalid: 'Enter a valid email address',
  },
}

/**
 * Stage 9C contact step — collect a phone/email, issue the OTP challenge, then
 * route to verify-code. Its own route (not a get-started sub-view) so the
 * header AND Android hardware back pop cleanly to get-started, and the form can
 * centre itself. The `method` param decides the channel; a bad/absent param
 * falls back to phone so the screen can never render label-less.
 */
export default function ContinueWithScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { method } = useLocalSearchParams<{ method: string }>()
  const channel: ContactMethod = isContactMethod(method) ? method : 'phone'
  const copy = COPY[channel]

  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)

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

  async function handleSendCode(): Promise<void> {
    const value = channel === 'phone' ? identifier.trim() : (normalizeEmail(identifier) ?? '')
    const valid = channel === 'phone' ? isE164(value) : value !== ''
    if (!valid) {
      showToast('error', copy.invalid)
      return
    }
    setBusy(true)
    try {
      await api.auth.challenge({ method: channel, identifier: value })
      router.push({ pathname: '/(auth)/verify-code', params: { channel, identifier: value } })
    } catch (e) {
      reportError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header showBack transparent />
        <View style={s.body}>
          <View style={s.hero}>
            <Text style={[s.title, { color: theme.colors.content.primary }]}>{copy.title}</Text>
            <Text style={[s.subtitle, { color: theme.colors.content.secondary }]}>{copy.subtitle}</Text>
          </View>

          <View style={s.form}>
            <Input
              label={copy.label}
              placeholder={copy.placeholder}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={channel === 'phone' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <Button variant="primary" size="xl" fullWidth loading={busy} onPress={handleSendCode}>
              Send code
            </Button>
          </View>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 20, justifyContent: 'center', gap: 28 },
  hero: { alignItems: 'center', gap: 8 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: -0.6, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  form: { gap: 16 },
})
