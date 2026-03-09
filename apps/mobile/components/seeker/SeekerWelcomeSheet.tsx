import { useEffect, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { Cpu, Zap, Tag } from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { BottomSheet, Text, Button, Spacer } from '@/components/ui'

const STORAGE_KEY = 'seeker_welcome_shown'
const GOLD = '#d97706'
const GOLD_TINT = '#fffbeb'

const PERKS = [
  { Icon: Tag,  text: 'Reduced platform fees on all gigs' },
  { Icon: Zap,  text: 'Genesis Seeker badge on your profile' },
  { Icon: Cpu,  text: 'Early access to new features' },
] as const

interface SeekerWelcomeSheetProps {
  onDismiss: () => void
}

export function SeekerWelcomeSheet({ onDismiss }: SeekerWelcomeSheetProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY).then((shown: string | null) => {
      if (!shown) setVisible(true)
    })
  }, [])

  async function handleDismiss() {
    await SecureStore.setItemAsync(STORAGE_KEY, '1')
    setVisible(false)
    onDismiss()
  }

  return (
    <BottomSheet visible={visible} onClose={handleDismiss} title="Welcome, Seeker!">
      <View style={s.iconCircle}>
        <Cpu size={32} color={GOLD} />
      </View>
      <Spacer size={spacing.sm} />
      <Text variant="body" align="center" style={s.subtitle}>
        You're on Solana's first crypto-native mobile device. Here's what you get on Tenda:
      </Text>
      <Spacer size={spacing.lg} />
      <View style={s.perks}>
        {PERKS.map(({ Icon, text }) => (
          <View key={text} style={s.perkRow}>
            <View style={s.perkIcon}>
              <Icon size={16} color={GOLD} />
            </View>
            <Text variant="body">{text}</Text>
          </View>
        ))}
      </View>
      <Spacer size={spacing.xl} />
      <Button variant="primary" fullWidth onPress={handleDismiss}>
        Let's go
      </Button>
    </BottomSheet>
  )
}

const s = StyleSheet.create({
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: GOLD_TINT,
    borderWidth: 1.5,
    borderColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  subtitle: {
    paddingHorizontal: spacing.md,
  },
  perks: {
    gap: spacing.md,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  perkIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: GOLD_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
