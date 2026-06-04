/**
 * chains/evm — builders (encode/decode round-trip + native-value rules),
 * verify pipeline (confirmations, revert, event decode, escrow_id check),
 * fetchEscrowState mapping, EOA auth-sig verify, paymaster sponsorship
 * with quota + degradation. Fully offline: fake EvmRpc/PaymasterHttp;
 * viem's pure encode/decode/sign primitives need no network.
 */

import { test } from 'node:test'
import * as assert from 'node:assert'
import {
  decodeFunctionData,
  encodeAbiParameters,
  encodeEventTopics,
  toHex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { evmAdapter, type EvmAdapterDeps } from '@server/chains/evm'
import { buildEvmCall } from '@server/chains/evm/builders'
import { decodeEscrowLogs, escrowIdHexToUuid } from '@server/chains/evm/verify'
import { ESCROW_EVM_ABI, ZERO_ADDRESS, type EvmReceipt, type EvmRpc } from '@server/chains/evm/rpc'
import type { PaymasterHttp } from '@server/chains/evm/paymaster'
import { uuidToBytes } from '@server/chains/ids'
import { extractTxHashes } from '@server/routes/v1/webhooks/alchemy'

const CHAIN_ID = 'eip155:8453'
const CONTRACT = '0x00000000000000000000000000000000000000e5' as const
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const UUID = '0d9cd2a4-3f1e-4b6a-9c3d-2f1e4b6a9c3d'
const UUID_HEX = toHex(uuidToBytes(UUID))
const CREATOR = '0x1111111111111111111111111111111111111111'
const WORKER = '0x2222222222222222222222222222222222222222'
const TX = `0x${'ab'.repeat(32)}` as const

// ---------- fakes -----------------------------------------------------------

function fakeRpc(overrides: Partial<EvmRpc> = {}): EvmRpc {
  return {
    async getTransactionReceipt() {
      return null
    },
    async getBlockNumber() {
      return 100n
    },
    async readEscrow() {
      return null
    },
    ...overrides,
  }
}

function makeAdapter(deps: Partial<EvmAdapterDeps> = {}) {
  return evmAdapter({
    chain_id: CHAIN_ID,
    rpc_url: 'http://unused.invalid',
    escrow_contract: CONTRACT,
    min_confirmations: 5,
    deps: {
      resolveWalletAddress: async () => CREATOR,
      resolveAsset: async (asset) =>
        asset === 'ETH_BASE' ? { token_address: null } : { token_address: USDC },
      rpc: fakeRpc(),
      ...deps,
    },
  })
}

const CREATE_ARGS = {
  action: 'createEscrow' as const,
  user_id: 'u1',
  payload: {
    escrow_id: UUID,
    kind: 'gig' as const,
    asset: 'USDC_BASE',
    amount_raw: '1000000',
    accept_deadline_unix: 1_900_000_000,
    completion_duration_seconds: 7_200,
    dispute_bond_raw: '50000',
    is_seeker: false,
  },
}

// ---------- builders ---------------------------------------------------------

test('builders: createEscrow round-trips through the ABI; ERC-20 carries no value', () => {
  const call = buildEvmCall(CREATE_ARGS, {
    asset_address: USDC,
    assigned_counterparty_address: null,
  })
  assert.strictEqual(call.value_raw, '0')
  const decoded = decodeFunctionData({ abi: ESCROW_EVM_ABI, data: call.data })
  assert.strictEqual(decoded.functionName, 'createEscrow')
  const args = decoded.args as readonly unknown[]
  assert.strictEqual(String(args[0]).toLowerCase(), UUID_HEX.toLowerCase())
  assert.strictEqual(args[1], 0) // gig
  assert.strictEqual(String(args[2]).toLowerCase(), USDC.toLowerCase())
  assert.strictEqual(args[3], 1_000_000n)
  assert.strictEqual(String(args[4]), ZERO_ADDRESS)
  assert.strictEqual(args[8], false)
})

test('builders: native create carries amount as value; native dispute carries bond', () => {
  const native = buildEvmCall(
    { ...CREATE_ARGS, payload: { ...CREATE_ARGS.payload, asset: 'ETH_BASE' } },
    { asset_address: null, assigned_counterparty_address: null },
  )
  assert.strictEqual(native.value_raw, '1000000')

  const dispute = buildEvmCall(
    { action: 'disputeEscrow', user_id: 'u1', payload: { escrow_id: UUID, bond_raw: '777' } },
    { asset_address: null, assigned_counterparty_address: null },
  )
  assert.strictEqual(dispute.value_raw, '777')

  const disputeErc20 = buildEvmCall(
    { action: 'disputeEscrow', user_id: 'u1', payload: { escrow_id: UUID, bond_raw: '777' } },
    { asset_address: USDC, assigned_counterparty_address: null },
  )
  assert.strictEqual(disputeErc20.value_raw, '0')
})

test('builders: every escrow-id action encodes its own selector; resolveDispute maps winner codes', () => {
  for (const action of [
    'acceptEscrow',
    'declineAssignedEscrow',
    'approveCompletion',
    'claimStalledPayment',
    'cancelEscrow',
    'refundExpired',
    'reclaimAbandoned',
  ] as const) {
    const call = buildEvmCall(
      { action, user_id: 'u1', payload: { escrow_id: UUID } },
      { asset_address: null, assigned_counterparty_address: null },
    )
    const decoded = decodeFunctionData({ abi: ESCROW_EVM_ABI, data: call.data })
    assert.strictEqual(decoded.functionName, action)
  }

  const resolve = buildEvmCall(
    {
      action: 'resolveDispute',
      user_id: 'admin',
      payload: { escrow_id: UUID, winner: 'split', raiser_user_id: 'u9' },
    },
    { asset_address: null, assigned_counterparty_address: null },
  )
  const decoded = decodeFunctionData({ abi: ESCROW_EVM_ABI, data: resolve.data })
  assert.strictEqual(decoded.functionName, 'resolveDispute')
  assert.strictEqual((decoded.args as readonly unknown[])[1], 2)

  const submit = buildEvmCall(
    {
      action: 'submitProof',
      user_id: 'u1',
      payload: { escrow_id: UUID, proof_hash: `0x${'11'.repeat(32)}` },
    },
    { asset_address: null, assigned_counterparty_address: null },
  )
  assert.strictEqual(
    decodeFunctionData({ abi: ESCROW_EVM_ABI, data: submit.data }).functionName,
    'submitProof',
  )
})

// ---------- event decode --------------------------------------------------------

function acceptedLog() {
  // EscrowAccepted(bytes16 indexed escrowId, address indexed counterparty)
  const topics = encodeEventTopics({
    abi: ESCROW_EVM_ABI,
    eventName: 'EscrowAccepted',
    args: { escrowId: UUID_HEX, counterparty: WORKER },
  })
  return { address: CONTRACT, topics: [...topics] as `0x${string}`[], data: '0x' as `0x${string}` }
}

function createdLog() {
  // EscrowCreated(bytes16 indexed, address indexed, uint8 kind, address asset, uint256 amount)
  const topics = encodeEventTopics({
    abi: ESCROW_EVM_ABI,
    eventName: 'EscrowCreated',
    args: { escrowId: UUID_HEX, creator: CREATOR },
  })
  const data = encodeAbiParameters(
    [{ type: 'uint8' }, { type: 'address' }, { type: 'uint256' }],
    [0, USDC, 1_000_000n],
  )
  return { address: CONTRACT, topics: [...topics] as `0x${string}`[], data }
}

test('decodeEscrowLogs: decodes wire events, stringifies amounts, recovers the UUID, skips foreign logs', () => {
  const foreign = { address: USDC, topics: [`0x${'00'.repeat(32)}`] as `0x${string}`[], data: '0x' as `0x${string}` }
  const events = decodeEscrowLogs([foreign, createdLog(), acceptedLog()], CONTRACT, CHAIN_ID)
  assert.strictEqual(events.length, 2)

  const created = events[0]
  assert.strictEqual(created.name, 'EscrowCreated')
  assert.strictEqual(created.fields.amount, '1000000')
  assert.strictEqual(created.fields.escrow_id_uuid, UUID)
  assert.strictEqual(created.actor, `${CHAIN_ID}:${CREATOR}`)

  assert.strictEqual(events[1].name, 'EscrowAccepted')
  assert.strictEqual(events[1].actor, `${CHAIN_ID}:${WORKER}`)
})

test('escrowIdHexToUuid round-trips uuidToBytes', () => {
  assert.strictEqual(escrowIdHexToUuid(UUID_HEX), UUID)
})

// ---------- verifyTx --------------------------------------------------------------

function receipt(overrides: Partial<EvmReceipt> = {}): EvmReceipt {
  return { status: 'success', block_number: 90n, logs: [acceptedLog()], ...overrides }
}

test('verifyTx: unknown receipt → not confirmed; young receipt → pending', async () => {
  const a1 = makeAdapter({ rpc: fakeRpc() })
  assert.deepStrictEqual(await a1.verifyTx(TX, {}), {
    confirmed: false,
    reason: 'receipt not found',
  })

  const a2 = makeAdapter({
    rpc: fakeRpc({
      getTransactionReceipt: async () => receipt({ block_number: 98n }), // 2 confs < 5
    }),
  })
  const r = await a2.verifyTx(TX, {})
  assert.deepStrictEqual(r, { confirmed: false, pending: true, reason: 'awaiting confirmations' })
})

test('verifyTx: reverted tx is confirmed+failed; success decodes the expected event', async () => {
  const reverted = makeAdapter({
    rpc: fakeRpc({ getTransactionReceipt: async () => receipt({ status: 'reverted' }) }),
  })
  const r1 = await reverted.verifyTx(TX, {})
  assert.ok(r1.confirmed === true && r1.failed === true)

  const ok = makeAdapter({
    rpc: fakeRpc({ getTransactionReceipt: async () => receipt() }),
  })
  const r2 = await ok.verifyTx(TX, { expected_event: 'EscrowAccepted', escrow_id: UUID })
  assert.ok(r2.confirmed === true && r2.failed === false)
  assert.strictEqual(r2.event.name, 'EscrowAccepted')

  const wrongEvent = await ok.verifyTx(TX, { expected_event: 'EscrowApproved' })
  assert.ok(wrongEvent.confirmed === true && wrongEvent.failed === true)

  const wrongId = await ok.verifyTx(TX, {
    expected_event: 'EscrowAccepted',
    escrow_id: '00000000-0000-4000-8000-000000000000',
  })
  assert.ok(wrongId.confirmed === true && wrongId.failed === true)
})

// ---------- fetchEscrowState ---------------------------------------------------------

test('fetchEscrowState maps the tuple, zero-address sentinels and status enum', async () => {
  const adapter = makeAdapter({
    rpc: fakeRpc({
      readEscrow: async () => ({
        escrow_id: UUID_HEX,
        kind: 1,
        asset: ZERO_ADDRESS as `0x${string}`,
        amount: 5_000n,
        creator: CREATOR as `0x${string}`,
        counterparty: WORKER as `0x${string}`,
        assigned_counterparty: ZERO_ADDRESS as `0x${string}`,
        status: 2,
        accept_deadline: 1_900_000_000n,
        completion_duration: 7_200n,
        completion_deadline: 1_900_007_200n,
        approval_deadline: 1_900_010_000n,
        dispute_bond: 50n,
        is_seeker: true,
        raised_by: ZERO_ADDRESS as `0x${string}`,
      }),
    }),
  })
  const state = await adapter.fetchEscrowState(UUID_HEX)
  assert.ok(state !== null)
  assert.strictEqual(state.escrow_id, UUID)
  assert.strictEqual(state.kind, 'exchange')
  assert.strictEqual(state.asset_address, null)
  assert.strictEqual(state.counterparty_address, WORKER)
  assert.strictEqual(state.assigned_counterparty_address, null)
  assert.strictEqual(state.status, 'submitted')
  assert.strictEqual(state.amount_raw, '5000')
  assert.strictEqual(state.is_seeker, true)

  const missing = makeAdapter({ rpc: fakeRpc() })
  assert.strictEqual(await missing.fetchEscrowState(UUID_HEX), null)
})

// ---------- auth sig ---------------------------------------------------------------

test('verifyAuthSig: EOA personal_sign verifies; wrong address and garbage fail', async () => {
  const account = privateKeyToAccount(`0x${'07'.repeat(32)}`)
  const message = 'Tenda wants you to sign in with your wallet:\n0xabc\n\nNonce: n1'
  const signature = await account.signMessage({ message })

  const adapter = makeAdapter()
  assert.strictEqual(
    await adapter.verifyAuthSig({ address: account.address, message, signature }),
    true,
  )
  assert.strictEqual(
    await adapter.verifyAuthSig({ address: CREATOR, message, signature }),
    false,
  )
  assert.strictEqual(
    await adapter.verifyAuthSig({ address: account.address, message, signature: '0xdead' }),
    false,
  )
})

// ---------- sponsorship ----------------------------------------------------------------

test('buildTx: sponsorship path returns a userop skeleton with paymaster fields', async () => {
  const sponsorCalls: string[] = []
  const paymaster: PaymasterHttp = {
    async sponsorUserOperation(op) {
      sponsorCalls.push(String(op.sender))
      return {
        paymaster_and_data: '0xfeed',
        pre_verification_gas: '0x1',
        verification_gas_limit: '0x2',
        call_gas_limit: '0x3',
      }
    },
  }
  const adapter = makeAdapter({ paymaster, shouldSponsor: async () => true })
  const tx = await adapter.buildTx({
    action: 'acceptEscrow',
    user_id: 'u1',
    payload: { escrow_id: UUID },
  })
  assert.strictEqual(tx.kind, 'evm-userop')
  if (tx.kind === 'evm-userop') {
    assert.strictEqual(tx.user_op.sender, CREATOR)
    assert.strictEqual(tx.user_op.paymaster_and_data, '0xfeed')
  }
  assert.deepStrictEqual(sponsorCalls, [CREATOR])
})

test('buildTx: no quota / value-carrying / paymaster failure all degrade to a plain tx', async () => {
  // Quota exhausted.
  const noQuota = makeAdapter({
    paymaster: {
      async sponsorUserOperation() {
        throw new Error('should not be called')
      },
    },
    shouldSponsor: async () => false,
  })
  const t1 = await noQuota.buildTx({ action: 'acceptEscrow', user_id: 'u1', payload: { escrow_id: UUID } })
  assert.strictEqual(t1.kind, 'evm-tx')

  // Native value (paymasters can't fund msg.value).
  const valueCarrying = makeAdapter({
    paymaster: {
      async sponsorUserOperation() {
        throw new Error('should not be called')
      },
    },
    shouldSponsor: async () => true,
  })
  const t2 = await valueCarrying.buildTx({
    ...CREATE_ARGS,
    payload: { ...CREATE_ARGS.payload, asset: 'ETH_BASE' },
  })
  assert.strictEqual(t2.kind, 'evm-tx')
  if (t2.kind === 'evm-tx') assert.strictEqual(t2.value, '1000000')

  // Paymaster outage → documented degradation.
  const flaky = makeAdapter({
    paymaster: {
      async sponsorUserOperation() {
        throw new Error('rate limited')
      },
    },
    shouldSponsor: async () => true,
  })
  const t3 = await flaky.buildTx({ action: 'acceptEscrow', user_id: 'u1', payload: { escrow_id: UUID } })
  assert.strictEqual(t3.kind, 'evm-tx')
})

// ---------- alchemy webhook extraction ------------------------------------------------------

test('extractTxHashes: dedupes valid hashes, ignores junk shapes', () => {
  const hash = `0x${'cd'.repeat(32)}`
  const payload = {
    event: {
      activity: [
        { hash },
        { hash }, // duplicate
        { hash: 'not-a-hash' },
        { nope: true },
      ],
    },
  }
  assert.deepStrictEqual(extractTxHashes(payload), [hash])
  assert.deepStrictEqual(extractTxHashes(null), [])
  assert.deepStrictEqual(extractTxHashes({ event: {} }), [])
})

test('fee_currency (CELO): plain txs carry it; userops and other chains never do', async () => {
  const CUSD = '0x765DE816845861e75A25fCA122bb6898B8B1282a' as const
  const celo = evmAdapter({
    chain_id: 'eip155:42220',
    rpc_url: 'http://unused.invalid',
    escrow_contract: CONTRACT,
    min_confirmations: 3,
    fee_currency: CUSD,
    deps: {
      resolveWalletAddress: async () => CREATOR,
      resolveAsset: async () => ({ token_address: null }),
      rpc: fakeRpc(),
    },
  })
  const tx = await celo.buildTx({ action: 'acceptEscrow', user_id: 'u1', payload: { escrow_id: UUID } })
  assert.strictEqual(tx.kind, 'evm-tx')
  if (tx.kind === 'evm-tx') assert.strictEqual(tx.fee_currency, CUSD)

  // BASE adapter (no fee_currency arg) must not grow the field.
  const base = makeAdapter()
  const baseTx = await base.buildTx({ action: 'acceptEscrow', user_id: 'u1', payload: { escrow_id: UUID } })
  if (baseTx.kind === 'evm-tx') assert.strictEqual('fee_currency' in baseTx, false)
})
