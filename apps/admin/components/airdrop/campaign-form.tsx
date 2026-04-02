'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { adminApi } from '@/api/client'
import { lamportsToSol } from '@/lib/utils'

interface Props {
  open:    boolean
  onClose: () => void
  onSaved: () => void
}

export function CampaignForm({ open, onClose, onSaved }: Props) {
  const [name,        setName]        = useState('')
  const [lamports,    setLamports]    = useState('')
  const [description, setDescription] = useState('')
  const [batchSize,   setBatchSize]   = useState('30')
  const [saving,      setSaving]      = useState(false)

  function handleClose() {
    setName(''); setLamports(''); setDescription(''); setBatchSize('30')
    onClose()
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const lam = parseInt(lamports, 10)
    const bs  = parseInt(batchSize, 10)
    if (isNaN(lam) || lam <= 0) { toast.error('lamports_per_recipient must be a positive integer'); return }
    if (isNaN(bs) || bs < 1 || bs > 100) { toast.error('Batch size must be 1–100'); return }

    setSaving(true)
    try {
      await adminApi.airdrop.create({
        name:                   name.trim(),
        lamports_per_recipient: lam,
        description:            description.trim() || undefined,
        batch_size:             bs,
      })
      toast.success('Campaign created')
      handleClose()
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create campaign')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Airdrop Campaign</DialogTitle>
        </DialogHeader>
        <form id="campaign-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="camp-name">Name</Label>
            <Input id="camp-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-lamports">Lamports per recipient</Label>
            <Input
              id="camp-lamports"
              type="number"
              min={1}
              value={lamports}
              onChange={(e) => setLamports(e.target.value)}
              required
            />
            {lamports && !isNaN(parseInt(lamports)) && (
              <p className="text-xs text-muted-foreground">= {lamportsToSol(parseInt(lamports))} SOL</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-batch">Batch size (1–100)</Label>
            <Input
              id="camp-batch"
              type="number"
              min={1}
              max={100}
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="camp-desc">Description (optional)</Label>
            <Textarea
              id="camp-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="submit" form="campaign-form" disabled={saving}>
            {saving ? 'Creating…' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
