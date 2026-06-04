import { useCallback } from 'react'
import { View, Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  MapPin,
  ChevronRight,
  Wallet,
  CircleHelp,
  LogOut,
  ClipboardList,
  UserPen,
  Settings,
  CircleDollarSign,
} from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import {
  ScreenContainer,
  Text,
  Avatar,
  Spacer,
  SeekerBadge,
} from '@/components/ui'
import { Header } from '@/components/ui/Header'
import { RestrictionBanner } from '@/components/reputation'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { SeekerWelcomeSheet } from '@/components/seeker/SeekerWelcomeSheet'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'
import { truncateWallet } from '@tenda/shared'
import type { LucideIcon } from 'lucide-react-native'

interface MenuItem {
  Icon: LucideIcon
  label: string
  /** Right-aligned trailing text (mono). */
  value?: string
  /** Tinted icon variant — defaults to 'inset' (neutral) */
  tone?: 'inset' | 'brand' | 'accent'
  onPress: () => void
}

export default function ProfileScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { user, logout, refreshUser } = useAuthStore()
  const { postedGigs, workedGigs, fetchAll } = useUserGigsStore()

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchAll(user.id)
      refreshUser()
    }, [user?.id]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  const workerCompletedCount = workedGigs.filter((g) => g.status === 'completed').length
  const posterPostedCount = postedGigs.length
  const activePosterGigs = postedGigs.filter((g) =>
    g.status === 'open' || g.status === 'accepted' || g.status === 'submitted'
  ).length

  const fullName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(' ') || 'Anonymous'

  const walletShort = user?.wallet_address ? truncateWallet(user.wallet_address) : '—'

  const accountItems: MenuItem[] = [
    {
      Icon: UserPen,
      label: 'Update profile',
      tone: user?.is_seeker ? 'accent' : 'inset',
      onPress: () => router.push('/(tabs)/update-profile'),
    },
    {
      Icon: ClipboardList,
      label: 'My gigs',
      tone: 'brand',
      value: activePosterGigs > 0 ? `${activePosterGigs} active` : undefined,
      onPress: () => router.push('/(tabs)/my-gigs'),
    },
    {
      Icon: CircleDollarSign,
      label: 'Wallet',
      tone: 'brand',
      value: walletShort,
      onPress: () => router.push('/(tabs)/wallet'),
    },
  ]

  const supportItems: MenuItem[] = [
    {
      Icon: Settings,
      label: 'Settings',
      onPress: () => router.push('/(tabs)/settings'),
    },
    {
      Icon: CircleHelp,
      label: 'Help & Guide',
      onPress: () => router.push('/(support)/faq' as never),
    },
  ]

  // Backend stores reputation on a 0–100 scale; show as 0.0–5.0 stars for users.
  const reputationDisplay = user?.reputation_score
    ? (user.reputation_score / 20).toFixed(1)
    : '—'

  return (
    <ScreenContainer scroll padding={false} edges={['left', 'right']}>
      <Header title="Profile" showBack />
      <RestrictionBanner />

      {/* Hero */}
      <View style={s.hero}>
        <View style={[s.heroGlow, { backgroundColor: theme.colors.brand.primarySurface }]} />
        <View style={[s.avatarRing, { borderColor: theme.colors.surface.card }]}>
          <Avatar size="xl" name={fullName} src={user?.avatar_url} />
        </View>
        <Text style={[s.name, { color: theme.colors.content.primary }]}>{fullName}</Text>
        {user?.is_seeker && (
          <View style={s.seekerWrap}>
            <SeekerBadge variant="full" />
          </View>
        )}
        <View style={s.pillRow}>
          <View style={[s.infoPill, { backgroundColor: theme.colors.surface.inset }]}>
            <MapPin size={12} color={theme.colors.content.tertiary} />
            <Text style={[s.infoPillText, { color: theme.colors.content.secondary }]} numberOfLines={1}>
              {user?.city ?? 'Unknown'}
            </Text>
          </View>
          {user?.wallet_address && (
            <View style={[s.infoPill, { backgroundColor: theme.colors.surface.inset }]}>
              <Wallet size={12} color={theme.colors.content.tertiary} />
              <Text style={[s.infoPillMono, { color: theme.colors.content.secondary }]} numberOfLines={1}>
                {walletShort}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Stats */}
      <View
        style={[
          s.stats,
          { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default },
        ]}
      >
        <Stat value={String(workerCompletedCount)} label="Completed" />
        <Stat value={String(posterPostedCount)} label="Posted" hasDivider />
        <Stat value={reputationDisplay} unit="/5" label="Reputation" hasDivider />
      </View>

      {/* Account */}
      <SectionLabel>Account</SectionLabel>
      <MenuGroup items={accountItems} />

      {/* Support */}
      <SectionLabel>Support</SectionLabel>
      <MenuGroup items={supportItems} />

      {/* Disconnect */}
      <Pressable
        onPress={async () => {
          await logout()
          router.replace('/(auth)/welcome')
        }}
        style={({ pressed }) => [
          s.disconnect,
          {
            borderColor: theme.colors.feedback.danger.base,
            backgroundColor: pressed ? theme.colors.feedback.danger.surface : 'transparent',
          },
        ]}
      >
        <LogOut size={16} color={theme.colors.feedback.danger.base} />
        <Text style={[s.disconnectText, { color: theme.colors.feedback.danger.base }]}>
          Disconnect
        </Text>
      </Pressable>

      <Text style={[s.version, { color: theme.colors.content.tertiary }]}>Tenda v1.0.0</Text>
      <Spacer size={20} />

      {user?.is_seeker && <SeekerWelcomeSheet onDismiss={() => {}} />}
    </ScreenContainer>
  )
}

