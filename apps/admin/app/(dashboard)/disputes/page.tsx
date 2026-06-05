'use client'

/**
 * Dispute queue (#91) — Pool (unclaimed) / Mine (my caseload) / All over
 * GET /v1/admin/disputes. Claim/release inline; rows open the mediation
 * thread.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { DisputeSummary } from '@tenda/shared'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AppHeader } from '@/components/layout/header'
import { DisputeTable } from '@/components/disputes/dispute-table'
import { ListPagination } from '@/components/common/list-pagination'
import { adminApi, type DisputeListQuery } from '@/api/client'
import { ApiError } from '@/lib/api'
import { useSessionUser } from '@/lib/use-session'

const PAGE_SIZE = 20
type Tab = 'pool' | 'mine' | 'all'

const TAB_QUERY: Record<Tab, DisputeListQuery> = {
  // Pool/Mine are the actionable views — open disputes only.
  pool: { assigned: 'none', status: 'open' },
  mine: { assigned: 'me', status: 'open' },
  all: {},
}

function isTab(v: string): v is Tab {
  return v === 'pool' || v === 'mine' || v === 'all'
}

export default function DisputesPage() {
  const [tab, setTab] = useState<Tab>('pool')
  const [page, setPage] = useState(1) // ListPagination is 1-based
  const [rows, setRows] = useState<DisputeSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const meId = useSessionUser()?.id ?? ''

  // setState lives in the .then callbacks (react-hooks/set-state-in-effect);
  // refreshKey bumps re-run the fetch after mutations.
  const [refreshKey, setRefreshKey] = useState(0)
  const refresh = () => setRefreshKey((k) => k + 1)

  useEffect(() => {
    let alive = true
    adminApi.disputes
      .list({ ...TAB_QUERY[tab], limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
      .then((res) => {
        if (!alive) return
        setRows(res.data)
        setTotal(res.total)
        setLoading(false)
      })
      .catch((err: unknown) => {
        if (!alive) return
        setLoading(false)
        toast.error(err instanceof ApiError ? err.message : 'Failed to load disputes')
      })
    return () => {
      alive = false
    }
  }, [tab, page, refreshKey])

  return (
    <>
      <AppHeader title="Disputes" />
      <div className="flex flex-col gap-4 p-4">
        <Tabs
          value={tab}
          onValueChange={(v) => {
            if (!isTab(v)) return
            setTab(v)
            setPage(1)
          }}
        >
          <TabsList>
            <TabsTrigger value="pool">Pool</TabsTrigger>
            <TabsTrigger value="mine">My caseload</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <DisputeTable disputes={rows} meId={meId} onChanged={refresh} />
        )}

        <ListPagination
          page={page}
          totalPages={Math.ceil(total / PAGE_SIZE)}
          onPageChange={setPage}
        />
      </div>
    </>
  )
}
