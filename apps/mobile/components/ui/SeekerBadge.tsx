import { View, StyleSheet } from 'react-native'
import { Cpu } from 'lucide-react-native'
import { Text } from './Text'

const GOLD = '#d97706'
const GOLD_TINT = '#fffbeb'

interface SeekerBadgeProps {
  /** compact: small inline pill for person cards; full: larger pill for profile hero */
  variant?: 'compact' | 'full'
}

export function SeekerBadge({ variant = 'compact' }: SeekerBadgeProps) {
  const isFull = variant === 'full'
  return (
    <View style={[s.badge, isFull ? s.badgeFull : s.badgeCompact]}>
      <Cpu size={isFull ? 13 : 10} color={GOLD} />
      <Text
        variant={isFull ? 'caption' : 'caption'}
        weight="semibold"
        style={{ color: GOLD, fontSize: isFull ? 12 : 10 }}
      >
        Seeker
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOLD_TINT,
    borderWidth: 1,
    borderColor: GOLD,
  },
  badgeCompact: {
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeFull: {
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
})
