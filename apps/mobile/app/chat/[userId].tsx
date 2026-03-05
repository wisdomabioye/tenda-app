import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  Alert,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { MoreVertical } from 'lucide-react-native'
import { ScreenContainer } from '@/components/ui/ScreenContainer'
import { Header } from '@/components/ui/Header'
import { Text } from '@/components/ui/Text'
import { ErrorState } from '@/components/feedback'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatInput } from '@/components/ui/ChatInput'
import { LoadingScreen } from '@/components/feedback/LoadingScreen'
import { showToast } from '@/components/ui/Toast'
import { useChatStore } from '@/stores/chat.store'
import { useAuthStore } from '@/stores/auth.store'
import { api } from '@/api/client'
import { spacing } from '@/theme/tokens'
import type { LocalMessage } from '@/stores/chat.store'
import type { PublicUser } from '@tenda/shared'

const POLL_INTERVAL_MS = 4_000   // active polling interval
const POLL_IDLE_MS     = 10_000  // back off after 3 empty polls
const EMPTY_POLL_LIMIT = 3

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { theme } = useUnistyles()
  const myId = useAuthStore((s) => s.user?.id ?? '')
  const { findOrCreate, fetchMessages, sendMessage, retryMessage, closeConversation, messages } = useChatStore()

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [otherUser,      setOtherUser]      = useState<PublicUser | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [initError,      setInitError]      = useState(false)

  const pollTimer      = useRef<ReturnType<typeof setTimeout> | null>(null)
  const emptyPollCount = useRef(0)
  const isFetching     = useRef(false)

  const msgs = conversationId ? (messages[conversationId] ?? []) : []

  // ── Bootstrap: find/create conversation + load other user profile ──────────
  const init = useCallback(async (cancelled: { current: boolean }) => {
    if (!userId) return
    setLoading(true)
    setInitError(false)
    try {
      const [conv, user] = await Promise.all([
        findOrCreate(userId),
        api.users.get({ id: userId }),
      ])
      if (cancelled.current) return
      setConversationId(conv.id)
      setOtherUser(user)
      await fetchMessages(conv.id)
    } catch {
      if (!cancelled.current) setInitError(true)
    } finally {
      if (!cancelled.current) setLoading(false)
    }
  }, [userId, findOrCreate, fetchMessages])

  useEffect(() => {
    const cancelled = { current: false }
    init(cancelled)
    return () => { cancelled.current = true }
  }, [init])

  // ── setTimeout polling ─────────────────────────────────────────────────────
  const scheduleNextPoll = useCallback((convId: string) => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
    const delay = emptyPollCount.current >= EMPTY_POLL_LIMIT ? POLL_IDLE_MS : POLL_INTERVAL_MS

    pollTimer.current = setTimeout(async () => {
      if (isFetching.current) {
        scheduleNextPoll(convId)
        return
      }
      isFetching.current = true
      try {
        const existing    = useChatStore.getState().messages[convId] ?? []
        const countBefore = existing.length
        await fetchMessages(convId)
        const countAfter  = (useChatStore.getState().messages[convId] ?? []).length
        if (countAfter === countBefore) {
          emptyPollCount.current += 1
        } else {
          emptyPollCount.current = 0
        }
      } finally {
        isFetching.current = false
        scheduleNextPoll(convId)
      }
    }, delay)
  }, [fetchMessages])

  useEffect(() => {
    if (!conversationId) return
    emptyPollCount.current = 0
    isFetching.current     = false
    scheduleNextPoll(conversationId)
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [conversationId, scheduleNextPoll])


  function handleSend(text: string) {
    if (!conversationId) return
    void sendMessage(conversationId, text)
  }

  function handleRetry(msg: LocalMessage) {
    if (!conversationId) return
    retryMessage(conversationId, msg)
  }

  function handleClose() {
    if (!conversationId) return
    Alert.alert(
      'Close Conversation',
      'This will hide the conversation from your inbox. It will reopen if you message again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Close',
          style: 'destructive',
          onPress: () =>
            closeConversation(conversationId).catch(() =>
              showToast('error', 'Failed to close conversation — please try again')
            ),
        },
      ],
    )
  }

  if (loading) return <LoadingScreen />

  if (initError) {
    return (
      <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right', 'bottom']}>
        <Header title="Chat" showBack />
        <ErrorState
          title="Couldn't open chat"
          description="There was a problem starting this conversation."
          ctaLabel="Retry"
          onCtaPress={() => { const c = { current: false }; void init(c) }}
        />
      </ScreenContainer>
    )
  }

  const displayName = otherUser
    ? [otherUser.first_name, otherUser.last_name].filter(Boolean).join(' ') || 'Anonymous'
    : 'User'

  return (
    <ScreenContainer scroll={false} padding={false} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Header
          title={displayName}
          showBack
          rightIcon={MoreVertical}
          onRightPress={handleClose}
        />

        <FlatList
          data={[...msgs].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble
              message={item}
              isMine={item.sender_id === myId}
              onRetry={item._status === 'failed' ? () => handleRetry(item) : undefined}
            />
          )}
          contentContainerStyle={s.messageList}
          showsVerticalScrollIndicator={false}
          inverted
          ListEmptyComponent={
            <View style={s.empty}>
              <Text variant="body" color={theme.colors.textFaint} align="center">
                No messages yet. Say hi!
              </Text>
            </View>
          }
        />

        <ChatInput onSend={handleSend} />
      </KeyboardAvoidingView>
    </ScreenContainer>
  )
}

const s = StyleSheet.create({
  flex:        { flex: 1 },
  messageList: { paddingTop: spacing.sm, paddingBottom: spacing.sm },
  empty:       { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
})
