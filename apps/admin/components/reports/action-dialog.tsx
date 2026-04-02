'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import type { Report, ReportStatus } from '@tenda/shared'
import { REPORT_STATUSES } from '@tenda/shared'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { adminApi } from '@/api/client'

interface Props {
  report:  Report | null
  onClose: () => void
  onSaved: () => void
}

export function ReportActionDialog({ report, onClose, onSaved }: Props) {
  const [newStatus,   setNewStatus]   = useState<ReportStatus>('reviewed')
  const [adminNote,   setAdminNote]   = useState('')
  const [hideContent, setHideContent] = useState(false)
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (report) {
      setNewStatus(report.status === 'pending' ? 'reviewed' : report.status)
      setAdminNote(report.admin_note ?? '')
      setHideContent(false)
    }
  }, [report])

  async function handleSave() {
    if (!report) return
    setSaving(true)
    try {
      await adminApi.reports.action(
        { id: report.id },
        { status: newStatus, admin_note: adminNote || undefined, hide_content: hideContent || undefined },
      )
      toast.success('Report updated')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update report')
    } finally {
      setSaving(false)
    }
  }

  if (!report) return null

  return (
    <Dialog open={!!report} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Action Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {report.note && (
            <p className="text-sm text-muted-foreground border-l-2 pl-3 italic">{report.note}</p>
          )}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <NativeSelect
              className="w-full"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as ReportStatus)}
            >
              {REPORT_STATUSES.filter((s) => s !== 'pending').map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label>Admin note</Label>
            <Textarea
              placeholder="Optional note…"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={3}
            />
          </div>
          {report.content_type === 'gig' && (
            <div className="flex items-center gap-2">
              <Switch
                id="hide-content"
                checked={hideContent}
                onCheckedChange={setHideContent}
              />
              <Label htmlFor="hide-content">Also hide the reported gig</Label>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
