'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { User, UserRole } from '@tenda/shared'
import { ASSIGNABLE_ROLES } from '@tenda/shared'
import { Button } from '@/components/ui/button'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { adminApi } from '@/api/client'

function userName(user: User) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name || `${user.wallet_address.slice(0, 6)}…${user.wallet_address.slice(-4)}`
}

interface Props {
  user:    User | null
  onClose: () => void
  onSaved: () => void
}

export function RoleDialog({ user, onClose, onSaved }: Props) {
  const [role,   setRole]   = useState<UserRole>(user?.role as UserRole ?? 'user')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!user) return
    setSaving(true)
    try {
      await adminApi.users.updateRole({ id: user.id }, { role })
      toast.success('Role updated')
      onSaved()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Role</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Change role for <span className="font-medium text-foreground">{user ? userName(user) : ''}</span>
          </p>
          <NativeSelect
            className="w-full"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </NativeSelect>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Update Role'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
