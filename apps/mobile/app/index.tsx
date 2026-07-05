import { ActivityIndicator, View } from 'react-native'
import { Redirect } from 'expo-router'
import { useUnistyles } from 'react-native-unistyles'
import { useAuthStore } from '@/stores/auth.store'

export default function Index() {
  const { theme } = useUnistyles()
  const { isAuthenticated, user, jwt, profileComplete, walletAuthInProgress } = useAuthStore()

  // A wallet sign-in OR an additional-wallet link bounces the app through `/`
  // via the wallet's `tenda://` auto-return deep link, mid round-trip. Hold a
  // spinner, checked BEFORE the authed redirect so a LINK (the user is already
  // authenticated) isn't yanked to home, which would pop the linked-wallets
  // screen and abort the in-flight sign+POST. The owning flow navigates on
  // completion (usePostAuthReset for sign-in, useReturnToLinkedWallets for a
  // link); on failure the flag clears and the redirects below take over.
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

  if (isAuthenticated && user && jwt) {
    // Stage 1: a signed-in user without a name detours through setup.
    // null = /v1/users/me hasn't answered yet, don't block on it; the
    // legacy user row carries the same fields for the common case.
    const complete =
      profileComplete ?? Boolean(user.first_name && user.last_name)
    return <Redirect href={complete ? '/(tabs)/home' : '/(auth)/profile-setup'} />
  }

  return <Redirect href="/(auth)/welcome" />
}
