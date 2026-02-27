import { useCallback } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  ArrowLeft,
  MapPin,
  ChevronRight,
  Wallet,
  CircleHelp,
  LogOut,
  ClipboardList,
  UserPen,
  Settings,
} from 'lucide-react-native'
import { spacing, radius } from '@/theme/tokens'
import {
  ScreenContainer,
  Text,
  Avatar,
  Card,
  Divider,
  Badge,
  Spacer,
} from '@/components/ui'
import { IconButton } from '@/components/ui/IconButton'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'

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
  const { user, logout } = useAuthStore()
  const { postedGigs, workedGigs, fetchAll } = useUserGigsStore()

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchAll(user.id)
    }, [user?.id]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  const completedCount = [...postedGigs, ...workedGigs].filter(
    (g) => g.status === 'completed',
  ).length

  const activeCount = [...postedGigs, ...workedGigs].filter((g) =>
    ['accepted', 'submitted'].includes(g.status),
  ).length

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous'

  const walletShort = user?.wallet_address
    ? `${user.wallet_address.slice(0, 4)}...${user.wallet_address.slice(-4)}`
    : '—'

  const menuItems: MenuItem[] = [
    { icon: UserPen, label: 'Update Profile', onPress: () => router.push('/(tabs)/update-profile') },
    { icon: ClipboardList, label: 'My Gigs', onPress: () => router.push('/(tabs)/my-gigs') },
    { icon: Wallet, label: 'Wallet', value: walletShort, onPress: () => router.push('/(tabs)/wallet') },
    { icon: Settings, label: 'Settings', onPress: () => router.push('/(tabs)/settings') },
    { icon: CircleHelp, label: 'Help & Support', onPress: () => router.push('/(support)/faq' as never) },
  ]

  const stats = [
    { value: completedCount, label: 'Completed' },
    { value: activeCount, label: 'Active' },
    { value: user?.reputation_score ?? 0, label: 'Reputation' },
  ]

  return (
    <ScreenContainer edges={['top', 'left', 'right', 'bottom']}>
      {/* Floating back button */}
      <View style={s.topBar}>
        <IconButton
          icon={<ArrowLeft size={22} color={theme.colors.text} />}
          onPress={() => router.back()}
          variant="ghost"
        />
      </View>

      {/* Hero — centered identity */}
      <View style={s.hero}>
        <View style={[s.heroGlow, { backgroundColor: theme.colors.primaryTint }]} />
        <Avatar size="xl" name={fullName} src={user?.avatar_url} />
        <Spacer size={spacing.md} />
        <Text variant="heading" align="center">{fullName}</Text>
        <Spacer size={spacing.xs} />
        <View style={s.metaRow}>
          <MapPin size={14} color={theme.colors.textSub} />
          <Text variant="body" color={theme.colors.textSub}>
            {user?.city ?? 'Unknown'}
          </Text>
          <Badge variant="success" label="Verified" />
        </View>

        {/* Wallet pill */}
        <Spacer size={spacing.md} />
        <View style={[s.walletPill, { backgroundColor: theme.colors.muted }]}>
          <Wallet size={14} color={theme.colors.textSub} />
          <Text variant="caption" weight="medium" color={theme.colors.textSub}>
            {walletShort}
          </Text>
        </View>
      </View>

      <Spacer size={spacing.xl} />

      {/* Stats */}
      <View style={s.statsStrip}>
        {stats.map((stat, i) => (
          <View key={stat.label} style={s.statItem}>
            {i > 0 && <View style={[s.statDivider, { backgroundColor: theme.colors.borderFaint }]} />}
            <Text variant="heading" color={theme.colors.primary}>{stat.value}</Text>
            <Text variant="caption" color={theme.colors.textSub}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <Spacer size={spacing.xl} />

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
                <View style={[s.menuIcon, { backgroundColor: theme.colors.background, borderColor: theme.colors.borderFaint }]}>
                  <item.icon size={24} color={theme.colors.text} />
                </View>
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

      <Spacer size={spacing.xl} />

      {/* Disconnect */}
      <Pressable
        onPress={async () => {
          await logout()
          router.replace('/(auth)/welcome')
        }}
        style={({ pressed }) => [
          s.disconnectBtn,
          {
            backgroundColor: pressed ? theme.colors.surfacePressed : 'transparent',
            borderColor: theme.colors.danger,
          },
        ]}
      >
        <LogOut size={18} color={theme.colors.danger} />
        <Text variant="body" weight="medium" color={theme.colors.danger}>Disconnect</Text>
      </Pressable>

      <Spacer size={spacing.lg} />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    paddingTop: spacing.xs,
  },
  hero: {
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    paddingTop: spacing.sm,
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  walletPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  statsStrip: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statDivider: {
    position: 'absolute',
    left: 0,
    top: 4,
    bottom: 4,
    width: 1,
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
  menuIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
})
