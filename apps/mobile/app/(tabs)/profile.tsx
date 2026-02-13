import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  Settings,
  MapPin,
  Star,
  ChevronRight,
  Wallet,
  Shield,
  CircleHelp,
  LogOut,
} from 'lucide-react-native'
import { spacing } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { Card } from '@/components/ui/Card'
import { Divider } from '@/components/ui/Divider'
import { Badge } from '@/components/ui/Badge'
import { Spacer } from '@/components/ui/Spacer'
import { MOCK_CURRENT_USER, MOCK_GIGS } from '@/data/mock'
import { Header } from '@/components/ui'

const completedCount = MOCK_GIGS.filter(
  (g) => g.status === 'completed' && (g.poster_id === MOCK_CURRENT_USER.id || g.worker_id === MOCK_CURRENT_USER.id),
).length

const activeCount = MOCK_GIGS.filter(
  (g) =>
    ['accepted', 'submitted'].includes(g.status) &&
    (g.poster_id === MOCK_CURRENT_USER.id || g.worker_id === MOCK_CURRENT_USER.id),
).length

interface MenuItem {
  icon: typeof Wallet
  label: string
  value?: string
  danger?: boolean
  onPress: () => void
}

export default function ProfileScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()

  const fullName = [MOCK_CURRENT_USER.first_name, MOCK_CURRENT_USER.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous'

  const walletShort = `${MOCK_CURRENT_USER.wallet_address.slice(0, 4)}...${MOCK_CURRENT_USER.wallet_address.slice(-4)}`

  const accountItems: MenuItem[] = [
    { icon: Wallet, label: 'Wallet', value: walletShort, onPress: () => {} },
    { icon: Shield, label: 'Security', onPress: () => {} },
  ]

  const supportItems: MenuItem[] = [
    { icon: CircleHelp, label: 'Help & Support', onPress: () => {} },
  ]

  const dangerItems: MenuItem[] = [
    {
      icon: LogOut,
      label: 'Disconnect',
      danger: true,
      onPress: () => {
        // TODO: disconnect wallet
        router.replace('/(auth)/welcome')
      },
    },
  ]

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      <Header
        title="Profile"
        showBack
        rightIcon={Settings}
        onRightPress={() => {}}
      />
      <Spacer size={spacing.lg} />

      {/* Hero */}
      <Card variant="elevated">
        <View style={s.hero}>
          <View style={[s.heroGlow, { backgroundColor: theme.colors.primaryTint }]} />
          <View style={s.heroTop}>
            <Avatar size="lg" name={fullName} src={MOCK_CURRENT_USER.avatar_url} />
            <View style={s.heroMeta}>
              <Text variant="subheading">{fullName}</Text>
              <View style={s.metaRow}>
                <MapPin size={14} color={theme.colors.textSub} />
                <Text variant="caption" color={theme.colors.textSub}>
                  {MOCK_CURRENT_USER.city ?? 'Unknown'}
                </Text>
              </View>
              <View style={s.metaRow}>
                <Star size={14} color={theme.colors.warning} />
                <Text variant="caption" color={theme.colors.textSub}>
                  {MOCK_CURRENT_USER.reputation_score ?? 0} reputation
                </Text>
              </View>
            </View>
            <Badge variant="success" label="Verified" />
          </View>

          <Spacer size={spacing.md} />

          <View style={s.walletRow}>
            <Text variant="caption" color={theme.colors.textSub}>Wallet</Text>
            <Text variant="label" weight="semibold">{walletShort}</Text>
          </View>
        </View>
      </Card>

      <Spacer size={spacing.lg} />

      {/* Stats strip */}
      <View style={s.statsStrip}>
        <Card variant="filled" padding={spacing.md} style={s.statCard}>
          <Text variant="subheading">{completedCount}</Text>
          <Text variant="caption" color={theme.colors.textSub}>Completed</Text>
        </Card>
        <Card variant="filled" padding={spacing.md} style={s.statCard}>
          <Text variant="subheading">{activeCount}</Text>
          <Text variant="caption" color={theme.colors.textSub}>Active</Text>
        </Card>
        <Card variant="filled" padding={spacing.md} style={s.statCard}>
          <Text variant="subheading">{MOCK_CURRENT_USER.reputation_score ?? 0}</Text>
          <Text variant="caption" color={theme.colors.textSub}>Reputation</Text>
        </Card>
      </View>

      <Spacer size={spacing.lg} />

      {/* Account */}
      <Text variant="label" weight="semibold">Account</Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        {accountItems.map((item, index) => (
          <View key={item.label}>
            {index > 0 && <Divider spacing={0} />}
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [
                s.menuItem,
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <View style={s.menuLeft}>
                <item.icon size={20} color={theme.colors.text} />
                <Text variant="body">{item.label}</Text>
              </View>
              <View style={s.menuRight}>
                {item.value && (
                  <Text variant="caption" color={theme.colors.textFaint}>
                    {item.value}
                  </Text>
                )}
                <ChevronRight size={18} color={theme.colors.textFaint} />
              </View>
            </Pressable>
          </View>
        ))}
      </Card>

      <Spacer size={spacing.lg} />

      {/* Support */}
      <Text variant="label" weight="semibold">Support</Text>
      <Spacer size={spacing.sm} />
      <Card variant="outlined" padding={0}>
        {supportItems.map((item, index) => (
          <View key={item.label}>
            {index > 0 && <Divider spacing={0} />}
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [
                s.menuItem,
                pressed && { backgroundColor: theme.colors.surfacePressed },
              ]}
            >
              <View style={s.menuLeft}>
                <item.icon size={20} color={theme.colors.text} />
                <Text variant="body">{item.label}</Text>
              </View>
              <ChevronRight size={18} color={theme.colors.textFaint} />
            </Pressable>
          </View>
        ))}
      </Card>

      <Spacer size={spacing.lg} />

      {/* Danger */}
      <Card variant="outlined" padding={0}>
        {dangerItems.map((item) => (
          <Pressable
            key={item.label}
            onPress={item.onPress}
            style={({ pressed }) => [
              s.menuItem,
              pressed && { backgroundColor: theme.colors.surfacePressed },
            ]}
          >
            <View style={s.menuLeft}>
              <item.icon size={20} color={theme.colors.danger} />
              <Text variant="body" color={theme.colors.danger}>{item.label}</Text>
            </View>
          </Pressable>
        ))}
      </Card>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  hero: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    opacity: 0.6,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  walletRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
})
