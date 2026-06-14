import { test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AdminPlatformConfig } from '@tenda/shared'
import { renderPage } from '../test-utils'
import ConfigPage from '@/app/(dashboard)/config/page'
import { adminApi } from '@/api/client'
import { toast } from 'sonner'

vi.mock('@/api/client', () => ({ adminApi: { platformConfig: { get: vi.fn(), update: vi.fn() } } }))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const get = vi.mocked(adminApi.platformConfig.get)
const update = vi.mocked(adminApi.platformConfig.update)
const ok = vi.mocked(toast.success)
const err = vi.mocked(toast.error)

const CONFIG = {
  fee_bps: 250, seeker_fee_bps: 100, grace_period_seconds: 3600,
  approval_window_seconds: 172800, default_sponsored_tx_count: 5, moderation_rules_version: 2,
} as AdminPlatformConfig

beforeEach(() => vi.clearAllMocks())

test('loads config into the editable fields + read-only section', async () => {
  get.mockResolvedValue(CONFIG)
  renderPage(<ConfigPage />)
  expect(await screen.findByLabelText('Platform fee (bps)')).toHaveValue(250)
  expect(screen.getByLabelText('Seeker fee (bps)')).toHaveValue(100)
  expect(screen.getByText('172800')).toBeInTheDocument() // read-only approval window
})

test('a cleared field blocks the save instead of zeroing the fee', async () => {
  get.mockResolvedValue(CONFIG)
  renderPage(<ConfigPage />)
  const fee = await screen.findByLabelText('Platform fee (bps)')
  await userEvent.clear(fee)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(err).toHaveBeenCalledWith('All three fields need a whole number')
  expect(update).not.toHaveBeenCalled()
})

test('a valid save PATCHes the config and toasts success', async () => {
  get.mockResolvedValue(CONFIG)
  update.mockResolvedValueOnce({ ...CONFIG, fee_bps: 300 })
  renderPage(<ConfigPage />)
  const fee = await screen.findByLabelText('Platform fee (bps)')
  await userEvent.clear(fee)
  await userEvent.type(fee, '300')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({ fee_bps: 300, seeker_fee_bps: 100, grace_period_seconds: 3600 }),
  )
  expect(ok).toHaveBeenCalledWith('Config saved — server cache busted')
})
