/**
 * CO7 dispute-mediation thread (party view), ONE shared conversation per
 * dispute: both parties and the mediating admin read/write the same
 * messages. Polls the tail (recursive setTimeout, chat cadence); freezes
 * read-only once the dispute resolves.
 */
import { useMemo } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import type { DisputeMessage } from '@tenda/shared'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { Text } from '@/components/ui/Text'
import { ChatInput } from '@/components/ui/ChatInput'
import { ErrorState } from '@/components/feedback'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { showToast } from '@/components/ui/Toast'
import { DisputeMessageBubble, type DisputeSenderKind } from '@/components/dispute/DisputeMessageBubble'
import { useDisputeThread } from '@/hooks/useDisputeThread'
import { useAuthStore } from '@/stores/auth.store'
import { spacing } from '@/theme/tokens'

export default function DisputeThreadScreen() {
  const { escrowId } = useLocalSearchParams<{ escrowId: string }>()
  const router = useRouter()
  const { theme } = useUnistyles()
  const myId = useAuthStore((s) => s.user?.id ?? '')

  const { loading, error, thread, messages, send, reload } = useDisputeThread(escrowId ?? null)

  // Inverted list wants newest-first.
  const feed = useMemo(() => [...messages].reverse(), [messages])

  function senderKind(message: DisputeMessage): DisputeSenderKind {
    if (message.sender_id === myId) return 'me'
    if (thread !== null && message.sender_id === thread.assigned_to_id) return 'mediator'
    return 'party'
  }

  async function handleSend(text: string) {
    const ok = await send(text)
    if (!ok) showToast('error', 'Message not sent, try again')
  }

  if (loading) return <LoadingScreen />
  if (error !== null || thread === null) {
    return (
      <ScreenContainer>
        <Header title="Dispute" showBack onBackPress={() => router.back()} />
        <ErrorState
          title={error ?? 'Could not load the dispute thread'}
          ctaLabel="Try again"
          onCtaPress={() => void reload()}
        />
      </ScreenContainer>
    )
  }

  return (
    <ScreenContainer>
      <Header title="Dispute mediation" showBack onBackPress={() => router.back()} />
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {thread.assigned_to_id === null && !thread.read_only && (
          <View style={[s.banner, { backgroundColor: theme.colors.surface.inset }]}>
            <Text variant="caption" color={theme.colors.content.secondary}>
              An admin will join this conversation shortly. You can already talk to the other party.
            </Text>
          </View>
        )}
        {thread.read_only && (
          <View style={[s.banner, { backgroundColor: theme.colors.surface.inset }]}>
            <Text variant="caption" color={theme.colors.content.secondary}>
              This dispute is resolved, the conversation is read-only.
            </Text>
          </View>
        )}
        <FlatList
          data={feed}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <DisputeMessageBubble message={item} sender={senderKind(item)} />}
          inverted
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text variant="caption" color={theme.colors.content.tertiary} style={s.emptyText}>
                No messages yet. Explain your side, the other party and the mediator see the same thread.
              </Text>
            </View>
          }
        />
        {!thread.read_only && <ChatInput onSend={(text) => void handleSend(text)} />}
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingVertical: spacing.md },
  banner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: 10,
    padding: spacing.sm,
  },
  empty: {
    padding: spacing.xl,
    // inverted list flips children, flip the empty state back upright
    transform: [{ scaleY: -1 }],
  },
  emptyText: { textAlign: 'center' },
})
