'use client'

/**
 * Dispute detail + mediation thread (#91). Routed by DISPUTE id; the
 * summary fetch supplies the escrow id the thread rides on.
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import type { DisputeSummary } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { ClaimActions } from '@/components/disputes/claim-actions'
import { ThreadView } from '@/components/disputes/thread-view'
import { adminApi } from '@/api/client'
import { ApiError } from '@/lib/api'
import { getSessionUser } from '@/lib/auth'

export default function DisputeDetailPage() {
  const params = useParams<{ id: string }>()
  const disputeId = params.id
  const [dispute, setDispute] = useState<DisputeSummary | null>(null)
  const [notFound, setNotFound] = useState(false)
  const meId = getSessionUser()?.id ?? ''

  const refetch = useCallback(async () => {
    try {
      setDispute(await adminApi.disputes.get(disputeId))
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) setNotFound(true)
      else toast.error(err instanceof ApiError ? err.message : 'Failed to load dispute')
    }
  }, [disputeId])

  useEffect(() => {
    void refetch()
  }, [refetch])

  // The thread poll is the freshest assignee source — mirror it locally so
  // the claim button flips without a manual refresh. When the thread
  // reports a resolution we don't know about yet, refetch the summary
  // (it carries winner + resolved_at; never synthesize them).
  const onAssignee = useCallback(
    (assignedToId: string | null, readOnly: boolean) => {
      setDispute((prev) => {
        if (prev === null) return prev
        if (readOnly && prev.resolved_at === null) void refetch()
        return { ...prev, assigned_to_id: assignedToId }
      })
    },
    [refetch],
  )

  if (notFound) {
    return (
      <>
        <AppHeader title="Dispute" />
        <p className="p-6 text-sm text-muted-foreground">
          Dispute not found. <Link href="/disputes" className="underline">Back to the queue</Link>
        </p>
      </>
    )
  }
  if (dispute === null) {
    return (
      <>
        <AppHeader title="Dispute" />
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      </>
    )
  }

  const resolved = dispute.resolved_at !== null
  return (
    <>
      <AppHeader title={dispute.subject_title ?? 'Exchange dispute'} />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
          <Badge variant="outline" className="capitalize">{dispute.kind}</Badge>
          {resolved ? (
            <Badge>resolved · {dispute.winner}</Badge>
          ) : dispute.assigned_to_id === null ? (
            <Badge variant="outline">unclaimed</Badge>
          ) : dispute.assigned_to_id === meId ? (
            <Badge>my caseload</Badge>
          ) : (
            <Badge variant="secondary">claimed by another mediator</Badge>
          )}
          <p className="flex-1 truncate text-sm text-muted-foreground">{dispute.reason}</p>
          <ClaimActions
            disputeId={dispute.dispute_id}
            assignedToId={dispute.assigned_to_id}
            resolved={resolved}
            meId={meId}
            onChanged={() => void refetch()}
          />
        </div>

        <ThreadView escrowId={dispute.escrow_id} onAssignee={onAssignee} />
      </div>
    </>
  )
}
