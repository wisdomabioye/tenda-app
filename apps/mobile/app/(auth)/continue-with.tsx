import { useState } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { isE164, normalizeEmail } from '@tenda/shared'
import { spacing } from '@/theme/tokens'
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
 * header AND Android hardware back pop cleanly to get-started. Layout mirrors
 * settings/phone (the canonical single-input screen): top-aligned under a
 * titled header, default inset Input, inline validation, button disabled until
 * valid — so the focused field stays clear of the keyboard. A bad/absent
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
        <Header title={copy.title} showBack />

        <View style={s.body}>
          <Text size={13.5} color={theme.colors.content.secondary} style={s.lede}>
            {copy.lede}
          </Text>

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
          {showInvalid && (
            <Text size={12} color={theme.colors.feedback.danger.base}>
              {copy.invalid}
            </Text>
          )}

          <Button variant="primary" size="lg" fullWidth loading={busy} disabled={!valid} onPress={() => void handleSendCode()}>
            Send code
          </Button>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, padding: spacing.md, gap: 12 },
  lede: { lineHeight: 19 },
})
