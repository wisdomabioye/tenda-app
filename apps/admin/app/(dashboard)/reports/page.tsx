'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { Report, ReportStatus } from '@tenda/shared'
import { REPORT_STATUSES, REPORT_CONTENT_TYPES } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ListPagination } from '@/components/common/list-pagination'
import { ReportActionDialog } from '@/components/reports/action-dialog'
import { adminApi } from '@/api/client'

const LIMIT = 20

function StatusBadge({ status }: { status: ReportStatus }) {
  const variant =
    status === 'actioned'  ? 'default'     :
    status === 'dismissed' ? 'secondary'   :
    status === 'pending'   ? 'destructive' : 'outline'
  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

export default function ReportsPage() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const status       = params.get('status')       ?? ''
  const content_type = params.get('content_type') ?? ''
  const page         = Math.max(1, Number(params.get('page') ?? '1'))
  const offset       = (page - 1) * LIMIT

  const [reports,  setReports]  = useState<Report[]>([])
  const [total,    setTotal]    = useState(0)
  const [loading,  setLoading]  = useState(true)
  const [target,   setTarget]   = useState<Report | null>(null)

  const fetchReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.reports.list({
        status:       status       || undefined,
        content_type: content_type || undefined,
        offset,
        limit: LIMIT,
      })
      setReports(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [status, content_type, offset])

  useEffect(() => { fetchReports() }, [fetchReports])

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    if (key !== 'page') sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  return (
    <>
      <AppHeader title="Reports" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect value={status} onChange={(e) => updateParam('status', e.target.value)}>
            <option value="">All statuses</option>
            {REPORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
          <NativeSelect value={content_type} onChange={(e) => updateParam('content_type', e.target.value)}>
            <option value="">All content types</option>
            {REPORT_CONTENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </NativeSelect>
          <span className="ml-auto text-sm text-muted-foreground">
            {loading ? '…' : `${total} reports`}
          </span>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Content type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : reports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No reports found</TableCell>
                </TableRow>
              ) : reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="capitalize">{report.content_type}</TableCell>
                  <TableCell className="max-w-40 truncate text-muted-foreground">{report.reason}</TableCell>
                  <TableCell><StatusBadge status={report.status} /></TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {report.reporter_id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {report.reported_user_id?.slice(0, 8) ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {report.created_at ? format(new Date(report.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setTarget(report)}>
                      Review
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

      <ReportActionDialog
        report={target}
        onClose={() => setTarget(null)}
        onSaved={() => { setTarget(null); fetchReports() }}
      />
    </>
  )
}
