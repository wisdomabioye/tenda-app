import { useCallback } from 'react'
import { Pressable, StyleSheet } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import {
  LogOut,
  ClipboardList,
  UserPen,
  Settings,
  CircleHelp,
  CircleDollarSign,
} from 'lucide-react-native'
import { typography } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer } from '@/components/ui'
import { Header } from '@/components/ui/Header'
import { RestrictionBanner } from '@/components/reputation'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { SeekerWelcomeSheet } from '@/components/seeker/SeekerWelcomeSheet'
import { ProfileHero, ProfileStats, ProfileMenu } from '@/components/profile'
import type { MenuItem } from '@/components/profile'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'
import { truncateWallet } from '@tenda/shared'

export default function ProfileScreen() {
  const router = useRouter()
  const { theme } = useUnistyles()
  const { user, logout, refreshUser } = useAuthStore()
  const { postedGigs, workedGigs, fetchAll } = useUserGigsStore()
  const wallets = useAuthStore((s) => s.wallets)
  const sessionWallet = useAuthStore((s) => s.walletAddress)

  useFocusEffect(
    useCallback(() => {
      if (user?.id) fetchAll()
      refreshUser()
    }, [user?.id]), // eslint-disable-line react-hooks/exhaustive-deps
  )

  const workerCompletedCount = workedGigs.filter((g) => g.status === 'completed').length
  const posterPostedCount = postedGigs.length
  const activePosterGigs = postedGigs.filter((g) =>
    g.status === 'open' || g.status === 'accepted' || g.status === 'submitted'
  ).length

  const fullName = [user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Anonymous'

  // v2 identity is multi-wallet: show the primary linked wallet, falling
  // back to the connected session address.
  const primaryWallet = wallets.find((w) => w.is_primary)?.address ?? sessionWallet
  const walletShort = primaryWallet ? truncateWallet(primaryWallet) : '—'

  // v2 review_score is already a 0–5 average (numeric(3,2) → string).
  const reputationDisplay = user?.review_score ? Number(user.review_score).toFixed(1) : '—'

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
    { Icon: Settings, label: 'Settings', onPress: () => router.push('/(tabs)/settings') },
    { Icon: CircleHelp, label: 'Help & Guide', onPress: () => router.push('/(support)/faq' as never) },
  ]

  return (
    <ScreenContainer scroll padding={false} edges={['left', 'right']}>
      <Header title="Profile" showBack />
      <RestrictionBanner />

      <ProfileHero
        fullName={fullName}
        avatarUrl={user?.avatar_url}
        isSeeker={user?.is_seeker ?? false}
        city={user?.city ?? null}
        walletShort={walletShort}
        hasWallet={primaryWallet !== null}
      />

      <ProfileStats completed={workerCompletedCount} posted={posterPostedCount} reputation={reputationDisplay} />

      <SectionLabel>Account</SectionLabel>
      <ProfileMenu items={accountItems} />

      <SectionLabel>Support</SectionLabel>
      <ProfileMenu items={supportItems} />

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
        <Text style={[s.disconnectText, { color: theme.colors.feedback.danger.base }]}>Disconnect</Text>
      </Pressable>

      <Text style={[s.version, { color: theme.colors.content.tertiary }]}>Tenda v1.0.0</Text>
      <Spacer size={20} />

      {user?.is_seeker && <SeekerWelcomeSheet onDismiss={() => {}} />}
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
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
  disconnectText: { fontSize: 15, fontWeight: '600', letterSpacing: -0.15 },
  version: {
    textAlign: 'center',
    fontFamily: typography.fonts.mono,
    fontSize: 11,
    letterSpacing: 0.44,
    marginTop: 18,
  },
})
