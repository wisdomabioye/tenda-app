/**
 * Verify-code screen (Stage 9C) — generic OTP entry. Auto-submits on 6 digits
 * → signInWithVerify → routes; a blocked identity surfaces the Tier-0 message
 * and clears the field. Native/UI deps stubbed.
 */
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native'
import { TIER0_MESSAGE } from '@/lib/auth-flow'

const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({ channel: 'email', identifier: 'a@x.io' }),
}))
jest.mock('react-native-unistyles', () => ({
  useUnistyles: () => ({
    theme: { colors: { content: { primary: '#000', secondary: '#333' }, border: { default: '#ccc' } } },
  }),
}))
jest.mock('@/theme/tokens', () => ({ typography: { fonts: { mono: 'mono' } } }))

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

const mockSignInWithVerify = jest.fn()
jest.mock('@/stores/auth.store', () => ({
  useAuthStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel({ signInWithVerify: mockSignInWithVerify }),
    { getState: () => ({ profileComplete: false }) },
  ),
}))

jest.mock('@/api/client', () => {
  // Defined inside the factory so auth-flow's `instanceof ApiClientError`
  // resolves to THIS class (the test imports it from the mocked module too).
  class ApiClientError extends Error {
    statusCode: number
    code?: string
    constructor(statusCode: number, error: string, message: string, code?: string) {
      super(message)
      this.statusCode = statusCode
      this.code = code
    }
  }
  return { api: { auth: { challenge: jest.fn(async () => ({ expires_in: 600 })) } }, ApiClientError }
})

import VerifyCodeScreen from '@/app/(auth)/verify-code'
import { ApiClientError } from '@/api/client'

beforeEach(() => {
  mockReplace.mockReset(); mockShowToast.mockReset(); mockSignInWithVerify.mockReset()
})

test('6 digits auto-submit → verify → route to profile setup', async () => {
  mockSignInWithVerify.mockResolvedValue({ isNew: true })
  render(<VerifyCodeScreen />)
  fireEvent.changeText(screen.getByLabelText('Verification code'), '424242')
  await waitFor(() =>
    expect(mockSignInWithVerify).toHaveBeenCalledWith({ method: 'email', identifier: 'a@x.io', code: '424242' }),
  )
  expect(mockReplace).toHaveBeenCalledWith('/(auth)/profile-setup')
})

test('a blocked identity shows the Tier-0 message and does not route', async () => {
  mockSignInWithVerify.mockRejectedValue(new ApiClientError(409, 'Conflict', 'blocked', 'IDENTITY_ALREADY_LINKED'))
  render(<VerifyCodeScreen />)
  fireEvent.changeText(screen.getByLabelText('Verification code'), '111111')
  await waitFor(() =>
    expect(mockShowToast).toHaveBeenCalledWith('error', TIER0_MESSAGE.identity_already_linked),
  )
  expect(mockReplace).not.toHaveBeenCalled()
})

test('non-numeric input is stripped; under 6 digits does not submit', () => {
  render(<VerifyCodeScreen />)
  fireEvent.changeText(screen.getByLabelText('Verification code'), '12ab')
  expect(mockSignInWithVerify).not.toHaveBeenCalled()
})
