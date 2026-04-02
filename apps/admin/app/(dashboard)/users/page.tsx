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
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { NativeSelect } from '@/components/ui/native-select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination'
import { adminApi } from '@/api/client'

const LIMIT = 20

type DialogState =
  | { type: 'status'; user: User }
  | { type: 'role';   user: User }
  | null

function truncateWallet(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function userName(user: User) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
  return name || truncateWallet(user.wallet_address)
}

function StatusBadge({ status }: { status: UserStatus }) {
  return (
    <Badge
      variant={status === 'active' ? 'default' : 'destructive'}
      className="capitalize"
    >
      {status}
    </Badge>
  )
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Badge variant="outline" className="capitalize">
      {role.replace('_', ' ')}
    </Badge>
  )
}

export default function UsersPage() {
  const router     = useRouter()
  const pathname   = usePathname()
  const params     = useSearchParams()

  const search = params.get('search') ?? ''
  const status = params.get('status') ?? ''
  const role   = params.get('role')   ?? ''
  const page   = Math.max(1, Number(params.get('page') ?? '1'))
  const offset = (page - 1) * LIMIT

  const [users,   setUsers]   = useState<User[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [dialog,  setDialog]  = useState<DialogState>(null)
  const [saving,  setSaving]  = useState(false)

  // role selector state lives in dialog
  const [selectedRole, setSelectedRole] = useState<UserRole>('user')

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await adminApi.users.list({
        search:  search  || undefined,
        status:  status  || undefined,
        role:    role    || undefined,
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
  }, [search, status, role, page])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  function updateParam(key: string, value: string) {
    const sp = new URLSearchParams(params.toString())
    if (value) sp.set(key, value); else sp.delete(key)
    if (key !== 'page') sp.delete('page')
    router.push(`${pathname}?${sp.toString()}`)
  }

  async function handleStatusSave() {
    if (dialog?.type !== 'status') return
    const { user } = dialog
    const next: UserStatus = user.status === 'active' ? 'suspended' : 'active'
    setSaving(true)
    try {
      await adminApi.users.updateStatus({ id: user.id }, { status: next })
      toast.success(`User ${next === 'suspended' ? 'suspended' : 'reinstated'}`)
      setDialog(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setSaving(false)
    }
  }

  async function handleRoleSave() {
    if (dialog?.type !== 'role') return
    setSaving(true)
    try {
      await adminApi.users.updateRole({ id: dialog.user.id }, { role: selectedRole })
      toast.success('Role updated')
      setDialog(null)
      fetchUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <>
      <AppHeader title="Users" />

      <main className="flex-1 p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search name or wallet…"
              className="pl-8"
              defaultValue={search}
              onKeyDown={(e) => {
                if (e.key === 'Enter')
                  updateParam('search', (e.target as HTMLInputElement).value.trim())
              }}
              onBlur={(e) => updateParam('search', e.target.value.trim())}
            />
          </div>
          <NativeSelect
            value={status}
            onChange={(e) => updateParam('status', e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </NativeSelect>
          <NativeSelect
            value={role}
            onChange={(e) => updateParam('role', e.target.value)}
          >
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

        {/* Table */}
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
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{userName(user)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {truncateWallet(user.wallet_address)}
                  </TableCell>
                  <TableCell><RoleBadge role={user.role} /></TableCell>
                  <TableCell><StatusBadge status={user.status} /></TableCell>
                  <TableCell className="text-muted-foreground">
                    {[user.city, user.country].filter(Boolean).join(', ') || '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.created_at ? format(new Date(user.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialog({ type: 'status', user })}
                      >
                        {user.status === 'active' ? 'Suspend' : 'Reinstate'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedRole(user.role === 'user' ? 'user' : user.role as UserRole)
                          setDialog({ type: 'role', user })
                        }}
                      >
                        Role
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page > 1) updateParam('page', String(page - 1)) }}
                  aria-disabled={page <= 1}
                />
              </PaginationItem>
              <PaginationItem className="text-sm text-muted-foreground px-3">
                {page} / {totalPages}
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => { e.preventDefault(); if (page < totalPages) updateParam('page', String(page + 1)) }}
                  aria-disabled={page >= totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </main>

      {/* Update Status Dialog */}
      <Dialog open={dialog?.type === 'status'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog?.type === 'status' && dialog.user.status === 'active'
                ? 'Suspend User'
                : 'Reinstate User'}
            </DialogTitle>
          </DialogHeader>
          {dialog?.type === 'status' && (
            <p className="text-sm text-muted-foreground">
              {dialog.user.status === 'active'
                ? `Suspend ${userName(dialog.user)}? They will lose access to the platform.`
                : `Reinstate ${userName(dialog.user)}? They will regain access to the platform.`}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button
              variant={dialog?.type === 'status' && dialog.user.status === 'active' ? 'destructive' : 'default'}
              onClick={handleStatusSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Role Dialog */}
      <Dialog open={dialog?.type === 'role'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Role</DialogTitle>
          </DialogHeader>
          {dialog?.type === 'role' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Change role for <span className="font-medium text-foreground">{userName(dialog.user)}</span>
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
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancel</Button>
            <Button onClick={handleRoleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Update Role'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
