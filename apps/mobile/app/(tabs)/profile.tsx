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

  const menuItems: MenuItem[] = [
    {
      icon: Wallet,
      label: 'Wallet',
      value: walletShort,
      onPress: () => {},
    },
    {
      icon: Shield,
      label: 'Security',
      onPress: () => {},
    },
    {
      icon: CircleHelp,
      label: 'Help & Support',
      onPress: () => {},
    },
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
    <ScreenContainer>
      {/* Header */}
      <View style={s.headerRow}>
        <Text variant="heading">Profile</Text>
        <IconButton
          icon={<Settings size={22} color={theme.colors.text} />}
          variant="ghost"
          onPress={() => {}}
        />
      </View>

      <Spacer size={spacing.lg} />

      {/* Profile card */}
      <Card variant="elevated">
        <View style={s.profileCard}>
          <Avatar
            size="lg"
            name={fullName}
            src={MOCK_CURRENT_USER.avatar_url}
          />
          <Spacer size={spacing.md} />
          <Text variant="subheading">{fullName}</Text>
          <Spacer size={4} />
          <View style={s.metaRow}>
            <MapPin size={14} color={theme.colors.textSub} />
            <Text variant="caption" color={theme.colors.textSub}>
              {MOCK_CURRENT_USER.city ?? 'Unknown'}
            </Text>
          </View>
          <Spacer size={4} />
          <View style={s.metaRow}>
            <Star size={14} color={theme.colors.warning} />
            <Text variant="caption" color={theme.colors.textSub}>
              {MOCK_CURRENT_USER.reputation_score ?? 0} reputation
            </Text>
          </View>
        </View>

        <Spacer size={spacing.md} />

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text variant="subheading">{completedCount}</Text>
            <Text variant="caption" color={theme.colors.textSub}>
              Completed
            </Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: theme.colors.borderFaint }]} />
          <View style={s.statItem}>
            <Text variant="subheading">{activeCount}</Text>
            <Text variant="caption" color={theme.colors.textSub}>
              Active
            </Text>
          </View>
          <View style={[s.statDivider, { backgroundColor: theme.colors.borderFaint }]} />
          <View style={s.statItem}>
            <Badge variant="success" label="Verified" />
          </View>
        </View>
      </Card>

      <Spacer size={spacing.lg} />

      {/* Menu */}
      <Card variant="outlined" padding={0}>
        {menuItems.map((item, index) => (
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
                <item.icon
                  size={20}
                  color={item.danger ? theme.colors.danger : theme.colors.text}
                />
                <Text
                  variant="body"
                  color={item.danger ? theme.colors.danger : theme.colors.text}
                >
                  {item.label}
                </Text>
              </View>
              <View style={s.menuRight}>
                {item.value && (
                  <Text variant="caption" color={theme.colors.textFaint}>
                    {item.value}
                  </Text>
                )}
                {!item.danger && (
                  <ChevronRight size={18} color={theme.colors.textFaint} />
                )}
              </View>
            </Pressable>
          </View>
        ))}
      </Card>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileCard: {
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'transparent', // overridden inline
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 32,
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
