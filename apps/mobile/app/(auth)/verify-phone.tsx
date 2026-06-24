import { useEffect, useRef, useState } from 'react'
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ScreenContainer, Text, Header, Button, showToast } from '@/components/ui'
import { useAuthStore } from '@/stores/auth.store'
import { api, ApiClientError } from '@/api/client'
import { usePostAuthReset } from '@/lib/post-auth-nav'
import { typography } from '@/theme/tokens'

const CODE_LENGTH = 6
const RESEND_COOLDOWN_S = 60

/**
 * 6-digit OTP entry (stage-1-onboarding.md). Reached from profile-setup
 * (next=home, skippable) or settings (next=back). The server invalidates
 * the code after 5 wrong attempts; resend is rate-limited to 3/phone/hour.
 */
export default function VerifyPhoneScreen() {
  const { phone, next } = useLocalSearchParams<{ phone: string; next?: string }>()
  const router = useRouter()
  const resetToAuthedRoot = usePostAuthReset()
  const { theme } = useUnistyles()

  const [code, setCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_S)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((cd) => cd - 1), 1_000)
    return () => clearTimeout(t)
  }, [cooldown])

  function finish() {
    // Phone state changed server-side — refresh wallets/phone flags.
    void useAuthStore.getState().refreshMe()
    // From settings → just pop back. From onboarding (next=home) → reset so
    // back from home exits instead of returning to the auth/onboarding stack.
    if (next === 'back') router.back()
    else resetToAuthedRoot(true)
  }

  async function handleVerify(value: string) {
    if (!phone || value.length !== CODE_LENGTH || isVerifying) return
    setIsVerifying(true)
    try {
      await api.auth.verifyPhoneOtp({ phone_e164: phone, code: value })
      showToast('success', 'Phone verified')
      finish()
    } catch (e) {
      setCode('')
      const msg = e instanceof ApiClientError ? e.message : 'Verification failed — please try again'
      showToast('error', msg)
    } finally {
      setIsVerifying(false)
    }
  }

  async function handleResend() {
    if (!phone || cooldown > 0) return
    try {
      await api.auth.sendPhoneOtp({ phone_e164: phone })
      setCooldown(RESEND_COOLDOWN_S)
      showToast('success', 'Code sent')
    } catch (e) {
      const msg = e instanceof ApiClientError ? e.message : 'Could not resend the code'
      showToast('error', msg)
    }
  }

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (digits.length === CODE_LENGTH) void handleVerify(digits)
  }

  const cells = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? '')

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Verify your phone" showBack transparent />

        <View style={s.body}>
          <Text style={[s.lede, { color: theme.colors.content.secondary }]}>
            Enter the 6-digit code we sent to{' '}
            <Text style={[s.phone, { color: theme.colors.content.primary }]}>{phone}</Text>.
          </Text>

          {/* Hidden input drives the six display cells. */}
          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={handleChange}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            autoFocus
            style={s.hiddenInput}
            accessibilityLabel="One-time code"
          />
          <View style={s.cellRow} onTouchStart={() => inputRef.current?.focus()}>
            {cells.map((c, i) => (
              <View
                key={i}
                style={[
                  s.cell,
                  {
                    backgroundColor: theme.colors.surface.card,
                    borderColor: i === code.length ? theme.colors.brand.primary : theme.colors.border.default,
                  },
                ]}
              >
                <Text style={[s.cellText, { color: theme.colors.content.primary }]}>{c}</Text>
              </View>
            ))}
          </View>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isVerifying}
            disabled={code.length !== CODE_LENGTH}
            onPress={() => void handleVerify(code)}
          >
            Verify
          </Button>

          <Button variant="ghost" size="md" fullWidth disabled={cooldown > 0} onPress={() => void handleResend()}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Button>

          {next !== 'back' && (
            <Button variant="ghost" size="md" fullWidth onPress={finish}>
              Skip for now
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 16, gap: 14 },
  lede: { fontSize: 14, lineHeight: 20, marginTop: 8 },
  phone: { fontFamily: typography.fonts.body.semibold },
  hiddenInput: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  cellRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 10 },
  cell: {
    width: 46,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellText: { fontSize: 22, fontFamily: typography.fonts.body.semibold },
})
