'use client'

/**
 * Platform config (#93) — the PATCHable subset (fee_bps, seeker_fee_bps,
 * grace_period_seconds); the rest of the row is shown read-only. Server
 * validates ranges (0–10000 bps, grace ≤ 30 days) and busts its cache.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AdminPlatformConfig } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi } from '@/api/client'
import { ApiError } from '@/lib/api'

export default function ConfigPage() {
  const [config, setConfig] = useState<AdminPlatformConfig | null>(null)
  const [feeBps, setFeeBps] = useState('')
  const [seekerFeeBps, setSeekerFeeBps] = useState('')
  const [graceSeconds, setGraceSeconds] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    adminApi.platformConfig
      .get()
      .then((row) => {
        if (!alive) return
        setConfig(row)
        setFeeBps(String(row.fee_bps))
        setSeekerFeeBps(String(row.seeker_fee_bps))
        setGraceSeconds(String(row.grace_period_seconds))
      })
      .catch((err: unknown) => {
        if (alive) toast.error(err instanceof ApiError ? err.message : 'Failed to load config')
      })
    return () => {
      alive = false
    }
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const updated = await adminApi.platformConfig.update({
        fee_bps: Number(feeBps),
        seeker_fee_bps: Number(seekerFeeBps),
        grace_period_seconds: Number(graceSeconds),
      })
      setConfig(updated)
      toast.success('Config saved — server cache busted')
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <AppHeader title="Platform Config" />
      <div className="flex flex-col gap-4 p-4">
        {config === null ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <form onSubmit={save} className="grid max-w-2xl gap-4 rounded-md border p-4 md:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="fee">Platform fee (bps)</Label>
                <Input id="fee" type="number" min={0} max={10000} value={feeBps} onChange={(e) => setFeeBps(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="seeker">Seeker fee (bps)</Label>
                <Input id="seeker" type="number" min={0} max={10000} value={seekerFeeBps} onChange={(e) => setSeekerFeeBps(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="grace">Grace period (seconds)</Label>
                <Input id="grace" type="number" min={0} value={graceSeconds} onChange={(e) => setGraceSeconds(e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <Button type="submit" disabled={busy}>Save</Button>
              </div>
            </form>

            <div className="max-w-2xl rounded-md border p-4 text-sm">
              <p className="mb-2 font-medium">Read-only</p>
              <dl className="space-y-1">
                <div className="flex justify-between"><dt className="text-muted-foreground">Approval window (s)</dt><dd>{config.approval_window_seconds}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Default sponsored txs</dt><dd>{config.default_sponsored_tx_count}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Moderation rules version</dt><dd>{config.moderation_rules_version}</dd></div>
              </dl>
            </div>
          </>
        )}
      </div>
    </>
  )
}
