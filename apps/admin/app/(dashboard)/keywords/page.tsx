'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { PlusIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react'
import type { BlockedKeyword } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { adminApi } from '@/api/client'

export default function KeywordsPage() {
  const [keywords,  setKeywords]  = useState<BlockedKeyword[]>([])
  const [total,     setTotal]     = useState(0)
  const [loading,   setLoading]   = useState(true)
  const [newKw,     setNewKw]     = useState('')
  const [adding,    setAdding]    = useState(false)
  const [delTarget, setDelTarget] = useState<BlockedKeyword | null>(null)
  const [deleting,  setDeleting]  = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchKeywords = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.keywords.list({ limit: 200 })
      setKeywords(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load keywords')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchKeywords() }, [fetchKeywords])

  async function handleAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const kw = newKw.trim().toLowerCase()
    if (!kw) return
    setAdding(true)
    try {
      await adminApi.keywords.add({ keyword: kw })
      toast.success(`"${kw}" added`)
      setNewKw('')
      fetchKeywords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add keyword')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      await adminApi.keywords.remove({ id: delTarget.id })
      toast.success(`"${delTarget.keyword}" removed`)
      setDelTarget(null)
      fetchKeywords()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove keyword')
    } finally {
      setDeleting(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await adminApi.keywords.refresh()
      toast.success('Blocklist cache refreshed')
    } catch {
      toast.error('Failed to refresh cache')
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <>
      <AppHeader title="Blocked Keywords" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleAdd} className="flex items-center gap-2 flex-1 max-w-sm">
            <Input
              placeholder="New keyword…"
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={adding || !newKw.trim()}>
              <PlusIcon size={16} />
              Add
            </Button>
          </form>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing} className="ml-auto">
            <RefreshCwIcon size={16} />
            {refreshing ? 'Refreshing…' : 'Refresh cache'}
          </Button>
          <span className="text-sm text-muted-foreground">{loading ? '…' : `${total} keywords`}</span>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Keyword</TableHead>
                <TableHead>Added by</TableHead>
                <TableHead>Date</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : keywords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No blocked keywords</TableCell>
                </TableRow>
              ) : keywords.map((kw) => (
                <TableRow key={kw.id}>
                  <TableCell className="font-mono">{kw.keyword}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {kw.added_by?.slice(0, 8) ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {kw.created_at ? format(new Date(kw.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDelTarget(kw)}>
                      <Trash2Icon size={15} className="text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="Remove Keyword"
        description={`Remove "${delTarget?.keyword}" from the blocklist?`}
        confirmLabel="Remove"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
