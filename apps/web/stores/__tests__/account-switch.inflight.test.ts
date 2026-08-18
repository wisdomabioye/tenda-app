/**
 * A response already in flight when the account changed (#45).
 *
 * `reset()` empties a store at one MOMENT. A request on its way is not stopped
 * by it and writes whatever it was fetching when it lands, so the previous
 * account's rows returned milliseconds after being dropped — the reset was
 * real, and then it was undone. Split from account-switch.test.ts because
 * every case here needs a deferred promise and a resolve after the clear,
 * which reads as a different kind of test.
 *
 * One case per WRITER, not one per store: the guard is applied at each write
 * point, so a store with three of them can be fixed in one and leak in another.
 */
import { vi } from 'vitest'

const { convList, convFindOrCreate, convMessages, notifFeed, notifUnread, escrowAccept } =
  vi.hoisted(() => ({
    convList: vi.fn(),
    convFindOrCreate: vi.fn(),
    convMessages: vi.fn(),
    notifFeed: vi.fn(),
    notifUnread: vi.fn(),
    escrowAccept: vi.fn(),
  }))

vi.mock('@/api/client', () => ({
  api: {
    auth: { verify: vi.fn(), me: vi.fn(), methods: vi.fn() },
    users: { updateMe: vi.fn(), me: vi.fn() },
    conversations: {
      list: (...a: unknown[]) => convList(...a),
      findOrCreate: (...a: unknown[]) => convFindOrCreate(...a),
      messages: (...a: unknown[]) => convMessages(...a),
    },
    notifications: { feed: (...a: unknown[]) => notifFeed(...a), unreadCount: (...a: unknown[]) => notifUnread(...a) },
    escrows: { accept: (...a: unknown[]) => escrowAccept(...a) },
  },
}))
vi.mock('@/wallet/auth', () => ({ signInWithWallet: vi.fn(), linkWalletWith: vi.fn() }))
vi.mock('@/wallet/adapters/reown', () => ({ reownAdapter: { disconnect: vi.fn(async () => {}) } }))

import { api } from '@/api/client'
import { useAuthStore } from '@/stores/auth.store'
import { useChatStore } from '@/stores/chat.store'
import { useNotificationsStore } from '@/stores/notifications.store'
import { useEscrowStore } from '@/stores/escrow.store'
import { makeUser } from '../../test/factories/user'

