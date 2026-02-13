import { useState, useMemo } from 'react'
import { View, FlatList, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Search as SearchIcon, SlidersHorizontal } from 'lucide-react-native'
import { 
  ScreenContainer,
  Text,
  Input,
  Chip,
  EmptyState,
  Spacer,
  Header
} from '@/components/ui'
import { GigCardCompact } from '@/components/gig'
import { MOCK_GIGS, CATEGORY_META, type MockGig } from '@/data/mock'
import { spacing } from '@/theme/tokens'
import type { ColorScheme } from '@/theme/tokens'

const allGigs = MOCK_GIGS.filter((g) => g.status === 'open')

export default function SearchScreen() {
  const { theme } = useUnistyles()
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const filteredGigs = useMemo(() => {
    let result = allGigs

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

  const handleCategoryPress = (key: string) => {
    setSelectedCategory((prev) => (prev === key ? null : key))
  }

  const renderGigItem = ({ item }: { item: MockGig }) => (
    <GigCardCompact gig={item} showStatus={false} variant="pill" />
  )

  return (
    <ScreenContainer scroll={false} padding={false}>
      <Header
        title="Search"
        rightIcon={SlidersHorizontal}
        onRightPress={() => {}}
        showBack
      />

      <View style={s.topSection}>
        <Text variant="body" color={theme.colors.textSub}>
          Find gigs by title, category, or city
        </Text>
        <Spacer size={spacing.md} />

        <Input
          placeholder="Search gigs, categories, cities..."
          value={query}
          onChangeText={setQuery}
          icon={<SearchIcon size={18} color={theme.colors.textFaint} />}
        />

        <Spacer size={spacing.md} />

        <View style={s.filter}>
          {CATEGORY_META.map((cat) => {
            const colorKey = `category${cat.label}` as keyof ColorScheme
            return (
              <Chip
                key={cat.key}
                label={cat.label}
                selected={selectedCategory === cat.key}
                color={theme.colors[colorKey]}
                onPress={() => handleCategoryPress(cat.key)}
              />
            )
          })}
        </View>
      </View>

      {/* Results */}
      <FlatList
        data={filteredGigs}
        keyExtractor={(item) => item.id}
        renderItem={renderGigItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
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
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  topSection: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  filter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
})
