import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import { Text } from '@/components/ui/Text'
import type { ExchangeOfferDetail } from '@tenda/shared'

interface Props {
  offer:    ExchangeOfferDetail
  isBuyer:  boolean
}

function computeDeadline(offer: ExchangeOfferDetail): Date | null {
  if (offer.status !== 'accepted' || !offer.accepted_at) return null
  return new Date(new Date(offer.accepted_at).getTime() + offer.payment_window_seconds * 1000)
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours   = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0)   return `${hours}h ${minutes}m ${seconds}s`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function PaymentWindowBanner({ offer, isBuyer }: Props) {
  const { theme } = useUnistyles()
  const deadline = computeDeadline(offer)

  const [remaining, setRemaining] = useState<number | null>(
    () => deadline ? deadline.getTime() - Date.now() : null
  )

  useEffect(() => {
    if (!deadline) return
    let timeoutId: ReturnType<typeof setTimeout>
    function tick() {
      const ms = deadline!.getTime() - Date.now()
      setRemaining(ms)
      if (ms > 0) timeoutId = setTimeout(tick, 1000)
    }
    tick()
    return () => clearTimeout(timeoutId)
  }, [deadline?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (remaining === null) return null

  const isExpired = remaining <= 0
  const isWarning = !isExpired && remaining < 30 * 60 * 1000  // < 30 min

  const bg = isExpired ? theme.colors.dangerTint  : isWarning ? theme.colors.warningTint  : theme.colors.primaryTint
  const fg = isExpired ? theme.colors.danger      : isWarning ? theme.colors.warning      : theme.colors.primary

  const label = isBuyer
    ? (isExpired ? 'Payment window expired' : 'Pay within')
    : (isExpired ? 'Payment window expired' : 'Waiting for buyer payment — time remaining')

  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <Text variant="caption" color={fg} weight="semibold" align="center">{label}</Text>
      {!isExpired && (
        <Text variant="caption" color={fg} weight="bold" align="center">{formatRemaining(remaining)}</Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  banner: { marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.md, gap: 2 },
})
