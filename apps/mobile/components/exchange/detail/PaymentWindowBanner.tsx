import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { typography } from '@/theme/tokens'
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

/**
 * Compact mm:ss countdown for windows < 24h, falls back to "Xh Ym" otherwise.
 *   59:42 · 22:14 · 4h 12m
 */
function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00'
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  if (hours >= 1) {
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Wireframe `pay-banner` (§4.20). 56h, 14r row with:
 *   - Leading 6px tone-coloured dot
 *   - Body copy on the left ("Send payment to unlock SOL" / "Awaiting buyer payment")
 *   - Trailing mono countdown in the same tone
 *
 * Tone: `warning.surface` while in-progress (default), `danger.surface` on expiry,
 * `info.surface` (brand) when nothing is owed yet.
 */
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline?.getTime()])

  if (remaining === null) return null

  const isExpired = remaining <= 0
  const isUrgent = !isExpired && remaining < 30 * 60 * 1000

  const bg = isExpired
    ? theme.colors.feedback.danger.surface
    : isUrgent
      ? theme.colors.feedback.warning.surface
      : theme.colors.brand.primarySurface
  const fg = isExpired
    ? theme.colors.feedback.danger.base
    : isUrgent
      ? theme.colors.feedback.warning.base
      : theme.colors.brand.primary

  const message = isBuyer
    ? (isExpired ? 'Payment window expired' : 'Send payment to unlock SOL')
    : (isExpired ? 'Buyer missed the payment window' : 'Awaiting buyer payment')

  return (
    <View style={[s.banner, { backgroundColor: bg }]}>
      <View style={[s.dot, { backgroundColor: fg }]} />
      <Text
        style={[s.text, { color: theme.colors.content.primary }]}
        numberOfLines={1}
      >
        {message}
      </Text>
      {!isExpired && (
        <Text style={[s.timer, { color: fg }]}>{formatRemaining(remaining)}</Text>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  banner: {
    marginHorizontal: 20,
    marginTop: 12,
    height: 56,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  timer: {
    fontFamily: typography.fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.13,
  },
})
