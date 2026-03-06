import { useMemo } from 'react'
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
import { useConversation } from '@/hooks/useConversation'
import { useMessagePolling } from '@/hooks/useMessagePolling'
import { spacing } from '@/theme/tokens'
import type { LocalMessage } from '@/stores/chat.store'

export default function ChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>()
  const { theme } = useUnistyles()
  const myId = useAuthStore((s) => s.user?.id ?? '')
  const { sendMessage, retryMessage, closeConversation, messages } = useChatStore()

  const { conversationId, otherUser, loading, initError, retry } = useConversation(userId)
  useMessagePolling(conversationId)

  const msgs = conversationId ? (messages[conversationId] ?? []) : []
  const reversedMsgs = useMemo(() => [...msgs].reverse(), [msgs])


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
          onCtaPress={retry}
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
          data={reversedMsgs}
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
