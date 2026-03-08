import { useCallback, useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MessageCircle } from 'lucide-react-native'
import { ScreenContainer, Text, Spacer, Header } from '@/components/ui'
import { Divider } from '@/components/ui/Divider'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/feedback'
import { ConversationItem } from '@/components/chat/ConversationItem'
import { useChatStore } from '@/stores/chat.store'
import { spacing } from '@/theme/tokens'

export default function MessagesScreen() {
  const { theme } = useUnistyles()
  const router    = useRouter()
  const { conversations, fetchConversations } = useChatStore()
  const [fetchError, setFetchError] = useState(false)

  const load = useCallback(() => {
    setFetchError(false)
    fetchConversations().catch(() => setFetchError(true))
  }, [fetchConversations])

  useFocusEffect(load)

  return (
    <ScreenContainer scroll={false} padding={false} edges={['left', 'right']}>
      <Header title="Messages" />
      <Spacer size={spacing.sm} />
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        ItemSeparatorComponent={() => <Divider spacing={0} />}
        renderItem={({ item }) => (
          <ConversationItem
            conversation={item}
            onPress={() => router.push(`/chat/${item.other_user.id}` as Parameters<typeof router.push>[0])}
          />
        )}
        ListEmptyComponent={
          <View style={s.emptyWrapper}>
            {fetchError ? (
              <ErrorState
                title="Couldn't load messages"
                description="Check your connection and try again."
                ctaLabel="Retry"
                onCtaPress={load}
              />
            ) : (
              <EmptyState
                icon={<MessageCircle size={40} color={theme.colors.textFaint} />}
                title="No conversations yet"
                description="Start a conversation by messaging a gig poster or worker."
              />
            )}
          </View>
        }
        contentContainerStyle={conversations.length === 0 ? s.emptyContainer : undefined}
      />
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  emptyWrapper: {
    flex:           1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        spacing.xl,
  },
  emptyContainer: { flex: 1 },
})
