'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { AdminExchangeOffer, ExchangeOfferStatus } from '@tenda/shared'
import { EXCHANGE_OFFER_STATUSES } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ListPagination } from '@/components/common/list-pagination'
import { ExchangeStatusBadge } from '@/components/common/status-badge'
import { adminApi } from '@/api/client'
import { lamportsToSol } from '@/lib/utils'

const LIMIT = 20

type ActionType  = 'hide' | 'unhide'
type ActionState = { type: ActionType; offer: AdminExchangeOffer } | null

function sellerName(offer: AdminExchangeOffer) {
  const name = [offer.seller_first_name, offer.seller_last_name].filter(Boolean).join(' ')
  return name || offer.seller_id.slice(0, 8)
}

export default function ExchangePage() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const status   = params.get('status')   ?? ''
  const hidden   = params.get('hidden')   ?? ''
  const currency = params.get('currency') ?? ''
  const page     = Math.max(1, Number(params.get('page') ?? '1'))
  const offset   = (page - 1) * LIMIT

  const [offers,  setOffers]  = useState<AdminExchangeOffer[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [action,  setAction]  = useState<ActionState>(null)
  const [saving,  setSaving]  = useState(false)

  const fetchOffers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.exchange.list({
        status:   status   ? status as ExchangeOfferStatus : undefined,
        currency: currency || undefined,
        hidden:   hidden === 'true' ? true : hidden === 'false' ? false : undefined,
        offset,
        limit: LIMIT,
      })
      setOffers(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load exchange offers')
    } finally {
      setLoading(false)
    }
  }, [status, hidden, currency, offset])

  useEffect(() => { fetchOffers() }, [fetchOffers])

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    if (key !== 'page') sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  async function handleAction() {
    if (!action) return
    setSaving(true)
    try {
      if (action.type === 'hide') {
        await adminApi.exchange.hide({ id: action.offer.id })
      } else {
        await adminApi.exchange.unhide({ id: action.offer.id })
      }
      toast.success(`Offer ${action.type === 'hide' ? 'hidden' : 'unhidden'}`)
      setAction(null)
      fetchOffers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action.type} offer`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AppHeader title="Exchange" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect value={status} onChange={(e) => updateParam('status', e.target.value)}>
            <option value="">All statuses</option>
            {EXCHANGE_OFFER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
          <NativeSelect value={hidden} onChange={(e) => updateParam('hidden', e.target.value)}>
            <option value="">Visible &amp; hidden</option>
            <option value="false">Visible only</option>
            <option value="true">Hidden only</option>
          </NativeSelect>
          <span className="ml-auto text-sm text-muted-foreground">
            {loading ? '…' : `${total} offers`}
          </span>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SOL Amount</TableHead>
                <TableHead>Fiat</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seller</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : offers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No offers found</TableCell>
                </TableRow>
              ) : offers.map((offer) => (
                <TableRow key={offer.id} className={offer.hidden ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{lamportsToSol(offer.lamports_amount)} SOL</TableCell>
                  <TableCell>{offer.fiat_amount.toLocaleString()}</TableCell>
                  <TableCell>{offer.fiat_currency}</TableCell>
                  <TableCell><ExchangeStatusBadge status={offer.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{sellerName(offer)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {offer.created_at ? format(new Date(offer.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm"
                      onClick={() => setAction({ type: offer.hidden ? 'unhide' : 'hide', offer })}>
                      {offer.hidden ? 'Unhide' : 'Hide'}
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

      <ConfirmDialog
        open={!!action}
        onOpenChange={(o) => !o && setAction(null)}
        title={action?.type === 'hide' ? 'Hide Offer' : 'Unhide Offer'}
        description={`${action?.type === 'hide' ? 'Hide' : 'Unhide'} this exchange offer?`}
        confirmLabel={action?.type === 'hide' ? 'Hide' : 'Unhide'}
        variant={action?.type === 'hide' ? 'destructive' : 'default'}
        loading={saving}
        onConfirm={handleAction}
      />
    </>
  )
}
