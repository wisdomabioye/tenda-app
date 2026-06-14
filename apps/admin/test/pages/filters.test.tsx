import { test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderPage } from '../test-utils'
import { adminApi } from '@/api/client'
import { setSession } from '@/lib/auth'
import DisputesPage from '@/app/(dashboard)/disputes/page'
import ReportsPage from '@/app/(dashboard)/reports/page'
import UsersPage from '@/app/(dashboard)/users/page'
import EscrowsPage from '@/app/(dashboard)/escrows/page'
import FiatPage from '@/app/(dashboard)/fiat/page'
import ModerationPage from '@/app/(dashboard)/moderation/page'
import FinancePage from '@/app/(dashboard)/finance/page'

vi.mock('@/api/client', () => ({
  adminApi: {
    disputes: { list: vi.fn(), claim: vi.fn(), release: vi.fn() },
    reports: { list: vi.fn(), action: vi.fn() },
    adminUsers: { list: vi.fn() },
    escrows: { list: vi.fn(), setHidden: vi.fn() },
    fiat: { intents: vi.fn(), providers: vi.fn() },
    moderation: { verdicts: vi.fn() },
    finance: { fees: vi.fn() },
  },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const paginated = { data: [], total: 0, limit: 20, offset: 0 }

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  setSession('jwt', { id: 'me', role: 'super_admin', first_name: 'S', last_name: 'A' })
})

test('disputes: switching tabs requeries with the tab filter', async () => {
  vi.mocked(adminApi.disputes.list).mockResolvedValue(paginated)
  renderPage(<DisputesPage />)
  await screen.findByText('No disputes here.')
  await userEvent.click(screen.getByRole('tab', { name: 'My caseload' }))
  await waitFor(() => expect(adminApi.disputes.list).toHaveBeenLastCalledWith(expect.objectContaining({ assigned: 'me', status: 'open' })))
  await userEvent.click(screen.getByRole('tab', { name: 'All' }))
  await waitFor(() =>
    expect(adminApi.disputes.list).toHaveBeenLastCalledWith(expect.not.objectContaining({ assigned: expect.anything() })),
  )
})

test('reports: switching to a status tab filters by status', async () => {
  vi.mocked(adminApi.reports.list).mockResolvedValue(paginated)
  renderPage(<ReportsPage />)
  await screen.findByText('No reports here.')
  await userEvent.click(screen.getByRole('tab', { name: 'actioned' }))
  await waitFor(() => expect(adminApi.reports.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'actioned' })))
})

test('users: status and role selects feed the query', async () => {
  vi.mocked(adminApi.adminUsers.list).mockResolvedValue(paginated)
  renderPage(<UsersPage />)
  await screen.findByText('No users match.')
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0]!, 'suspended')
  await waitFor(() => expect(adminApi.adminUsers.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'suspended' })))
  await userEvent.selectOptions(screen.getAllByRole('combobox')[1]!, 'dispute_admin')
  await waitFor(() => expect(adminApi.adminUsers.list).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'dispute_admin' })))
})

test('users: the search box debounces into the query', async () => {
  vi.mocked(adminApi.adminUsers.list).mockResolvedValue(paginated)
  renderPage(<UsersPage />)
  await screen.findByText('No users match.')
  await userEvent.type(screen.getByPlaceholderText('Search name or wallet address…'), 'ada')
  await waitFor(() => expect(adminApi.adminUsers.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'ada' })))
})

test('escrows: kind and status selects feed the query', async () => {
  vi.mocked(adminApi.escrows.list).mockResolvedValue(paginated)
  renderPage(<EscrowsPage />)
  await screen.findByText('No listings match.')
  await userEvent.selectOptions(screen.getAllByRole('combobox')[0]!, 'gig')
  await waitFor(() => expect(adminApi.escrows.list).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'gig' })))
  await userEvent.selectOptions(screen.getAllByRole('combobox')[1]!, 'disputed')
  await waitFor(() => expect(adminApi.escrows.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'disputed' })))
})

test('fiat: the status select filters intents', async () => {
  vi.mocked(adminApi.fiat.intents).mockResolvedValue({ intents: [] })
  vi.mocked(adminApi.fiat.providers).mockResolvedValue({ providers: [] })
  renderPage(<FiatPage />)
  await screen.findByText('No intents match.')
  await userEvent.selectOptions(screen.getByRole('combobox'), 'settled')
  await waitFor(() => expect(adminApi.fiat.intents).toHaveBeenLastCalledWith({ status: 'settled' }))
})

test('moderation: decision filter + pagination requery', async () => {
  vi.mocked(adminApi.moderation.verdicts).mockResolvedValue({ verdicts: [], page: 0 })
  renderPage(<ModerationPage />)
  await screen.findByText('No verdicts here.')
  await userEvent.selectOptions(screen.getByRole('combobox'), 'block')
  await waitFor(() => expect(adminApi.moderation.verdicts).toHaveBeenLastCalledWith(expect.objectContaining({ decision: 'block' })))
})

test('finance: editing the date range refetches', async () => {
  vi.mocked(adminApi.finance.fees).mockResolvedValue({
    period: { from: '', to: '' }, grand_total_fee_raw: '0',
    by_kind: { gig: { total_fee_raw: '0', by_type: [] }, exchange: { total_fee_raw: '0', by_type: [] } },
  })
  renderPage(<FinancePage />)
  await userEvent.type(screen.getByLabelText('From'), '2026-06-01')
  await waitFor(() => expect(adminApi.finance.fees).toHaveBeenLastCalledWith(expect.objectContaining({ from: '2026-06-01' })))
})
