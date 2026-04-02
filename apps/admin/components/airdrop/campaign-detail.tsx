'use client'

import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { CheckCircleIcon } from 'lucide-react'
import type { AirdropCampaign, AirdropCampaignDetail, AirdropBatchSummary } from '@tenda/shared'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { adminApi } from '@/api/client'
import { lamportsToSol } from '@/lib/utils'

function StatusBadge({ status }: { status: AirdropCampaign['status'] }) {
  const variant =
    status === 'completed'   ? 'default'     :
    status === 'in_progress' ? 'default'     :
    status === 'approved'    ? 'secondary'   :
    status === 'cancelled'   ? 'destructive' : 'outline'
  return <Badge variant={variant} className="capitalize">{status}</Badge>
}

interface Props {
  campaign: AirdropCampaign | null
  onClose:  () => void
  onUpdated: () => void
}

export function CampaignDetail({ campaign, onClose, onUpdated }: Props) {
  const [detail,       setDetail]       = useState<AirdropCampaignDetail | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [wallets,      setWallets]      = useState('')
  const [adding,       setAdding]       = useState(false)
  const [approving,    setApproving]    = useState(false)
  const [treasury,     setTreasury]     = useState('')
  const [batchTx,      setBatchTx]      = useState<{ index: number; transaction: string } | null>(null)
  const [building,     setBuilding]     = useState(false)
  const [confirmSig,   setConfirmSig]   = useState('')
  const [confirming,   setConfirming]   = useState(false)

  const loadDetail = useCallback(async () => {
    if (!campaign) return
    setLoading(true)
    try {
      const d = await adminApi.airdrop.get({ id: campaign.id })
      setDetail(d)
    } catch {
      toast.error('Failed to load campaign detail')
    } finally {
      setLoading(false)
    }
  }, [campaign])

  useEffect(() => {
    if (campaign) loadDetail()
    else setDetail(null)
    setWallets('')
    setBatchTx(null)
    setConfirmSig('')
  }, [campaign, loadDetail])

  async function handleAddRecipients(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const list = wallets.split(/[\n,\s]+/).map((w) => w.trim()).filter(Boolean)
    if (list.length === 0) { toast.error('Enter at least one wallet address'); return }
    setAdding(true)
    try {
      const res = await adminApi.airdrop.addRecipients({ id: campaign!.id }, { wallets: list })
      toast.success(`Added ${res.added}, skipped ${res.skipped_duplicates} duplicate(s)`)
      setWallets('')
      loadDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add recipients')
    } finally {
      setAdding(false)
    }
  }

  async function handleApprove() {
    setApproving(true)
    try {
      await adminApi.airdrop.approve({ id: campaign!.id })
      toast.success('Campaign approved')
      onUpdated()
      loadDetail()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  async function handleBuildBatch(batch: AirdropBatchSummary) {
    if (!treasury.trim()) { toast.error('Treasury wallet address is required'); return }
    setBuilding(true)
    try {
      const res = await adminApi.airdrop.buildBatch(
        { id: campaign!.id, batchIndex: String(batch.batch_index) },
        { treasury: treasury.trim() },
      )
      setBatchTx({ index: batch.batch_index, transaction: res.transaction })
      toast.success(`Transaction built for batch ${batch.batch_index} (${res.recipient_count} recipients)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to build batch')
    } finally {
      setBuilding(false)
    }
  }

  async function handleConfirmBatch(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!batchTx || !confirmSig.trim()) { toast.error('Signature is required'); return }
    setConfirming(true)
    try {
      const res = await adminApi.airdrop.confirmBatch(
        { id: campaign!.id, batchIndex: String(batchTx.index) },
        { signature: confirmSig.trim() },
      )
      toast.success(`Batch ${batchTx.index} confirmed — ${res.distributed} distributed`)
      setBatchTx(null)
      setConfirmSig('')
      loadDetail()
      onUpdated()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to confirm batch')
    } finally {
      setConfirming(false)
    }
  }

  if (!campaign) return null

  return (
    <Dialog open={!!campaign} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {campaign.name}
            <StatusBadge status={detail?.status ?? campaign.status} />
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : detail && (
          <div className="space-y-5 text-sm">
            {/* Campaign stats */}
            <div className="grid grid-cols-3 gap-3 rounded-md border p-3 text-center">
              <div>
                <p className="text-xs text-muted-foreground">Recipients</p>
                <p className="font-medium">{detail.recipient_count}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Per recipient</p>
                <p className="font-medium">{lamportsToSol(detail.lamports_per_recipient)} SOL</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="font-medium">{lamportsToSol(Number(detail.total_lamports))} SOL</p>
              </div>
            </div>

            {/* Add recipients (draft only) */}
            {detail.status === 'draft' && (
              <form onSubmit={handleAddRecipients} className="space-y-1.5">
                <Label>Add recipients</Label>
                <Textarea
                  placeholder="One wallet address per line (or comma-separated)"
                  value={wallets}
                  onChange={(e) => setWallets(e.target.value)}
                  rows={3}
                  className="font-mono text-xs"
                />
                <Button type="submit" size="sm" variant="outline" disabled={adding || !wallets.trim()}>
                  {adding ? 'Adding…' : 'Add recipients'}
                </Button>
              </form>
            )}

            {/* Approve */}
            {detail.status === 'draft' && detail.recipient_count > 0 && (
              <div className="border-t pt-3">
                <Button size="sm" onClick={handleApprove} disabled={approving}>
                  <CheckCircleIcon size={14} />
                  {approving ? 'Approving…' : 'Approve for distribution'}
                </Button>
              </div>
            )}

            {/* Batch table */}
            {detail.batches.length > 0 && (
              <div className="space-y-2">
                <Label>Batches</Label>
                <div className="space-y-1.5">
                  <Label htmlFor="treasury-addr" className="text-xs text-muted-foreground">
                    Treasury wallet (required to build)
                  </Label>
                  <Input
                    id="treasury-addr"
                    placeholder="Treasury wallet address"
                    value={treasury}
                    onChange={(e) => setTreasury(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Pending</TableHead>
                        <TableHead>Distributed</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.batches.map((b) => (
                        <TableRow key={b.batch_index}>
                          <TableCell>#{b.batch_index}</TableCell>
                          <TableCell>{b.total}</TableCell>
                          <TableCell>{b.pending}</TableCell>
                          <TableCell>{b.distributed}</TableCell>
                          <TableCell>
                            {b.pending > 0 && (detail.status === 'approved' || detail.status === 'in_progress') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={building}
                                onClick={() => handleBuildBatch(b)}
                              >
                                Build
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Confirm built batch */}
            {batchTx && (
              <form onSubmit={handleConfirmBatch} className="space-y-2 border-t pt-3">
                <Label>Confirm batch #{batchTx.index}</Label>
                <div className="rounded-md border p-2 bg-muted font-mono text-xs break-all">
                  {batchTx.transaction}
                </div>
                <p className="text-xs text-muted-foreground">
                  Sign this transaction with the treasury wallet, then paste the signature below.
                </p>
                <Input
                  placeholder="Transaction signature"
                  value={confirmSig}
                  onChange={(e) => setConfirmSig(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button type="submit" size="sm" disabled={confirming || !confirmSig.trim()}>
                  {confirming ? 'Confirming…' : 'Confirm batch'}
                </Button>
              </form>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
