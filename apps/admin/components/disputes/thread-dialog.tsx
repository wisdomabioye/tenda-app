'use client'

import { useEffect, useState, useCallback } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { MessageSquareIcon, UserCheckIcon, CheckCircleIcon } from 'lucide-react'
import type { DisputeSummary, DisputeThread, DisputeMessage, DisputeType } from '@tenda/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { adminApi } from '@/api/client'

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

interface Props {
  dispute: DisputeSummary | null
  onClose: () => void
}

export function ThreadDialog({ dispute, onClose }: Props) {
  const [_thread,       setThread]       = useState<DisputeThread | null>(null)
  const [messages,      setMessages]      = useState<DisputeMessage[]>([])
  const [loading,       setLoading]       = useState(false)
  const [msgBody,       setMsgBody]       = useState('')
  const [sending,       setSending]       = useState(false)
  const [assignId,      setAssignId]      = useState('')
  const [assigning,     setAssigning]     = useState(false)
  const [signature,     setSignature]     = useState('')
  const [resolving,     setResolving]     = useState(false)
  const [openingThread, setOpeningThread] = useState(false)
  const [hasThread,     setHasThread]     = useState(false)

  const type = dispute?.dispute_type as DisputeType
  const id   = dispute?.dispute_id ?? ''

  const loadThread = useCallback(async () => {
    if (!dispute) return
    setLoading(true)
    try {
      const data = await adminApi.disputes.getThread({ type, id })
      setThread(data)
      setHasThread(true)
      setMessages((data as unknown as { messages?: DisputeMessage[] }).messages ?? [])
    } catch {
      // thread not opened yet
    } finally {
      setLoading(false)
    }
  }, [dispute, type, id])

  useEffect(() => {
    setHasThread(!!dispute?.thread_id)
    if (dispute?.thread_id) {
      loadThread()
    } else {
      setThread(null)
      setMessages([])
    }
    setMsgBody('')
    setAssignId('')
    setSignature('')
    setAdminNote('')
  }, [dispute, loadThread])

  async function handleOpenThread() {
    setOpeningThread(true)
    try {
      const res = await adminApi.disputes.openThread({ type, id })
      setThread(res.thread)
      setHasThread(true)
      toast.success(res.created ? 'Thread opened' : 'Thread already exists')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open thread')
    } finally {
      setOpeningThread(false)
    }
  }

  async function handleSendMessage(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const body = msgBody.trim()
    if (!body) return
    setSending(true)
    try {
      const msg = await adminApi.disputes.sendMessage({ type, id }, { body })
      setMessages((prev) => [...prev, msg])
      setMsgBody('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  async function handleAssign(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const aid = assignId.trim() || null
    setAssigning(true)
    try {
      await adminApi.disputes.assign({ type, id }, { assigned_to_id: aid })
      toast.success(aid ? 'Resolver assigned' : 'Assignment cleared')
      setAssignId('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setAssigning(false)
    }
  }

  async function handleResolve(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const sig = signature.trim()
    if (!sig) { toast.error('Signature is required'); return }
    setResolving(true)
    try {
      await adminApi.disputes.resolve({ type, id }, { signature: sig })
      toast.success('Dispute resolved')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resolve dispute')
    } finally {
      setResolving(false)
    }
  }

  if (!dispute) return null

  return (
    <Dialog open={!!dispute} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TypeBadge type={type} />
            <span className="font-mono text-sm text-muted-foreground">{id.slice(0, 8)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Dispute summary */}
          <div className="rounded-md border p-3 space-y-1 bg-muted/30">
            <p><span className="font-medium">Subject:</span> {dispute.subject_title ?? dispute.subject_id.slice(0, 8)}</p>
            <p><span className="font-medium">Raised by:</span> {raisedBy(dispute)}</p>
            <p className="text-muted-foreground italic">{dispute.reason}</p>
            {dispute.raised_at && (
              <p className="text-xs text-muted-foreground">
                {format(new Date(dispute.raised_at), 'dd MMM yyyy HH:mm')}
              </p>
            )}
          </div>

          {/* Open thread CTA */}
          {!hasThread && (
            <Button size="sm" onClick={handleOpenThread} disabled={openingThread}>
              <MessageSquareIcon size={15} />
              {openingThread ? 'Opening…' : 'Open mediation thread'}
            </Button>
          )}

          {/* Thread messages + actions */}
          {hasThread && (
            <>
              {loading ? (
                <p className="text-muted-foreground">Loading messages…</p>
              ) : messages.length === 0 ? (
                <p className="text-muted-foreground italic">No messages yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-2">
                  {messages.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded p-2 text-xs ${m.sender_role === 'admin' ? 'bg-primary/10 ml-4' : 'bg-muted mr-4'}`}
                    >
                      <p className="font-medium capitalize mb-0.5">{m.sender_role}</p>
                      <p>{m.body}</p>
                      {m.created_at && (
                        <p className="text-muted-foreground mt-0.5">
                          {format(new Date(m.created_at), 'dd MMM HH:mm')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  placeholder="Type a message…"
                  value={msgBody}
                  onChange={(e) => setMsgBody(e.target.value)}
                  className="flex-1"
                  maxLength={2000}
                />
                <Button type="submit" size="sm" disabled={sending || !msgBody.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </form>

              <form onSubmit={handleAssign} className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <UserCheckIcon size={14} /> Assign resolver
                </Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="User ID (leave blank to clear)"
                    value={assignId}
                    onChange={(e) => setAssignId(e.target.value)}
                    className="flex-1 font-mono text-xs"
                  />
                  <Button type="submit" variant="outline" size="sm" disabled={assigning}>
                    {assigning ? 'Saving…' : 'Assign'}
                  </Button>
                </div>
                {dispute.assigned_to_id && (
                  <p className="text-xs text-muted-foreground">
                    Currently: <span className="font-mono">{dispute.assigned_to_id.slice(0, 8)}</span>
                  </p>
                )}
              </form>
            </>
          )}

          {/* Resolve */}
          <form onSubmit={handleResolve} className="space-y-2 border-t pt-3">
            <Label className="flex items-center gap-1.5 text-destructive">
              <CheckCircleIcon size={14} /> Resolve dispute
            </Label>
            <Input
              placeholder="On-chain transaction signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              className="font-mono text-xs"
            />

            <Button type="submit" variant="destructive" size="sm" disabled={resolving || !signature.trim()}>
              {resolving ? 'Resolving…' : 'Submit resolution'}
            </Button>
          </form>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
