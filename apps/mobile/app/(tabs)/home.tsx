import { useState } from 'react'
import { useRouter } from 'expo-router'
import { View, FlatList, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Bell } from 'lucide-react-native'
import type { ColorScheme } from '@/theme/tokens'
import { spacing } from '@/theme/tokens'
import {
  ScreenContainer,
  Text,
  Chip,
  Spacer,
  LiveChip,
} from '@/components/ui'
import { GigCardCompact } from '@/components/gig'
import { Drawer, DrawerHeader } from '@/components/navigation'
import { MOCK_GIGS, CATEGORY_META, type MockGig } from '@/data/mock'
import { useAuthStore } from '@/stores/auth.store'

const openGigs = MOCK_GIGS.filter((g) => g.status === 'open')

export default function HomeScreen() {
  const { theme } = useUnistyles()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()
  const user = useAuthStore((s) => s.user)

  const renderGigItem = ({ item }: { item: MockGig }) => (
    <GigCardCompact gig={item} variant="inline" />
  )

  return (
    <Drawer
      isOpen={drawerOpen}
      onOpen={() => setDrawerOpen(true)}
      onClose={() => setDrawerOpen(false)}
    >
      <DrawerHeader
        title="Tenda"
        onMenuPress={() => setDrawerOpen(true)}
        rightIcon={Bell}
        onRightPress={() => router.push('/(tabs)/notifications' as never)}
        onAvatarPress={() => router.push('/(tabs)/profile')}
        userImage={user?.avatar_url}
        userName={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Anonymous'}
        showAvatar
      />
      <ScreenContainer scroll={false} padding={false}>
        <FlatList
          data={openGigs}
          keyExtractor={(item) => item.id}
          renderItem={renderGigItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* Feed intro */}
              <View style={s.feedIntro}>
                <View>
                  <Text variant="subheading">Feed</Text>
                  <Text variant="caption" color={theme.colors.textSub}>
                    Latest gigs, updated as they come in
                  </Text>
                </View>
                <LiveChip label="Live" />
              </View>

              <Spacer size={spacing.md} />

              {/* Categories */}
              <Text variant="subheading">Categories</Text>
              <Spacer size={spacing.sm} />
              <View style={s.categories}>
                {CATEGORY_META.map((cat) => {
                  const colorKey = `category${cat.label}` as keyof ColorScheme
                  return (
                    <Chip
                      key={cat.key}
                      label={cat.label}
                      color={theme.colors[colorKey]}
                      onPress={() => {}}
                    />
                  )
                })}
              </View>

              <Spacer size={spacing.lg} />

              {/* Section header */}
              <View style={s.sectionHeader}>
                <Text variant="subheading">Available gigs</Text>
                <Text variant="caption" color={theme.colors.primary} weight="semibold">
                  See all
                </Text>
              </View>
              <Spacer size={spacing.sm} />
            </>
          }
          ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
          ListFooterComponent={<Spacer size={spacing.xl} />}
        />
      </ScreenContainer>
    </Drawer>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  feedIntro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
})
