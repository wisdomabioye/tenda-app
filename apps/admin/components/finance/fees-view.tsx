'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import type { FinanceFeesResponse } from '@tenda/shared'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { adminApi } from '@/api/client'
import { lamportsToSol } from '@/lib/utils'

interface Props {
  from: string
  to:   string
  onFromChange: (v: string) => void
  onToChange:   (v: string) => void
}

export function FeesView({ from, to, onFromChange, onToChange }: Props) {
  const [fees,    setFees]    = useState<FinanceFeesResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchFees = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.finance.fees({ from: from || undefined, to: to || undefined })
      setFees(res)
    } catch {
      toast.error('Failed to load fee data')
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { fetchFees() }, [fetchFees])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-40" />
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {fees && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Gig fees</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{lamportsToSol(Number(fees.gig.total_fee_lamports))} SOL</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Exchange fees</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{lamportsToSol(Number(fees.exchange.total_fee_lamports))} SOL</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total fees</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-2xl font-bold">{lamportsToSol(Number(fees.grand_total_fee_lamports))} SOL</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: 'Gig breakdown',      rows: fees.gig.by_type },
              { label: 'Exchange breakdown',  rows: fees.exchange.by_type },
            ].map(({ label, rows }) => (
              <div key={label} className="rounded-lg border">
                <p className="text-sm font-medium px-4 py-2 border-b">{label}</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Count</TableHead>
                      <TableHead>Platform fee (SOL)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground h-12">No data</TableCell>
                      </TableRow>
                    ) : rows.map((r) => (
                      <TableRow key={r.type}>
                        <TableCell className="capitalize font-mono text-xs">{r.type}</TableCell>
                        <TableCell>{r.transaction_count}</TableCell>
                        <TableCell className="font-mono text-xs">{lamportsToSol(Number(r.total_platform_fee))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
