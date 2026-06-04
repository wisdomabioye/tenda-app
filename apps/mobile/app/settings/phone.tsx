import { useState } from 'react'
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { ScreenContainer, Text, Header, Button, showToast } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { api, ApiClientError } from '@/api/client'
import { isE164 } from '@tenda/shared'
import { spacing } from '@/theme/tokens'

/**
 * Settings → Verify phone (stage-1-onboarding.md): users who skipped the
 * OTP at signup verify here; the server then dispatches the retroactive
 * gas seed if a Solana wallet is linked and no prior grant exists.
 */
export default function PhoneSettingsScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const [phone, setPhone] = useState('')
  const [isSending, setIsSending] = useState(false)

  const trimmed = phone.trim()
  const valid = isE164(trimmed)

  async function handleSend() {
    if (!valid || isSending) return
    setIsSending(true)
    try {
      await api.auth.sendPhoneOtp({ phone_e164: trimmed })
      // replace: the OTP screen's back returns to Settings, not here.
      router.replace({ pathname: '/(auth)/verify-phone', params: { phone: trimmed, next: 'back' } })
    } catch (e) {
      showToast('error', e instanceof ApiClientError ? e.message : 'Could not send the code — please try again')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header title="Verify your phone" showBack onBackPress={() => router.back()} />

        <View style={s.body}>
          <Text size={13.5} color={theme.colors.content.secondary} style={s.lede}>
            We&apos;ll text you a 6-digit code. Verified accounts get a one-time
            SOL top-up to cover network fees.
          </Text>

          <Input
            label="Phone number"
            placeholder="+2348012345678"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
          {trimmed !== '' && !valid && (
            <Text size={12} color={theme.colors.feedback.danger.base}>
              Use international format, e.g. +2348012345678
            </Text>
          )}

          <Button variant="primary" size="lg" fullWidth loading={isSending} disabled={!valid} onPress={() => void handleSend()}>
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
