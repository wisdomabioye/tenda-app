import { useState } from 'react'
import { useRouter } from 'expo-router'
import { View, FlatList, ScrollView, Pressable, StyleSheet, RefreshControl } from 'react-native'
import { Bell, ListFilter, Search as SearchIcon } from 'lucide-react-native'
import { useUnistyles } from 'react-native-unistyles'
import {
  ScreenContainer,
  Text,
  Spacer,
  Chip,
  FilterSheet,
  EmptyState,
} from '@/components/ui'
import { LoadingScreen, ErrorState, ServerStatus } from '@/components/feedback'
import { GigCardCompact } from '@/components/gig'
import { FeaturedRail } from '@/components/gig/FeaturedRail'
import { Drawer, DrawerHeader } from '@/components/navigation'
import { CATEGORY_META } from '@/lib/categories'
import { useAuthStore } from '@/stores/auth.store'
import { useGigsStore } from '@/stores/gigs.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { useGigsFeedPolling } from '@/hooks/useGigsFeedPolling'
import type { GigSummary, GigCategory } from '@tenda/shared'

export default function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<GigCategory | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<string | null>(null)
  const [selectedRemote, setSelectedRemote] = useState<boolean | null>(null)
  const [selectedCrossBorder, setSelectedCrossBorder] = useState<boolean | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [railRefreshKey, setRailRefreshKey] = useState(0)
  const router = useRouter()
  const { theme } = useUnistyles()
  const user = useAuthStore((s) => s.user)
  const unreadNotifications = useNotificationsStore((s) => s.unread)
  const { gigs, isLoading, hasFetched, error, fetchGigs, setFilters, resetFilters } = useGigsStore()

  useGigsFeedPolling()

  const hasFilters =
    query.trim().length > 0 ||
    selectedCategory !== null ||
    selectedCountry !== null ||
    selectedCity !== null ||
    selectedRemote !== null ||
    selectedCrossBorder !== null

  const displayedGigs = query.trim()
    ? gigs.filter((g) =>
        g.title.toLowerCase().includes(query.toLowerCase()) ||
        (g.city ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : gigs

  async function handleRefresh() {
    setRefreshing(true)
    setRailRefreshKey((k) => k + 1)
    await fetchGigs()
    setRefreshing(false)
  }

  function handleCategoryChange(cat: GigCategory | null) {
    setSelectedCategory(cat)
    setFilters({ category: cat ?? undefined })
    fetchGigs()
  }

  function handleLocationChange(country: string, city: string | null) {
    setSelectedCountry(country)
    setSelectedCity(city)
    setFilters({ country, city: city ?? undefined })
    fetchGigs()
  }

  function handleRemoteChange(remote: boolean | null) {
    setSelectedRemote(remote)
    setFilters({ remote: remote ?? undefined })
    fetchGigs()
  }

  function handleCrossBorderChange(crossBorder: boolean | null) {
    setSelectedCrossBorder(crossBorder)
    setFilters({ cross_border: crossBorder ?? undefined })
    fetchGigs()
  }

  function handleClearAll() {
    setQuery('')
    setSelectedCategory(null)
    setSelectedCountry(null)
    setSelectedCity(null)
    setSelectedRemote(null)
    setSelectedCrossBorder(null)
    resetFilters()
    fetchGigs()
  }

  if (!hasFetched && isLoading) return <LoadingScreen />

  const renderGig = ({ item }: { item: GigSummary }) => (
    <GigCardCompact gig={item} variant="rich" />
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
        badgeCount={unreadNotifications}
        onRightPress={() => router.push('/notifications' as Parameters<typeof router.push>[0])}
        onAvatarPress={() => router.push('/(tabs)/profile')}
        userImage={user?.avatar_url}
        userName={[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'Anonymous'}
        showAvatar
      />
      <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
        {error ? (
          <ErrorState
            title="Failed to load gigs"
            description={error}
            ctaLabel="Retry"
            onCtaPress={fetchGigs}
          />
        ) : (
          <FlatList
            data={displayedGigs}
            keyExtractor={(item) => item.escrow_id}
            renderItem={renderGig}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.brand.primary}
              />
            }
            ListHeaderComponent={
              <>
                <FeaturedRail refreshKey={railRefreshKey} />
                <View style={s.feedRow}>
                  <Text style={[s.feedTitle, { color: theme.colors.content.primary }]}>
                    Feed
                  </Text>
                  <ServerStatus />
                  <Pressable
                    onPress={() => setFilterOpen(true)}
                    style={({ pressed }) => [
                      s.filterBtn,
                      { backgroundColor: theme.colors.surface.inset },
                      pressed && { opacity: 0.7 },
                    ]}
                    accessibilityLabel="Filter gigs"
                    accessibilityRole="button"
                  >
                    <ListFilter size={16} color={theme.colors.content.secondary} />
                    {hasFilters && (
                      <View style={[s.filterDot, { backgroundColor: theme.colors.brand.primary }]} />
                    )}
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.chipRow}
                >
                  <Chip
                    label="All"
                    selected={selectedCategory === null}
                    onPress={() => handleCategoryChange(null)}
                  />
                  {CATEGORY_META.map((cat) => (
                    <Chip
                      key={cat.key}
                      label={cat.label}
                      selected={selectedCategory === cat.key}
                      category={cat.key}
                      onPress={() => handleCategoryChange(selectedCategory === cat.key ? null : cat.key)}
                    />
                  ))}
                </ScrollView>
              </>
            }
            ListEmptyComponent={
              <EmptyState
                variant="compact"
                icon={<SearchIcon size={22} color={theme.colors.content.tertiary} />}
                title="No gigs found"
                description="Try adjusting your filters or check back later."
                action={hasFilters ? { label: 'Clear filters', onPress: handleClearAll } : undefined}
              />
            }
            ItemSeparatorComponent={() => <Spacer size={10} />}
            ListFooterComponent={<Spacer size={32} />}
          />
        )}

        <FilterSheet
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
          query={query}
          onQueryChange={setQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={(c) => handleCategoryChange((c ?? null) as GigCategory | null)}
          country={selectedCountry}
          city={selectedCity}
          onLocationChange={handleLocationChange}
          remote={selectedRemote}
          onRemoteChange={handleRemoteChange}
          crossBorder={selectedCrossBorder}
          onCrossBorderChange={handleCrossBorderChange}
          onClearAll={handleClearAll}
        />
      </ScreenContainer>
    </Drawer>
  )
}

const s = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 10,
  },
  feedTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.44,
  },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
})