function Stat({ value, label, unit, hasDivider }: { value: string; label: string; unit?: string; hasDivider?: boolean }) {
  const { theme } = useUnistyles()
  return (
    <View style={s.stat}>
      {hasDivider && <View style={[s.statDivider, { backgroundColor: theme.colors.border.subtle }]} />}
      <Text style={[s.statValue, { color: theme.colors.content.primary }]}>
        {value}
        {unit && <Text style={[s.statUnit, { color: theme.colors.content.tertiary }]}>{unit}</Text>}
      </Text>
      <Text style={[s.statLabel, { color: theme.colors.content.tertiary }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  )
}

function MenuGroup({ items }: { items: MenuItem[] }) {
  const { theme } = useUnistyles()
  return (
    <View
      style={[
        s.group,
        { backgroundColor: theme.colors.surface.card, borderColor: theme.colors.border.default },
      ]}
    >
      {items.map((item, index) => {
        const Icon = item.Icon
        const tone = item.tone ?? 'inset'
        const iconBg =
          tone === 'brand'  ? theme.colors.brand.primarySurface :
          tone === 'accent' ? theme.colors.accent.primarySurface :
                              theme.colors.surface.inset
        const iconFg =
          tone === 'brand'  ? theme.colors.brand.primary :
          tone === 'accent' ? theme.colors.accent.primary :
                              theme.colors.content.primary
        return (
          <View key={item.label}>
            {index > 0 && (
              <View style={[s.rowDivider, { backgroundColor: theme.colors.border.subtle }]} />
            )}
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [
                s.row,
                pressed && { backgroundColor: theme.colors.surface.pressed },
              ]}
            >
              <View style={[s.rowIc, { backgroundColor: iconBg }]}>
                <Icon size={16} color={iconFg} />
              </View>
              <Text
                style={[s.rowLabel, { color: theme.colors.content.primary }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.value && (
                <Text
                  style={[s.rowValue, { color: theme.colors.content.tertiary }]}
                  numberOfLines={1}
                >
                  {item.value}
                </Text>
              )}
              <ChevronRight size={16} color={theme.colors.content.tertiary} />
            </Pressable>
          </View>
        )
      })}
    </View>
  )
}

const s = StyleSheet.create({
  hero: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    position: 'relative',
  },
  heroGlow: {
    position: 'absolute',
    top: -60,
    width: 240,
    height: 240,
    borderRadius: 120,
    opacity: 0.5,
  },
  avatarRing: {
    borderRadius: 100,
    borderWidth: 3,
    marginTop: 12,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.56,
    marginTop: 18,
    textAlign: 'center',
  },
  seekerWrap: {
    marginTop: 10,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  infoPillText: {
    fontSize: 12.5,
    fontWeight: '500',
  },
  infoPillMono: {
    fontFamily: typography.fonts.mono,
    fontSize: 11.5,
    letterSpacing: 0.115,
  },
  stats: {
    marginHorizontal: 20,
    marginTop: 22,
    height: 80,
    borderWidth: 1,
    borderRadius: 16,
    flexDirection: 'row',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  statDivider: {
    position: 'absolute',
    left: 0,
    top: 16,
    bottom: 16,
    width: 1,
  },
  statValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 22,
  },
  statUnit: {
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0,
  },
  statLabel: {
    fontFamily: typography.fonts.mono,
    fontSize: 9.5,
    fontWeight: '600',
    letterSpacing: 0.95,
  },
  group: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    height: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowDivider: {
    height: 1,
    marginLeft: 72,
  },
  rowIc: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    fontSize: 15,
    letterSpacing: -0.075,
    flexShrink: 1,
  },
  rowValue: {
    fontFamily: typography.fonts.mono,
    fontSize: 12,
    letterSpacing: 0.12,
    flexShrink: 0,
    marginLeft: 'auto',
  },
  disconnect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    marginHorizontal: 20,
    marginTop: 32,
    borderWidth: 1,
    borderRadius: 14,
  },
  disconnectText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.15,
  },
  version: {
    textAlign: 'center',
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.44,
    marginTop: 18,
  },
})
