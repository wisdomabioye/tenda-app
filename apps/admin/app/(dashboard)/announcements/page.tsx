'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { PlusIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import type { Announcement } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { AnnouncementForm } from '@/components/announcements/announcement-form'
import { adminApi } from '@/api/client'

export default function AnnouncementsPage() {
  const [items,      setItems]      = useState<Announcement[]>([])
  const [loading,    setLoading]    = useState(true)
  const [formOpen,   setFormOpen]   = useState(false)
  const [editing,    setEditing]    = useState<Announcement | null>(null)
  const [delTarget,  setDelTarget]  = useState<Announcement | null>(null)
  const [deleting,   setDeleting]   = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.announcements.list()
      setItems(res)
    } catch {
      toast.error('Failed to load announcements')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnnouncements() }, [fetchAnnouncements])

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(ann: Announcement) {
    setEditing(ann)
    setFormOpen(true)
  }

  async function handleDelete() {
    if (!delTarget) return
    setDeleting(true)
    try {
      await adminApi.announcements.remove({ id: delTarget.id })
      toast.success('Announcement deleted')
      setDelTarget(null)
      fetchAnnouncements()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <AppHeader title="Announcements" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {loading ? '…' : `${items.length} announcements`}
          </span>
          <Button size="sm" onClick={openCreate}>
            <PlusIcon size={15} />
            New
          </Button>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">No announcements</TableCell>
                </TableRow>
              ) : items.map((ann) => (
                <TableRow key={ann.id}>
                  <TableCell className="font-medium max-w-48 truncate">{ann.title}</TableCell>
                  <TableCell>{ann.priority}</TableCell>
                  <TableCell>
                    <Badge variant={ann.is_active ? 'default' : 'secondary'}>
                      {ann.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {ann.expires_at ? format(new Date(ann.expires_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {ann.created_at ? format(new Date(ann.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ann)}>
                        <PencilIcon size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDelTarget(ann)}>
                        <Trash2Icon size={15} className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>

      <AnnouncementForm
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); fetchAnnouncements() }}
      />

      <ConfirmDialog
        open={!!delTarget}
        onOpenChange={(o) => !o && setDelTarget(null)}
        title="Delete Announcement"
        description={`Delete "${delTarget?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  )
}
