import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import * as Notifications from 'expo-notifications'

/**
 * Listens for notification taps and deep-links to the relevant screen.
 * Supported: { screen: 'gig', gigId } and { screen: 'chat', userId }.
 */
export function useNotificationDeepLink() {
  const router = useRouter()

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined
      if (!data) return
      if (data.screen === 'gig' && data.gigId) {
        router.push(`/gig/${data.gigId}` as Parameters<typeof router.push>[0])
      } else if (data.screen === 'chat' && data.userId) {
        router.push(`/chat/${data.userId}` as Parameters<typeof router.push>[0])
      }
    })
    return () => sub.remove()
  }, [router])
}
