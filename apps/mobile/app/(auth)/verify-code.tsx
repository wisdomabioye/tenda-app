import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ScreenContainer, Text, Header, Button, showToast } from '@/components/ui'
import { useAuthStore } from '@/stores/auth.store'
import { api, ApiClientError } from '@/api/client'
import { classifyVerifyError, TIER0_MESSAGE } from '@/lib/auth-flow'
import { usePostAuthReset } from '@/lib/post-auth-nav'
import { typography } from '@/theme/tokens'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_S = 60

/** OTP channels that reach this screen (phone SMS or email). */
type OtpChannel = 'phone' | 'email'

/**
 * Generic OTP entry for the unified sign-in (Stage 9C) — phone OR email.
 * Reached from the get-started screen after a challenge was issued. Verifying
 * sets the session (signInWithVerify) and routes to home or profile setup.
 * IDENTITY_ALREADY_LINKED surfaces the Tier-0 message (block, no merge).
 */
export default function VerifyCodeScreen() {
  const { channel, identifier } = useLocalSearchParams<{ channel: OtpChannel; identifier: string }>()
  const { theme } = useUnistyles()
  const signInWithVerify = useAuthStore((s) => s.signInWithVerify)
  const resetToAuthedRoot = usePostAuthReset()

  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((cd) => cd - 1), 1_000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleVerify(value: string) {
    if (!channel || !identifier || value.length !== CODE_LENGTH || isVerifying) return
    setIsVerifying(true)
    try {
      await signInWithVerify({ method: channel, identifier, code: value })
      // reset (not replace) so back can't return to the auth stack after sign-in.
      resetToAuthedRoot(useAuthStore.getState().profileComplete)
    } catch (e) {
      setCode('')
      const tier0 = classifyVerifyError(e)
      const msg = tier0
        ? TIER0_MESSAGE[tier0]
        : e instanceof ApiClientError
          ? e.message
          : 'Verification failed — please try again'
      showToast('error', msg)
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (!channel || !identifier || cooldown > 0) return
    try {
      await api.auth.challenge({ method: channel, identifier })
      setCooldown(RESEND_COOLDOWN_S)
      showToast('success', 'A new code is on its way')
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not resend the code')
    }
  }

  const destination = channel === 'email' ? 'email' : 'phone'

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Enter your code" showBack transparent />
        <View style={s.body}>
          <Text style={[s.lede, { color: theme.colors.content.secondary }]}>
            We sent a 6-digit code to your {destination}. Enter it below to continue.
          </Text>

          <TextInput
            ref={inputRef}
            style={[s.codeInput, { color: theme.colors.content.primary, borderColor: theme.colors.border.default }]}
            value={code}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '').slice(0, CODE_LENGTH)
              setCode(digits)
              if (digits.length === CODE_LENGTH) void handleVerify(digits)
            }}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            editable={!isVerifying}
            accessibilityLabel="Verification code"
          />

          <Button variant="primary" size="lg" fullWidth loading={isVerifying}
            disabled={code.length !== CODE_LENGTH} onPress={() => handleVerify(code)}>
            Verify
          </Button>

          <Button variant="ghost" size="md" fullWidth disabled={cooldown > 0} onPress={handleResend}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Button>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  lede: { fontSize: 14, lineHeight: 21 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 16,
    textAlign: 'center',
    fontSize: 28,
    letterSpacing: 8,
    fontFamily: typography.fonts.mono,
  },
})
