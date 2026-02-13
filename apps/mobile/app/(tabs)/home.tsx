import { View, FlatList, StyleSheet } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { Bell } from 'lucide-react-native'
import { spacing, typography } from '@/theme/tokens'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Text } from '@/components/ui/Text'
import { Avatar } from '@/components/ui/Avatar'
import { IconButton } from '@/components/ui/IconButton'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { MoneyText } from '@/components/ui/MoneyText'
import { Spacer } from '@/components/ui/Spacer'
import { GigCard } from '@/components/gig'
import { MOCK_CURRENT_USER, MOCK_GIGS, CATEGORY_META, type MockGig } from '@/data/mock'
import type { ColorScheme } from '@/theme/tokens'

const openGigs = MOCK_GIGS.filter((g) => g.status === 'open')

export default function HomeScreen() {
  const { theme } = useUnistyles()
  const displayName = MOCK_CURRENT_USER.first_name ?? 'there'

  const renderGigItem = ({ item }: { item: MockGig }) => (
    <GigCard gig={item} />
  )

  return (
    <ScreenContainer scroll={false} padding={false}>
      {/* Header */}
      <View style={[s.header, { borderBottomColor: theme.colors.borderFaint }]}>
        <View style={s.headerLeft}>
          <Avatar
            size="md"
            name={`${MOCK_CURRENT_USER.first_name} ${MOCK_CURRENT_USER.last_name}`}
            src={MOCK_CURRENT_USER.avatar_url}
          />
          <View>
            <Text variant="caption" color={theme.colors.textSub}>
              Welcome back
            </Text>
            <Text variant="subheading">{displayName}</Text>
          </View>
        </View>
        <IconButton
          icon={<Bell size={22} color={theme.colors.text} />}
          variant="secondary"
          onPress={() => {}}
        />
      </View>

      <FlatList
        data={openGigs}
        keyExtractor={(item) => item.id}
        renderItem={renderGigItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            {/* Stats overview */}
            <Card variant="filled" padding={spacing.md}>
              <View style={s.statsRow}>
                <View style={s.statItem}>
                  <Text variant="caption" color={theme.colors.textSub}>
                    Balance
                  </Text>
                  <MoneyText amount={2450000} size={typography.sizes.xl} />
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.colors.borderFaint }]} />
                <View style={s.statItem}>
                  <Text variant="caption" color={theme.colors.textSub}>
                    Active
                  </Text>
                  <Text variant="subheading">3</Text>
                </View>
                <View style={[s.statDivider, { backgroundColor: theme.colors.borderFaint }]} />
                <View style={s.statItem}>
                  <Text variant="caption" color={theme.colors.textSub}>
                    Done
                  </Text>
                  <Text variant="subheading">12</Text>
                </View>
              </View>
            </Card>

            <Spacer size={spacing.lg} />

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
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    height: 36,
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
