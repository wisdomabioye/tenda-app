import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth.store'

export default function Index() {
  const { isAuthenticated, user, jwt } = useAuthStore()

  if (isAuthenticated && user && jwt) {
    return <Redirect href={'/(tabs)/home'} />
  }

  return <Redirect href="/(auth)/welcome" />
}
