'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Announcement, CreateAnnouncementBody } from '@tenda/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { adminApi } from '@/api/client'

interface Props {
  open:       boolean
  editing:    Announcement | null
  onClose:    () => void
  onSaved:    () => void
}

export function AnnouncementForm({ open, editing, onClose, onSaved }: Props) {
  const [title,     setTitle]     = useState('')
  const [body,      setBody]      = useState('')
  const [priority,  setPriority]  = useState('0')
  const [isActive,  setIsActive]  = useState(true)
  const [expiresAt, setExpiresAt] = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (editing) {
      setTitle(editing.title)
      setBody(editing.body)
      setPriority(String(editing.priority ?? 0))
      setIsActive(editing.is_active ?? true)
      setExpiresAt(editing.expires_at ? new Date(editing.expires_at).toISOString().slice(0, 16) : '')
    } else {
      setTitle('')
      setBody('')
      setPriority('0')
      setIsActive(true)
      setExpiresAt('')
    }
  }, [editing, open])

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()

    const prio = parseInt(priority, 10)
    if (isNaN(prio) || prio < 0 || prio > 10) {
      toast.error('Priority must be 0–10')
      return
    }

    const payload: CreateAnnouncementBody = {
      title:     title.trim(),
      body:      body.trim(),
      priority:  prio,
      is_active: isActive,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : undefined,
    }

    setSaving(true)
    try {
      if (editing) {
        await adminApi.announcements.update({ id: editing.id }, payload)
        toast.success('Announcement updated')
      } else {
        await adminApi.announcements.create(payload)
        toast.success('Announcement created')
      }
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save announcement')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Announcement' : 'New Announcement'}</DialogTitle>
        </DialogHeader>
        <form id="ann-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ann-title">Title</Label>
            <Input
              id="ann-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ann-body">Body</Label>
            <Textarea
              id="ann-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-priority">Priority (0–10)</Label>
              <Input
                id="ann-priority"
                type="number"
                min={0}
                max={10}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ann-expires">Expires at</Label>
              <Input
                id="ann-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="ann-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
            <Label htmlFor="ann-active">Active</Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ann-form" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
