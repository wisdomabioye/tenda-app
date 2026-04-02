'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { PlusIcon } from 'lucide-react'
import type { AirdropCampaign, AirdropStatus } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ListPagination } from '@/components/common/list-pagination'
import { CampaignForm } from '@/components/airdrop/campaign-form'
import { CampaignDetail } from '@/components/airdrop/campaign-detail'
import { adminApi } from '@/api/client'
import { lamportsToSol } from '@/lib/utils'

const LIMIT = 20

const AIRDROP_STATUSES: AirdropStatus[] = ['draft', 'approved', 'in_progress', 'completed', 'cancelled']

function StatusBadge({ status }: { status: AirdropCampaign['status'] }) {
  const variant =
    status === 'completed'   ? 'default'     :
    status === 'in_progress' ? 'default'     :
    status === 'approved'    ? 'secondary'   :
    status === 'cancelled'   ? 'destructive' : 'outline'
  return <Badge variant={variant} className="capitalize">{status?.replace('_', ' ')}</Badge>
}

export default function AirdropPage() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const statusFilter = params.get('status') ?? ''
  const page         = Math.max(1, Number(params.get('page') ?? '1'))
  const offset       = (page - 1) * LIMIT

  const [campaigns, setCampaigns] = useState<AirdropCampaign[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [formOpen,  setFormOpen]  = useState(false)
  const [selected,  setSelected]  = useState<AirdropCampaign | null>(null)

  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.airdrop.list({
        status: statusFilter as AirdropStatus || undefined,
        offset,
        limit: LIMIT,
      })
      setCampaigns(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load campaigns')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, offset])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    if (key !== 'page') sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <>
      <AppHeader title="Airdrop" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect
            value={statusFilter}
            onChange={(e) => updateParam('status', e.target.value)}
          >
            <option value="">All statuses</option>
            {AIRDROP_STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </NativeSelect>
          <span className="text-sm text-muted-foreground ml-auto">
            {loading ? '…' : `${total} campaigns`}
          </span>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <PlusIcon size={15} />
            New campaign
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Per recipient</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : campaigns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No campaigns</TableCell>
                </TableRow>
              ) : campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell><StatusBadge status={c.status} /></TableCell>
                  <TableCell>{c.recipient_count}</TableCell>
                  <TableCell className="font-mono text-xs">{lamportsToSol(c.lamports_per_recipient)} SOL</TableCell>
                  <TableCell className="font-mono text-xs">{lamportsToSol(Number(c.total_lamports))} SOL</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.created_at ? format(new Date(c.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(c)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ListPagination
          page={page}
          totalPages={Math.ceil(total / LIMIT)}
          onPageChange={(p) => updateParam('page', String(p))}
        />
      </main>

      <CampaignForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); fetchCampaigns() }}
      />

      <CampaignDetail
        campaign={selected}
        onClose={() => setSelected(null)}
        onUpdated={fetchCampaigns}
      />
    </>
  )
}
