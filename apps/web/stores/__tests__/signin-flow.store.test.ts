/** In-memory challenge hand-off — the email must never ride the URL. */
import { vi } from 'vitest'
import { useSigninFlowStore } from '@/stores/signin-flow.store'

beforeEach(() => {
  useSigninFlowStore.setState({ pending: null })
})

describe('signin flow store', () => {
  it('begin records channel, identifier and the send time', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    useSigninFlowStore.getState().begin('email', 'ada@x.io')
    expect(useSigninFlowStore.getState().pending).toEqual({
      channel: 'email',
      identifier: 'ada@x.io',
      sentAt: 1_000_000,
    })
    vi.useRealTimers()
  })

  it('markResent refreshes the cooldown anchor without touching the identifier', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    useSigninFlowStore.getState().begin('email', 'ada@x.io')
    vi.setSystemTime(2_000_000)
    useSigninFlowStore.getState().markResent()
    expect(useSigninFlowStore.getState().pending).toEqual({
      channel: 'email',
      identifier: 'ada@x.io',
      sentAt: 2_000_000,
    })
    vi.useRealTimers()
  })

  it('markResent with nothing pending is a no-op', () => {
    useSigninFlowStore.getState().markResent()
    expect(useSigninFlowStore.getState().pending).toBeNull()
  })

  it('clear drops the pending challenge', () => {
    useSigninFlowStore.getState().begin('email', 'ada@x.io')
    useSigninFlowStore.getState().clear()
    expect(useSigninFlowStore.getState().pending).toBeNull()
  })
})
