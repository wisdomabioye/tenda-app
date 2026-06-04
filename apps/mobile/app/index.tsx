import { Redirect } from 'expo-router'
import { useAuthStore } from '@/stores/auth.store'

export default function Index() {
  const { isAuthenticated, user, jwt, profileComplete } = useAuthStore()

  if (isAuthenticated && user && jwt) {
    // Stage 1: a signed-in user without a name detours through setup.
    // null = /v1/users/me hasn't answered yet — don't block on it; the
    // legacy user row carries the same fields for the common case.
    const complete =
      profileComplete ?? Boolean(user.first_name && user.last_name)
    return <Redirect href={complete ? '/(tabs)/home' : '/(auth)/profile-setup'} />
  }

  return <Redirect href="/(auth)/welcome" />
}
