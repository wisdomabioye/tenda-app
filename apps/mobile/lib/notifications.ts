import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import Constants from 'expo-constants'
import { api } from '@/api/client'

/** Configure how notifications are presented when the app is in the foreground. */
export function configureNotifications() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge:  false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  })
}

/**
 * Request permission and register the device push token with the server.
 * Safe to call multiple times — silently no-ops if permission is denied.
 */
export async function registerPushToken(): Promise<void> {
  // Android requires a channel before requesting a token
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }

  if (finalStatus !== 'granted') return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId })
  await api.notifications.registerToken({ token: tokenData.data, platform: tokenData.type /* always 'expo' */ })
}
