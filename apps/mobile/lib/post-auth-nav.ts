import { useNavigationContainerRef } from 'expo-router'

/**
 * Post-login navigation that CLEARS the auth back-stack.
 *
 * The auth flow `push`es forward (welcome → get-started → connect-wallet / …),
 * and `router.replace` only swaps the TOP route — so the pushed auth screens
 * stay in history and Android back returns to them after sign-in. Instead we
 * `reset` the root navigation container to the destination, leaving a single
 * entry so back from home exits the app.
 *
 * Complete profile → the (tabs) group (home). Incomplete → the onboarding
 * profile-setup screen (still inside the (auth) group, so reset into a nested
 * state) which itself routes onward once the name is captured.
 */
export function usePostAuthReset(): (profileComplete: boolean | null) => void {
  const root = useNavigationContainerRef()
  return (profileComplete) => {
    if (!root.isReady()) return
    if (profileComplete) {
      root.reset({ index: 0, routes: [{ name: '(tabs)' }] })
    } else {
      root.reset({
        index: 0,
        routes: [{ name: '(auth)', state: { index: 0, routes: [{ name: 'profile-setup' }] } }],
      })
    }
  }
}