/** A promise this test resolves by hand, so "in flight" is a real state. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const authApi = vi.mocked(api.auth)

beforeEach(() => {
  useChatStore.getState().reset()
  useNotificationsStore.getState().reset()
  useEscrowStore.getState().reset()
  vi.clearAllMocks()
})

describe('chat', () => {
  it('a conversations load in flight cannot restore the inbox or its badge', async () => {
    const gate = deferred<unknown>()
    convList.mockReturnValue(gate.promise)
    const inFlight = useChatStore.getState().fetchConversations()

    await useAuthStore.getState().logout()
    gate.resolve([{ id: 'conv-1', unread_count: 3 }])
    await inFlight

    expect(useChatStore.getState().conversations).toEqual([])
    expect(useChatStore.getState().unread).toBe(0)
  })

  it('a conversations load that FAILS cannot put an error on the next account', async () => {
    const gate = deferred<unknown>()
    convList.mockReturnValue(gate.promise)
    const inFlight = useChatStore.getState().fetchConversations().catch(() => {})

    await useAuthStore.getState().logout()
    gate.reject(new Error('the abandoned session died'))
    await inFlight

    // 'idle' is what reset leaves; 'error' would be the dead session's failure
    // rendered as the new reader's broken inbox.
    expect(useChatStore.getState().conversationsStatus).toBe('idle')
  })

  it('a failure in the SAME session is still recorded — the guard is not a mute', async () => {
    // The other half of the guard above. Dropping a dead session's error must
    // not cost a live one its error state, or the inbox would fail silently.
    convList.mockRejectedValue(new Error('index down'))

    await expect(useChatStore.getState().fetchConversations()).rejects.toThrow('index down')

    expect(useChatStore.getState().conversationsStatus).toBe('error')
  })

  it('a findOrCreate in flight cannot add its conversation back', async () => {
    const gate = deferred<unknown>()
    convFindOrCreate.mockReturnValue(gate.promise)
    const inFlight = useChatStore.getState().findOrCreate('user-9')

    await useAuthStore.getState().logout()
    gate.resolve({ id: 'conv-new', unread_count: 0 })
    await inFlight

    expect(useChatStore.getState().conversations).toEqual([])
  })

  it('a messages load in flight cannot add a thread back', async () => {
    const gate = deferred<unknown>()
    convMessages.mockReturnValue(gate.promise)
    const inFlight = useChatStore.getState().fetchMessages('conv-1')

    await useAuthStore.getState().logout()
    gate.resolve([{ id: 'm1', conversation_id: 'conv-1', sender_id: 'u1', content: 'private' }])
    await inFlight

    expect(useChatStore.getState().messages).toEqual({})
  })
})

describe('notifications', () => {
  it('a feed load in flight cannot restore the notices', async () => {
    const gate = deferred<unknown>()
    notifFeed.mockReturnValue(gate.promise)
    const inFlight = useNotificationsStore.getState().fetchFeed()

    await useAuthStore.getState().logout()
    gate.resolve({ notifications: [{ id: 'n1', title: 'Paid', body: 'x' }], announcements: [], unread_count: 4 })
    await inFlight

    expect(useNotificationsStore.getState().notifications).toEqual([])
    expect(useNotificationsStore.getState().unread).toBe(0)
  })

  it('an unread-count refresh in flight cannot restore the BELL badge', async () => {
    // The most visible of them: the previous account's unread total sitting on
    // the next account's chrome.
    const gate = deferred<unknown>()
    notifUnread.mockReturnValue(gate.promise)
    const inFlight = useNotificationsStore.getState().refreshUnread()

    await useAuthStore.getState().logout()
    gate.resolve({ count: 7 })
    await inFlight

    expect(useNotificationsStore.getState().unread).toBe(0)
  })
})

describe('escrow', () => {
  it('a transition that FAILS in flight cannot leave its server message behind', async () => {
    const gate = deferred<unknown>()
    escrowAccept.mockReturnValue(gate.promise)
    const inFlight = useEscrowStore.getState().requestAccept('escrow-1').catch(() => {})

    await useAuthStore.getState().logout()
    gate.reject(new Error('Only the escrow creator can attach gig details'))
    await inFlight

    expect(useEscrowStore.getState().error).toBeNull()
    expect(useEscrowStore.getState().isBusy).toBe(false)
  })
})

describe('a request issued while SIGNED OUT', () => {
  it('cannot write into the session that signs in after it', async () => {
    // The generation only moves when state is cleared. A fetch started during
    // the signed-out window captures the post-logout number, and signing in
    // does not move it — so without treating sign-in as an account change too,
    // that response lands in the NEXT account's store. Not hypothetical:
    // logout flips conversation polling on (socket down => enabled), which
    // fires exactly such a request.
    await useAuthStore.getState().logout()

    const gate = deferred<unknown>()
    convList.mockReturnValue(gate.promise)
    const strayed = useChatStore.getState().fetchConversations().catch(() => {})

    authApi.verify.mockResolvedValue({
      token: 'jwt-b',
      user: makeUser({ id: 'user-b', first_name: 'Bola', last_name: 'Ade' }),
      is_new: false,
    })
    await useAuthStore.getState().signInWithVerify({ method: 'email', identifier: 'b@tenda.test', code: '1' })

    gate.resolve([{ id: 'conv-of-nobody', unread_count: 2 }])
    await strayed

    expect(useChatStore.getState().conversations).toEqual([])
    expect(useChatStore.getState().unread).toBe(0)
  })
})
