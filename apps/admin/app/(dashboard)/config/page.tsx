'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AdminPlatformConfig } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/api/client'
import { bpsToPercent, secondsToDays } from '@/lib/utils'

export default function ConfigPage() {
  const [config,  setConfig]  = useState<AdminPlatformConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  const [feeBps,        setFeeBps]        = useState('')
  const [seekerFeeBps,  setSeekerFeeBps]  = useState('')
  const [gracePeriod,   setGracePeriod]   = useState('')

  useEffect(() => {
    adminApi.config.get()
      .then((cfg) => {
        setConfig(cfg)
        setFeeBps(String(cfg.fee_bps))
        setSeekerFeeBps(String(cfg.seeker_fee_bps))
        setGracePeriod(String(cfg.grace_period_seconds))
      })
      .catch(() => toast.error('Failed to load platform config'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    const fee_bps              = parseInt(feeBps, 10)
    const seeker_fee_bps       = parseInt(seekerFeeBps, 10)
    const grace_period_seconds = parseInt(gracePeriod, 10)

    if ([fee_bps, seeker_fee_bps, grace_period_seconds].some(isNaN)) {
      toast.error('All fields must be valid integers')
      return
    }

    setSaving(true)
    try {
      const updated = await adminApi.config.update({ fee_bps, seeker_fee_bps, grace_period_seconds })
      setConfig(updated)
      toast.success('Platform config updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AppHeader title="Platform Config" />

      <main className="flex-1 p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Platform Settings</CardTitle>
            <CardDescription>
              Fee values are in basis points (100 bps = 1%).
              {config && (
                <span className="block mt-1 text-xs">
                  Current: worker fee {bpsToPercent(config.fee_bps)}%, seeker fee {bpsToPercent(config.seeker_fee_bps)}%,
                  grace period {secondsToDays(config.grace_period_seconds)} days
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fee_bps">Worker fee (bps)</Label>
                  <Input
                    id="fee_bps"
                    type="number"
                    min={0}
                    max={10000}
                    value={feeBps}
                    onChange={(e) => setFeeBps(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">= {bpsToPercent(parseInt(feeBps) || 0)}%</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="seeker_fee_bps">Seeker fee (bps)</Label>
                  <Input
                    id="seeker_fee_bps"
                    type="number"
                    min={0}
                    max={10000}
                    value={seekerFeeBps}
                    onChange={(e) => setSeekerFeeBps(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">= {bpsToPercent(parseInt(seekerFeeBps) || 0)}%</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="grace_period">Grace period (seconds)</Label>
                  <Input
                    id="grace_period"
                    type="number"
                    min={0}
                    value={gracePeriod}
                    onChange={(e) => setGracePeriod(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">= {secondsToDays(parseInt(gracePeriod) || 0)} days</p>
                </div>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  )
}
