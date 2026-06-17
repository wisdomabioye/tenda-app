/**
 * Get-started screen (Stage 9C). Exercises control flow, not pixels: the
 * method options render, Google runs verify → routes, a cancelled Google
 * sign-in is silent, and the phone path validates → challenges → routes to
 * verify-code. Native/UI deps are stubbed. (jest hoists mock factories above
 * imports, so factory-referenced vars are `mock`-prefixed.)
 */
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: mockReplace }) }))
jest.mock('lucide-react-native', () => new Proxy({}, { get: () => () => null }))
jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({ theme: { colors: { content: { primary: '#000', secondary: '#333' } } } }),
}))

const mockShowToast = jest.fn()
jest.mock('@/components/ui', () => {
  const { Pressable, Text } = require('react-native')
  return {
    ScreenContainer: ({ children }: { children: React.ReactNode }) => children,
    Header: () => null,
    Text: ({ children }: { children: React.ReactNode }) => <Text>{children}</Text>,
    Button: ({ children, onPress, disabled }: { children: React.ReactNode; onPress?: () => void; disabled?: boolean }) => (
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}>
        <Text>{children}</Text>
      </Pressable>
    ),
    showToast: (...a: unknown[]) => mockShowToast(...a),
  }
})
jest.mock('@/components/ui/Input', () => {
  const { TextInput } = require('react-native')
  return {
    Input: ({ value, onChangeText, placeholder }: { value: string; onChangeText: (t: string) => void; placeholder?: string }) => (
      <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} />
    ),
  }
})

const mockSignInWithVerify = jest.fn(async () => ({ isNew: true }))
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel({ signInWithVerify: mockSignInWithVerify }),
    { getState: () => ({ profileComplete: false }) },
  ),
}))

const mockChallenge = jest.fn(async () => ({ expires_in: 600 }))
jest.mock('@/api/client', () => ({
  api: { auth: { challenge: (...a: unknown[]) => mockChallenge(...a) } },
  ApiClientError: class extends Error {},
}))

const mockSignInWithGoogle = jest.fn()
jest.mock('@/lib/google-signin', () => ({
  signInWithGoogle: () => mockSignInWithGoogle(),
  configureGoogleSignIn: jest.fn(),
  GoogleSignInError: class extends Error {
    reason: string
    constructor(reason: string) { super(reason); this.reason = reason }
  },
}))
const mockIsAppleAvailable = jest.fn(async () => false)
jest.mock('@/lib/apple-signin', () => ({
  signInWithApple: jest.fn(),
  isAppleAvailable: () => mockIsAppleAvailable(),
  AppleSignInError: class extends Error {},
}))

import GetStartedScreen from '@/app/(auth)/get-started'
import { GoogleSignInError } from '@/lib/google-signin'

beforeEach(() => {
  mockPush.mockReset(); mockReplace.mockReset(); mockShowToast.mockReset()
  mockSignInWithVerify.mockClear()
  mockSignInWithGoogle.mockReset()
  mockChallenge.mockReset(); mockChallenge.mockResolvedValue({ expires_in: 600 })
})

test('renders the contact + social options', async () => {
  render(<GetStartedScreen />)
  await waitFor(() => expect(screen.getByText('Continue with Google')).toBeTruthy())
  expect(screen.getByText('Continue with phone')).toBeTruthy()
  expect(screen.getByText('Continue with email')).toBeTruthy()
  expect(screen.getByText('Sign in with a wallet')).toBeTruthy()
})

test('Google: verifies the id_token then routes', async () => {
  mockSignInWithGoogle.mockResolvedValue('id-tok')
  render(<GetStartedScreen />)
  fireEvent.press(screen.getByText('Continue with Google'))
  await waitFor(() =>
    expect(mockSignInWithVerify).toHaveBeenCalledWith({ method: 'google', id_token: 'id-tok' }),
  )
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup') // profileComplete=false
})

test('Google cancellation is silent — no toast, no nav', async () => {
  mockSignInWithGoogle.mockRejectedValue(new GoogleSignInError('cancelled'))
  render(<GetStartedScreen />)
  fireEvent.press(screen.getByText('Continue with Google'))
  await waitFor(() => expect(mockSignInWithGoogle).toHaveBeenCalled())
  expect(mockShowToast).not.toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})

test('phone: a valid number challenges then routes to verify-code', async () => {
  render(<GetStartedScreen />)
  fireEvent.press(screen.getByText('Continue with phone'))
  fireEvent.changeText(screen.getByPlaceholderText('+2348012345678'), '+2348012345678')
  fireEvent.press(screen.getByText('Send code'))
  await waitFor(() =>
    expect(mockChallenge).toHaveBeenCalledWith({ method: 'phone', identifier: '+2348012345678' }),
  )
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/(auth)/verify-code',
    params: { channel: 'phone', identifier: '+2348012345678' },
  })
})

test('phone: an invalid number is rejected before any challenge', async () => {
  render(<GetStartedScreen />)
  fireEvent.press(screen.getByText('Continue with phone'))
  fireEvent.changeText(screen.getByPlaceholderText('+2348012345678'), '08012345678') // not E.164
  fireEvent.press(screen.getByText('Send code'))
  await waitFor(() => expect(mockShowToast).toHaveBeenCalled())
  expect(mockChallenge).not.toHaveBeenCalled()
})
