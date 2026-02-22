import { useEffect, useState, useCallback } from 'react'
import { View, FlatList, StyleSheet, RefreshControl, Pressable } from 'react-native'
import { useUnistyles } from 'react-native-unistyles'
import { spacing } from '@/theme/tokens'
import { ScreenContainer, Text, Spacer, EmptyState, Header } from '@/components/ui'
import { GigCardCompact } from '@/components/gig'
import { useAuthStore } from '@/stores/auth.store'
import { useUserGigsStore } from '@/stores/user-gigs.store'
import type { Gig } from '@tenda/shared'
import { ClipboardList } from 'lucide-react-native'

type TabKey = 'posted' | 'working'

export default function MyGigsScreen() {
  const { theme } = useUnistyles()
  const user = useAuthStore((s) => s.user)
  const { postedGigs, workedGigs, isLoading, fetchPostedGigs, fetchWorkedGigs } = useUserGigsStore()
  const [activeTab, setActiveTab] = useState<TabKey>('posted')
  const [refreshing, setRefreshing] = useState(false)

  const fetchCurrent = useCallback(() => {
    if (!user?.id) return
    if (activeTab === 'posted') return fetchPostedGigs(user.id)
    return fetchWorkedGigs(user.id)
  }, [user?.id, activeTab, fetchPostedGigs, fetchWorkedGigs])

  useEffect(() => {
    fetchCurrent()
  }, [fetchCurrent])

  async function handleRefresh() {
    setRefreshing(true)
    await fetchCurrent()
    setRefreshing(false)
  }

  const data: Gig[] = activeTab === 'posted' ? postedGigs : workedGigs

  const renderItem = ({ item }: { item: Gig }) => (
    <GigCardCompact gig={item} showStatus />
  )

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
      <Header title="My Gigs" showBack />

      {/* Tab bar */}
      <View style={[s.tabBar, { borderBottomColor: theme.colors.borderFaint }]}>
        {(['posted', 'working'] as TabKey[]).map((tab) => {
          const active = activeTab === tab
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                s.tab,
                active && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
              ]}
            >
              <Text
                weight="semibold"
                size={15}
                color={active ? theme.colors.primary : theme.colors.textSub}
              >
                {tab === 'posted' ? 'Posted' : 'Working'}
              </Text>
            </Pressable>
          )
        })}
      </View>

      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing || isLoading}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        ItemSeparatorComponent={() => <Spacer size={spacing.sm} />}
        ListFooterComponent={<Spacer size={spacing.xl} />}
        ListEmptyComponent={
          !isLoading ? (
            <View style={s.empty}>
              <EmptyState
                icon={<ClipboardList size={40} color={theme.colors.textFaint} />}
                title={activeTab === 'posted' ? 'No gigs posted yet' : 'Not working on any gigs'}
                description={
                  activeTab === 'posted'
                    ? 'Post your first gig to get started'
                    : 'Browse the feed to find and accept gigs'
                }
              />
            </View>
          ) : null
        }
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  empty: {
    paddingTop: spacing['2xl'],
  },
})
