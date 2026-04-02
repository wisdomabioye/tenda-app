'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { PushBroadcastTarget } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect } from '@/components/ui/native-select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/api/client'

const TARGETS: { value: PushBroadcastTarget; label: string; hint: string }[] = [
  { value: 'all',     label: 'All users',    hint: 'Sends to every registered device.' },
  { value: 'role',    label: 'By role',      hint: 'e.g. worker, poster, exchange_seller' },
  { value: 'country', label: 'By country',   hint: 'ISO 3166-1 alpha-2 code, e.g. NG' },
  { value: 'city',    label: 'By city',      hint: 'City name as stored in user profile' },
]

export default function PushPage() {
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [target,      setTarget]      = useState<PushBroadcastTarget>('all')
  const [targetValue, setTargetValue] = useState('')
  const [sending,     setSending]     = useState(false)
  const [result,      setResult]      = useState<{ attempted: number } | null>(null)

  const targetMeta = TARGETS.find((t) => t.value === target)!
  const needsValue = target !== 'all'

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!title.trim() || !body.trim()) { toast.error('Title and body are required'); return }
    if (needsValue && !targetValue.trim()) { toast.error('Target value is required'); return }

    setSending(true)
    setResult(null)
    try {
      const res = await adminApi.push.broadcast({
        title:        title.trim(),
        body:         body.trim(),
        target,
        target_value: needsValue ? targetValue.trim() : undefined,
      })
      setResult(res)
      toast.success(`Broadcast sent to ${res.attempted} device(s)`)
      setTitle('')
      setBody('')
      setTargetValue('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send broadcast')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <AppHeader title="Push Notifications" />

      <main className="flex-1 p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Broadcast Push</CardTitle>
            <CardDescription>
              Send a push notification to a targeted group of users.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="push-title">Title</Label>
                <Input
                  id="push-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Notification title"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="push-body">Body</Label>
                <Textarea
                  id="push-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Notification message"
                  rows={3}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="push-target">Target</Label>
                <NativeSelect
                  id="push-target"
                  value={target}
                  onChange={(e) => { setTarget(e.target.value as PushBroadcastTarget); setTargetValue('') }}
                  className="w-full"
                >
                  {TARGETS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </NativeSelect>
                <p className="text-xs text-muted-foreground">{targetMeta.hint}</p>
              </div>
              {needsValue && (
                <div className="space-y-1.5">
                  <Label htmlFor="push-target-value">Target value</Label>
                  <Input
                    id="push-target-value"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder={targetMeta.hint}
                    required
                  />
                </div>
              )}
              {result && (
                <p className="text-sm text-muted-foreground">
                  Last broadcast reached <strong>{result.attempted}</strong> device(s).
                </p>
              )}
              <Button type="submit" disabled={sending}>
                {sending ? 'Sending…' : 'Send broadcast'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </>
  )
}
