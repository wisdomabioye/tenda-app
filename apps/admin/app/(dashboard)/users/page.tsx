'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { SearchIcon } from 'lucide-react'
import type { User, UserStatus, UserRole } from '@tenda/shared'
import { ASSIGNABLE_ROLES } from '@tenda/shared'
import { AppHeader } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { ListPagination } from '@/components/common/list-pagination'
import { UserStatusBadge } from '@/components/common/status-badge'
import { adminApi } from '@/api/client'

const LIMIT = 20

function truncateWallet(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function userName(user: User) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name || truncateWallet(user.wallet_address)
}

export default function UsersPage() {
  const router   = useRouter()
  const pathname = usePathname()
  const params   = useSearchParams()

  const search = params.get('search') ?? ''
  const status = params.get('status') ?? ''
  const role   = params.get('role')   ?? ''
  const page   = Math.max(1, Number(params.get('page') ?? '1'))
  const offset = (page - 1) * LIMIT

  const [users,        setUsers]        = useState<User[]>([])
  const [total,        setTotal]        = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [statusTarget, setStatusTarget] = useState<User | null>(null)
  const [roleTarget,   setRoleTarget]   = useState<User | null>(null)
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')
  const [saving,       setSaving]       = useState(false)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.users.list({
        search: search || undefined,
        status: status || undefined,
        role:   role   || undefined,
        offset,
        limit: LIMIT,
      })
      setUsers(res.data)
      setTotal(res.total)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }, [search, status, role, offset])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    if (key !== 'page') sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  async function handleStatusConfirm() {
    if (!statusTarget) return
    const next: UserStatus = statusTarget.status === 'active' ? 'suspended' : 'active'
    setSaving(true)
    try {
      await adminApi.users.updateStatus({ id: statusTarget.id }, { status: next })
      toast.success(next === 'suspended' ? 'User suspended' : 'User reinstated')
      setStatusTarget(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleConfirm() {
    if (!roleTarget) return
    setSaving(true)
    try {
      await adminApi.users.updateRole({ id: roleTarget.id }, { role: selectedRole })
      toast.success('Role updated')
      setRoleTarget(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <AppHeader title="Users" />

      <main className="flex-1 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name or wallet…"
              className="pl-8"
              defaultValue={search}
              onKeyDown={(e) => {
                if (e.key === 'Enter') updateParam('search', (e.target as HTMLInputElement).value.trim())
              }}
              onBlur={(e) => updateParam('search', e.target.value.trim())}
            />
          </div>
          <NativeSelect value={status} onChange={(e) => updateParam('status', e.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </NativeSelect>
          <NativeSelect value={role} onChange={(e) => updateParam('role', e.target.value)}>
            <option value="">All roles</option>
            <option value="user">User</option>
            {ASSIGNABLE_ROLES.filter(r => r !== 'user').map(r => (
              <option key={r} value={r}>{r.replace('_', ' ')}</option>
            ))}
          </NativeSelect>
          <span className="ml-auto text-sm text-muted-foreground">
            {loading ? '…' : `${total} users`}
          </span>
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Loading…</TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">No users found</TableCell>
                </TableRow>
              ) : users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{userName(user)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncateWallet(user.wallet_address)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {user.role.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell><UserStatusBadge status={user.status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {[user.city, user.country].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setStatusTarget(user)}>
                        {user.status === 'active' ? 'Suspend' : 'Reinstate'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedRole(user.role as UserRole)
                        setRoleTarget(user)
                      }}>
                        Role
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ListPagination
          page={page}
          totalPages={Math.ceil(total / LIMIT)}
          onPageChange={(p) => updateParam('page', String(p))}
        />
      </main>

      <ConfirmDialog
        open={!!statusTarget}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={statusTarget?.status === 'active' ? 'Suspend User' : 'Reinstate User'}
        description={
          statusTarget?.status === 'active'
            ? `Suspend ${userName(statusTarget)}? They will lose access to the platform.`
            : `Reinstate ${statusTarget ? userName(statusTarget) : ''}? They will regain access to the platform.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Suspend' : 'Reinstate'}
        variant={statusTarget?.status === 'active' ? 'destructive' : 'default'}
        loading={saving}
        onConfirm={handleStatusConfirm}
      />

      {/* Role dialog has custom content (select) so stays inline */}
      <Dialog open={!!roleTarget} onOpenChange={(o) => !o && setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Change role for <span className="font-medium text-foreground">
                {roleTarget ? userName(roleTarget) : ''}
              </span>
            </p>
            <NativeSelect
              className="w-full"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
            >
              {ASSIGNABLE_ROLES.map(r => (
                <option key={r} value={r}>{r.replace('_', ' ')}</option>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)}>Cancel</Button>
            <Button onClick={handleRoleConfirm} disabled={saving}>
              {saving ? 'Saving…' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
