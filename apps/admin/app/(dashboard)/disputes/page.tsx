'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { RefreshCwIcon } from 'lucide-react'
import type { DisputeSummary, DisputeType } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ListPagination } from '@/components/common/list-pagination'
import { ThreadDialog } from '@/components/disputes/thread-dialog'
import { adminApi } from '@/api/client'

const LIMIT = 20

function TypeBadge({ type }: { type: DisputeType }) {
  return (
    <Badge variant={type === 'gig' ? 'default' : 'secondary'} className="capitalize">
      {type}
    </Badge>
  )
}

function raisedBy(d: DisputeSummary) {
  const name = [d.raised_by_first_name, d.raised_by_last_name].filter(Boolean).join(' ')
  return name || d.raised_by_id.slice(0, 8)
}

export default function DisputesPage() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const page   = Math.max(1, Number(params.get('page') ?? '1'))
  const offset = (page - 1) * LIMIT

  const [disputes, setDisputes] = useState<DisputeSummary[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<DisputeSummary | null>(null)

  const fetchDisputes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.disputes.list({ offset, limit: LIMIT })
      setDisputes(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load disputes')
    } finally {
      setLoading(false)
    }
  }, [offset])

  useEffect(() => { fetchDisputes() }, [fetchDisputes])

  function handleClose() {
    setSelected(null)
    fetchDisputes()
  }

  return (
    <>
      <AppHeader title="Disputes" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {loading ? '…' : `${total} open disputes`}
          </span>
          <Button variant="outline" size="sm" onClick={fetchDisputes} disabled={loading}>
            <RefreshCwIcon size={15} />
            Refresh
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Raised by</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Thread</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : disputes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No open disputes</TableCell>
                </TableRow>
              ) : disputes.map((d) => (
                <TableRow key={d.dispute_id}>
                  <TableCell><TypeBadge type={d.dispute_type} /></TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    {d.subject_title ?? d.subject_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="text-sm">{raisedBy(d)}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground text-xs">{d.reason}</TableCell>
                  <TableCell>
                    {d.thread_id
                      ? <Badge variant="outline" className="text-xs">Open</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>
                    }
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {d.raised_at ? format(new Date(d.raised_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setSelected(d)}>
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
          onPageChange={(p) => {
            const sp = new URLSearchParams(params.toString())
            sp.set('page', String(p))
            router.push(`${pathname}?${sp.toString()}`)
          }}
        />
      </main>

      <ThreadDialog dispute={selected} onClose={handleClose} />
    </>
  )
}
