import { useState, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { View, FlatList, Pressable, StyleSheet } from 'react-native'
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
import { GigCardCompact } from '@/components/gig'
import { Drawer, DrawerHeader } from '@/components/navigation'
import { MOCK_GIGS, type MockGig } from '@/data/mock'
import { useAuthStore } from '@/stores/auth.store'

const allOpenGigs = MOCK_GIGS.filter((g) => g.status === 'open')

export default function HomeScreen() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const router = useRouter()
  const { theme } = useUnistyles()
  const user = useAuthStore((s) => s.user)

  const hasFilters = query.trim().length > 0 || selectedCategory !== null

  const filteredGigs = useMemo(() => {
    let result = allOpenGigs

    if (selectedCategory) {
      result = result.filter((g) => g.category === selectedCategory)
    }

    if (query.trim()) {
      const lower = query.toLowerCase()
      result = result.filter(
        (g) =>
          g.title.toLowerCase().includes(lower) ||
          g.description.toLowerCase().includes(lower) ||
          g.city.toLowerCase().includes(lower),
      )
    }

    return result
  }, [query, selectedCategory])

  const renderGigItem = ({ item }: { item: MockGig }) => (
    <GigCardCompact gig={item} />
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
          data={filteredGigs}
          keyExtractor={(item) => item.id}
          renderItem={renderGigItem}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
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
              description="Try adjusting your search or filters"
            />
          }
          ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
          ListFooterComponent={<Spacer size={spacing.xl} />}
        />

        <FilterSheet
          visible={filterOpen}
          onClose={() => setFilterOpen(false)}
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
