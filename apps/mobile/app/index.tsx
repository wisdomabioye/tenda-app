import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { useAuthStore } from '@/stores/auth.store'

export default function Index() {
  const { theme } = useUnistyles()
  const { isAuthenticated, user, jwt, profileComplete, walletAuthInProgress } = useAuthStore()

  if (isAuthenticated && user && jwt) {
    // Stage 1: a signed-in user without a name detours through setup.
    // null = /v1/users/me hasn't answered yet — don't block on it; the
    // legacy user row carries the same fields for the common case.
    const complete =
      profileComplete ?? Boolean(user.first_name && user.last_name)
    return <Redirect href={complete ? '/(tabs)/home' : '/(auth)/profile-setup'} />
  }

  // A wallet sign-in may bounce through `/` via the wallet's `tenda://` return
  // deep link BEFORE /v1/auth/verify sets the session. Hold a spinner instead of
  // flashing welcome/get-started; the redirect above fires once auth resolves
  // (or we fall through to welcome below once the flag clears on failure).
  if (walletAuthInProgress) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.surface.background,
        }}
      >
        <ActivityIndicator color={theme.colors.brand.primary} />
      </View>
    )
  }

  return <Redirect href="/(auth)/welcome" />
}
