import { useState } from 'react'
import { View, ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
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

const COPY: Record<ContactMethod, { title: string; lede: string; label: string; placeholder: string; invalid: string }> = {
  phone: {
    title: 'Your phone number',
    lede: 'We’ll text you a 6-digit code to confirm it’s you.',
    label: 'Phone number',
    placeholder: '+2348012345678',
    invalid: 'Use international format, e.g. +2348012345678',
  },
  email: {
    title: 'Your email',
    lede: 'We’ll email you a 6-digit code to confirm it’s you.',
    label: 'Email',
    placeholder: 'you@example.com',
    invalid: 'Enter a valid email address',
  },
}

/**
 * Stage 9C contact step — collect a phone/email, issue the OTP challenge, then
 * route to verify-code. Its own route (not a get-started sub-view) so the
 * header AND Android hardware back pop cleanly to get-started.
 *
 * Layout: a ScrollView whose content container is `flexGrow:1 +
 * justifyContent:center` — the field block centres when there's room and stays
 * scroll-reachable / keyboard-pushed when the autofocus keyboard shrinks the
 * viewport (the earlier top-aligned/centred-View versions either jammed the
 * field to the top or let the keyboard cover it). The Input uses the `compact`
 * variant (label ABOVE the box) so nothing reads as overlapping. A bad/absent
 * `method` param falls back to phone so the screen can never render label-less.
 */
export default function ContinueWithScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { method } = useLocalSearchParams<{ method: string }>()
  const channel: ContactMethod = isContactMethod(method) ? method : 'phone'
  const copy = COPY[channel]

  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)

  const value = channel === 'phone' ? identifier.trim() : (normalizeEmail(identifier) ?? '')
  const valid = channel === 'phone' ? isE164(value) : value !== ''
  const showInvalid = identifier.trim() !== '' && !valid

  async function handleSendCode(): Promise<void> {
    if (!valid || busy) return
    setBusy(true)
    try {
      await api.auth.challenge({ method: channel, identifier: value })
      router.push({ pathname: '/(auth)/verify-code', params: { channel, identifier: value } })
    } catch (e) {
      const tier0 = classifyVerifyError(e)
      showToast(
        'error',
        tier0
          ? TIER0_MESSAGE[tier0]
          : e instanceof ApiClientError
            ? e.message
            : 'Something went wrong — please try again',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header showBack transparent />

        <ScrollView
          style={s.flex}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.hero}>
            <Text style={[s.title, { color: theme.colors.content.primary }]}>{copy.title}</Text>
            <Text size={14} style={s.lede} color={theme.colors.content.secondary}>
              {copy.lede}
            </Text>
          </View>

          <View style={s.form}>
            <Input
              variant="compact"
              label={copy.label}
              placeholder={copy.placeholder}
              value={identifier}
              onChangeText={setIdentifier}
              keyboardType={channel === 'phone' ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            {showInvalid && (
              <Text size={12.5} color={theme.colors.feedback.danger.base}>
                {copy.invalid}
              </Text>
            )}
            <Button variant="primary" size="xl" fullWidth loading={busy} disabled={!valid} onPress={() => void handleSendCode()}>
              Send code
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 32, gap: 28 },
  hero: { gap: 10 },
  title: { fontSize: 27, lineHeight: 33, fontWeight: '700', letterSpacing: -0.7 },
  lede: { lineHeight: 21 },
  form: { gap: 14 },
})
