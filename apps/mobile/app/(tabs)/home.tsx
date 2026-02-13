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
  Avatar,
  IconButton,
  Chip,
  Spacer,
  LiveChip,
} from '@/components/ui'
import { GigCard } from '@/components/gig'
import { Drawer, DrawerHeader } from '@/components/navigation'
import { MOCK_CURRENT_USER, MOCK_GIGS, CATEGORY_META, type MockGig } from '@/data/mock'

const openGigs = MOCK_GIGS.filter((g) => g.status === 'open')

export default function HomeScreen() {
  const { theme } = useUnistyles()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router = useRouter()
  const displayName = MOCK_CURRENT_USER.first_name ?? 'there'

  const renderGigItem = ({ item }: { item: MockGig }) => (
    <GigCard gig={item} />
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
        userImage={undefined}
        userName={displayName}
        onRightPress={() => (router.push('/(tabs)/profile'))}
      />
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
