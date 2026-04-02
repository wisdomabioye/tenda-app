'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ListPagination } from '@/components/common/list-pagination'
import { adminApi } from '@/api/client'
import { lamportsToSol } from '@/lib/utils'

const LIMIT = 20

interface TxRow {
  id:                    string
  type:                  string
  signature:             string
  amount_lamports:       number
  platform_fee_lamports: number
  created_at:            Date | string | null
}

interface Props {
  ledgerType: 'gig' | 'exchange'
  from: string
  to:   string
}

export function TxView({ ledgerType, from, to }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const page   = Math.max(1, Number(params.get('page') ?? '1'))
  const offset = (page - 1) * LIMIT

  const [rows,    setRows]    = useState<TxRow[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchTx = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.finance.transactions({
        type:   ledgerType,
        from:   from || undefined,
        to:     to   || undefined,
        offset,
        limit:  LIMIT,
      })
      setRows(res.data as unknown as TxRow[])
      setTotal(res.total)
    } catch {
      toast.error('Failed to load transactions')
    } finally {
      setLoading(false)
    }
  }, [ledgerType, from, to, offset])

  useEffect(() => { fetchTx() }, [fetchTx])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} className="w-40" readOnly />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} className="w-40" readOnly />
        </div>
        <span className="text-sm text-muted-foreground self-end">
          {loading ? '…' : `${total} transactions`}
        </span>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Signature</TableHead>
              <TableHead>Amount (SOL)</TableHead>
              <TableHead>Platform fee (SOL)</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">No transactions</TableCell>
              </TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="capitalize font-mono text-xs">{r.type}</TableCell>
                <TableCell className="font-mono text-xs max-w-32 truncate">{r.signature}</TableCell>
                <TableCell className="font-mono text-xs">{lamportsToSol(r.amount_lamports)}</TableCell>
                <TableCell className="font-mono text-xs">{lamportsToSol(r.platform_fee_lamports)}</TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {r.created_at ? format(new Date(r.created_at), 'dd MMM yyyy') : '—'}
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
    </div>
  )
}
