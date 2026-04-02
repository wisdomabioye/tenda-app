'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { AdminGig, GigStatus, GigCategory } from '@tenda/shared'
import { GIG_STATUSES, GIG_CATEGORIES } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ListPagination } from '@/components/common/list-pagination'
import { GigStatusBadge } from '@/components/common/status-badge'
import { adminApi } from '@/api/client'

const LIMIT = 20

type ActionType = 'hide' | 'unhide' | 'expire' | 'feature' | 'unfeature'
type ActionState = { type: ActionType; gig: AdminGig } | null

function posterName(gig: AdminGig) {
  const name = [gig.poster_first_name, gig.poster_last_name].filter(Boolean).join(' ')
  return name || gig.poster_id.slice(0, 8)
}

function lamportsToSol(lamports: number) {
  return (lamports / 1_000_000_000).toFixed(3)
}

function actionLabel(type: ActionType): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export default function GigsPage() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const status   = params.get('status')   ?? ''
  const hidden   = params.get('hidden')   ?? ''
  const category = params.get('category') ?? ''
  const page     = Math.max(1, Number(params.get('page') ?? '1'))
  const offset   = (page - 1) * LIMIT

  const [gigs,    setGigs]    = useState<AdminGig[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [action,  setAction]  = useState<ActionState>(null)
  const [saving,  setSaving]  = useState(false)

  const fetchGigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.gigs.list({
        status:   status   ? status as GigStatus     : undefined,
        category: category ? category as GigCategory : undefined,
        hidden:   hidden === 'true' ? true : hidden === 'false' ? false : undefined,
        offset,
        limit: LIMIT,
      })
      setGigs(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load gigs')
    } finally {
      setLoading(false)
    }
  }, [status, hidden, category, offset])

  useEffect(() => { fetchGigs() }, [fetchGigs])

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
      switch (action.type) {
        case 'hide':      await adminApi.gigs.hide({ id: action.gig.id }); break
        case 'unhide':    await adminApi.gigs.unhide({ id: action.gig.id }); break
        case 'expire':    await adminApi.gigs.expire({ id: action.gig.id }); break
        case 'feature':   await adminApi.gigs.feature({ id: action.gig.id }); break
        case 'unfeature': await adminApi.gigs.unfeature({ id: action.gig.id }); break
      }
      toast.success(`Gig ${action.type}d`)
      setAction(null)
      fetchGigs()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action.type} gig`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AppHeader title="Gigs" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <NativeSelect value={status} onChange={(e) => updateParam('status', e.target.value)}>
            <option value="">All statuses</option>
            {GIG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </NativeSelect>
          <NativeSelect value={category} onChange={(e) => updateParam('category', e.target.value)}>
            <option value="">All categories</option>
            {GIG_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
          <NativeSelect value={hidden} onChange={(e) => updateParam('hidden', e.target.value)}>
            <option value="">Visible &amp; hidden</option>
            <option value="false">Visible only</option>
            <option value="true">Hidden only</option>
          </NativeSelect>
          <span className="ml-auto text-sm text-muted-foreground">
            {loading ? '…' : `${total} gigs`}
          </span>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Poster</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Amount (SOL)</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : gigs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">No gigs found</TableCell>
                </TableRow>
              ) : gigs.map((gig) => (
                <TableRow key={gig.id} className={gig.hidden ? 'opacity-50' : ''}>
                  <TableCell className="max-w-48 truncate font-medium">{gig.title}</TableCell>
                  <TableCell className="capitalize">{gig.category}</TableCell>
                  <TableCell><GigStatusBadge status={gig.status} /></TableCell>
                  <TableCell className="text-muted-foreground">{posterName(gig)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[gig.city, gig.country].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell>{lamportsToSol(gig.payment_lamports)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {gig.created_at ? format(new Date(gig.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm"
                        onClick={() => setAction({ type: gig.hidden ? 'unhide' : 'hide', gig })}>
                        {gig.hidden ? 'Unhide' : 'Hide'}
                      </Button>
                      {gig.status === 'open' && (
                        <Button variant="ghost" size="sm"
                          onClick={() => setAction({ type: 'expire', gig })}>
                          Expire
                        </Button>
                      )}
                      <Button variant="ghost" size="sm"
                        onClick={() => setAction({ type: gig.featured ? 'unfeature' : 'feature', gig })}>
                        {gig.featured ? 'Unfeature' : 'Feature'}
                      </Button>
                    </div>
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
        title={action ? `${actionLabel(action.type)} Gig` : ''}
        description={
          action?.type === 'expire'
            ? `Force-expire "${action.gig.title}"? The poster must claim their refund via the app.`
            : `${actionLabel(action?.type ?? 'hide')} "${action?.gig.title}"?`
        }
        confirmLabel={action ? actionLabel(action.type) : 'Confirm'}
        variant={action?.type === 'hide' || action?.type === 'expire' ? 'destructive' : 'default'}
        loading={saving}
        onConfirm={handleAction}
      />
    </>
  )
}
