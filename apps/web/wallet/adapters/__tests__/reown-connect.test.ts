/**
 * Imperative connect-wait over a faked ConnectModal: resolve on account,
 * decline on close-without-account, tolerate the close-vs-account race, and
 * always unsubscribe. WALLET_CHAINS supplies the CAIP fallback (dev build:
 * solana:devnet / first testnet EVM chain).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WalletError } from '@tenda/shared'
import type { ChainNamespace } from '@tenda/shared'
import {
  connectedAccount,
  waitForConnection,
  MODAL_OPEN_TIMEOUT_MS,
  type ConnectModal,
} from '@/wallet/adapters/reown-connect'
import { WALLET_CHAINS } from '@/wallet/config'

afterEach(() => {
  vi.useRealTimers()
})

type AccountCb = () => void
type StateCb = (state: { open: boolean }) => void

class FakeModal implements ConnectModal {
  addresses: Partial<Record<ChainNamespace, string>> = {}
  caip: Partial<Record<ChainNamespace, string>> = {}
  accountCbs: Array<{ cb: AccountCb; ns: ChainNamespace }> = []
  stateCbs: StateCb[] = []
  unsubscribed = 0
  opened = 0
  openError: Error | null = null
  /** Simulates AppKit's untimed prefetch black-holing: open() never settles. */
  openNeverResolves = false

  getAddress(ns: ChainNamespace) {
    return this.addresses[ns]
  }
  getCaipNetwork(ns: ChainNamespace) {
    const id = this.caip[ns]
    return id === undefined ? undefined : { caipNetworkId: id }
  }
  subscribeAccount(cb: AccountCb, ns: ChainNamespace) {
    this.accountCbs.push({ cb, ns })
    return () => {
      this.unsubscribed += 1
    }
  }
  subscribeState(cb: StateCb) {
    this.stateCbs.push(cb)
    return () => {
      this.unsubscribed += 1
    }
  }
  async open() {
    this.opened += 1
    if (this.openError !== null) throw this.openError
    if (this.openNeverResolves) return new Promise<never>(() => {})
  }

  emitAccount(ns: ChainNamespace, address: string) {
    this.addresses[ns] = address
    for (const entry of this.accountCbs) entry.cb()
  }
  emitState(open: boolean) {
    for (const cb of this.stateCbs) cb({ open })
  }
  /** The real sequence: the modal opens before the user can dismiss it. */
  emitOpenedThenClosed() {
    this.emitState(true)
    this.emitState(false)
  }
}

describe('connectedAccount', () => {
  it('is null with no connection; prefers Solana; falls back to WALLET_CHAINS for the chain id', () => {
    const modal = new FakeModal()
    expect(connectedAccount(modal)).toBeNull()

    modal.addresses = { eip155: '0xabc', solana: 'SoL1' }
    expect(connectedAccount(modal)).toEqual({
      namespace: 'solana',
      chainId: WALLET_CHAINS.solana, // no live network reported → canonical id
      address: 'SoL1',
      walletId: 'reown',
    })
  })

  it('uses the modal-reported CAIP network when present', () => {
    const modal = new FakeModal()
    modal.addresses = { eip155: '0xabc' }
    modal.caip = { eip155: 'eip155:8453' }
    expect(connectedAccount(modal)).toMatchObject({ namespace: 'eip155', chainId: 'eip155:8453' })
  })
})

describe('waitForConnection', () => {
  it('opens the modal and resolves when an account connects; unsubscribes everything', async () => {
    const modal = new FakeModal()
    const pending = waitForConnection(modal)
    expect(modal.opened).toBe(1)
    modal.emitAccount('eip155', '0xabc')
    await expect(pending).resolves.toMatchObject({ address: '0xabc', namespace: 'eip155' })
    expect(modal.unsubscribed).toBe(3) // 2 account subs + 1 state sub
  })

  it('close without an account is a typed decline (WalletError declined)', async () => {
    const modal = new FakeModal()
    const pending = waitForConnection(modal)
    modal.emitOpenedThenClosed()
    await expect(pending).rejects.toMatchObject({ name: 'WalletError', code: 'declined' })
  })

  it('pre-open state churn (loading flips while open is still false) is NOT a decline', async () => {
    // AppKit's open() awaits a prefetch and writes `loading: true` BEFORE
    // `open: true`; valtio notifies on that write. Without the modalWasOpen
    // gate this event instantly rejected every first connect as "declined".
    const modal = new FakeModal()
    const pending = waitForConnection(modal)
    modal.emitState(false) // the pre-open loading notification
    modal.emitState(true) // modal actually opens
    modal.emitAccount('eip155', '0xabc') // user connects
    await expect(pending).resolves.toMatchObject({ address: '0xabc' })
  })

  it('close AFTER the account landed still resolves (same-tick close race)', async () => {
    const modal = new FakeModal()
    const pending = waitForConnection(modal)
    modal.emitState(true)
    modal.addresses = { solana: 'SoL1' } // account state landed, event not fired
    modal.emitState(false)
    await expect(pending).resolves.toMatchObject({ address: 'SoL1' })
  })

  it('after open() RESOLVES, a close counts as a dismissal even if open:true was never observed', async () => {
    const modal = new FakeModal()
    const pending = waitForConnection(modal)
    await Promise.resolve() // let open()'s resolution mark the modal as presented
    modal.emitState(false)
    await expect(pending).rejects.toMatchObject({ code: 'declined' })
  })

  it('a modal that never OPENS times out with a typed error (untimed AppKit prefetch)', async () => {
    vi.useFakeTimers()
    const modal = new FakeModal()
    modal.openNeverResolves = true // a black-holed prefetch: open() never settles
    const pending = waitForConnection(modal)
    vi.advanceTimersByTime(MODAL_OPEN_TIMEOUT_MS + 1)
    await expect(pending).rejects.toMatchObject({ name: 'WalletError', code: 'timeout' })
  })

  it('an OPEN modal never times out — the user’s decision time is unbounded', async () => {
    vi.useFakeTimers()
    const modal = new FakeModal()
    modal.openNeverResolves = true // even so: the open EVENT alone lifts the bound
    const pending = waitForConnection(modal)
    modal.emitState(true) // the modal is up; the user is thinking
    vi.advanceTimersByTime(MODAL_OPEN_TIMEOUT_MS * 10)
    modal.emitAccount('solana', 'SoL1') // …and eventually connects
    await expect(pending).resolves.toMatchObject({ address: 'SoL1' })
  })

  it('a failed modal open rejects with a typed unknown error', async () => {
    const modal = new FakeModal()
    modal.openError = new Error('relay down')
    await expect(waitForConnection(modal)).rejects.toBeInstanceOf(WalletError)
    await waitForConnection(modal).catch((e: WalletError) => expect(e.code).toBe('unknown'))
  })
})
