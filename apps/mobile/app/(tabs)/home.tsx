import { useCallback, useState } from 'react'
import { useRouter } from 'expo-router'
import { View, FlatList, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { Bell, SlidersHorizontal, Search as SearchIcon } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing, radius } from '@/theme/tokens'
import {
  ScreenContainer,
  Text,
  Spacer,
  LiveChip,
  FilterSheet,
  EmptyState,
} from '@/components/ui'
import { LoadingScreen, ErrorState } from '@/components/feedback'
import { GigCardCompact } from '@/components/gig'
import { Drawer, DrawerHeader } from '@/components/navigation'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import type { Gig } from '@tenda/shared'
import { useFocusEffect } from 'expo-router'

export default function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { theme } = useUnistyles()
  const user = useAuthStore((s) => s.user)
  const { gigs, isLoading, error, fetchGigs, setFilters } = useGigsStore()

  useFocusEffect(
    useCallback(() => {
      fetchGigs()
    }, [fetchGigs]),
  )

  const hasFilters = query.trim().length > 0 || selectedCategory !== null

  async function handleRefresh() {
    setRefreshing(true)
    await fetchGigs()
    setRefreshing(false)
  }

  function handleCloseFilter() {
    setFilterOpen(false)
    setFilters({ category: selectedCategory as any ?? undefined })
    fetchGigs()
  }

  const renderGigItem = ({ item }: { item: Gig }) => (
    <GigCardCompact gig={item} />
  )

  if (isLoading && gigs.length === 0) {
    return <LoadingScreen />
  }

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
        {error ? (
          <ErrorState
            title="Failed to load gigs"
            description={error}
            ctaLabel="Retry"
            onCtaPress={fetchGigs}
          />
        ) : (
          <FlatList
            data={gigs}
            keyExtractor={(item) => item.id}
            renderItem={renderGigItem}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
            ListHeaderComponent={
              <View style={s.feedRow}>
                <Text variant="subheading">Feed</Text>
                <View style={s.feedRight}>
                  <LiveChip label="Live" />
                  <Pressable
                    onPress={() => setFilterOpen(true)}
                    style={[
                      s.filterBtn,
                      {
                        backgroundColor: hasFilters
                          ? theme.colors.primaryTint
                          : theme.colors.muted,
                      },
                    ]}
                  >
                    <SlidersHorizontal
                      size={16}
                      color={hasFilters ? theme.colors.primary : theme.colors.textSub}
                    />
                    {hasFilters && (
                      <View style={[s.filterDot, { backgroundColor: theme.colors.primary }]} />
                    )}
                  </Pressable>
                </View>
              </View>
            }
            ListEmptyComponent={
              <EmptyState
                icon={<SearchIcon size={40} color={theme.colors.textFaint} />}
                title="No gigs found"
                description="Try adjusting your filters or check back later"
              />
            }
            ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
            ListFooterComponent={<Spacer size={spacing.xl} />}
          />
        )}

        <FilterSheet
          visible={filterOpen}
          onClose={handleCloseFilter}
          query={query}
          onQueryChange={setQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
        />
      </ScreenContainer>
    </Drawer>
  )
}

const s = StyleSheet.create({
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  feedRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})
