import { useEffect, useState } from 'react'
import { usePage, router } from '@inertiajs/react'
import { useAdminPath } from '~/utils/adminPath'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { bypassUnsavedChanges } from '~/hooks/useUnsavedChanges'
import { Input } from '../../../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '~/components/ui/alert-dialog'
import { getXsrf } from '~/utils/xsrf'
import { type Role } from '~/types/roles'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'

type UserRow = {
  id: number
  email: string
  username: string | null
  fullName: string | null
  role: Role
  createdAt?: string
}

export default function UsersIndex() {
  const adminPath = useAdminPath()
  const page = usePage()
  const me = (page.props as any)?.auth?.user
  const isSuperAdmin = me?.role === 'admin'
  const availableRoles = (page.props as any)?.roles || []
  const [activeTab, setActiveTab] = useState('list')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<UserRow[]>([])
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [pwdFor, setPwdFor] = useState<number | null>(null)
  const [pwd, setPwd] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [createRole, setCreateRole] = useState<string>('')
  const [creating, setCreating] = useState(false)

  // Profile settings state
  const [profileSettingsLoading, setProfileSettingsLoading] = useState(false)
  const [profileSettingsSaving, setProfileSettingsSaving] = useState(false)
  const [profileRolesEnabled, setProfileRolesEnabled] = useState<string[]>([])

  // Helper to get role label from role name
  function getRoleLabel(roleName: string): string {
    const role = availableRoles.find((r: any) => r.name === roleName)
    return role?.label || roleName.charAt(0).toUpperCase() + roleName.slice(1)
  }

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      const list: UserRow[] = Array.isArray(json?.data) ? json.data : []
      setRows(list)
    } finally {
      setLoading(false)
    }
  }

  async function loadProfileSettings() {
    setProfileSettingsLoading(true)
    try {
      const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      setProfileRolesEnabled(
        Array.isArray(json?.data?.profileRolesEnabled) ? json.data.profileRolesEnabled : []
      )
    } finally {
      setProfileSettingsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'list') {
      load()
    } else if (activeTab === 'profiles') {
      loadProfileSettings()
    }
  }, [activeTab])

  async function saveProfileSettings() {
    setProfileSettingsSaving(true)
    try {
      const res = await fetch('/api/site-settings', {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ profileRolesEnabled }),
      })
      if (res.ok) {
        toast.success('Profile settings saved')
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to save settings')
      }
    } finally {
      setProfileSettingsSaving(false)
    }
  }

  function filteredRows() {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.email.toLowerCase().includes(q) ||
        (r.username || '').toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        getRoleLabel(r.role).toLowerCase().includes(q)
    )
  }

  async function saveRow(id: number, patch: Partial<UserRow>) {
    setSaving((s) => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          ...patch,
          username: patch.username !== undefined ? patch.username || null : undefined,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        const msg = j?.errors ? j.errors[0]?.message : j?.error || 'Failed to save user'
        toast.error(msg)
        return
      }
      await load()
      toast.success('Saved')
    } finally {
      setSaving((s) => ({ ...s, [id]: false }))
    }
  }

  async function resetPassword(id: number, password: string) {
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    setSaving((s) => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}/password`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to update password')
        return
      }
      toast.success('Password updated')
    } finally {
      setSaving((s) => ({ ...s, [id]: false }))
    }
  }

  async function createUser() {
    const email = createEmail.trim()
    const password = createPassword
    const role = createRole
    if (!email || !email.includes('@')) {
      toast.error('Valid email is required')
      return
    }
    if (!password || password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    if (!role) {
      toast.error('Select a role')
      return
    }
    setCreating(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password, role, username: null }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = j?.errors ? j.errors[0]?.message : j?.error || 'Failed to create user'
        toast.error(msg)
        return
      }
      toast.success('User created')
      setCreateEmail('')
      setCreatePassword('')
      setCreateRole('')
      setCreateOpen(false)
      await load()
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Users" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border-b border-line-low mb-6">
          <nav className="flex gap-4">
            <button
              onClick={() => setActiveTab('list')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'list'
                  ? 'border-standout-high text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              User List
            </button>
            <button
              onClick={() => setActiveTab('profiles')}
              className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'profiles'
                  ? 'border-standout-high text-standout-high'
                  : 'border-transparent text-neutral-medium hover:text-neutral-high'
              }`}
            >
              Profiles
            </button>
          </nav>
        </div>

        {activeTab === 'list' && (
          <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter users…"
                className="w-full sm:max-w-xs"
              />
              <div className="flex items-center justify-between sm:justify-end gap-4">
                {loading && <span className="text-xs text-neutral-low">Loading…</span>}
                <AlertDialog open={createOpen} onOpenChange={setCreateOpen}>
                  <AlertDialogTrigger asChild>
                    <button
                      className="px-3 py-2 text-sm rounded bg-standout-high text-on-high hover:opacity-90"
                      type="button"
                    >
                      Add user
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Add new user</AlertDialogTitle>
                    </AlertDialogHeader>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-sm text-neutral-medium" htmlFor="create-email">
                          Email
                        </label>
                        <Input
                          id="create-email"
                          value={createEmail}
                          onChange={(e) => setCreateEmail(e.target.value)}
                          placeholder="user@example.com"
                          type="email"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm text-neutral-medium" htmlFor="create-password">
                          Password
                        </label>
                        <Input
                          id="create-password"
                          value={createPassword}
                          onChange={(e) => setCreatePassword(e.target.value)}
                          placeholder="At least 8 characters"
                          type="password"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-sm text-neutral-medium" htmlFor="create-role">
                          Role
                        </label>
                        <Select value={createRole} onValueChange={setCreateRole}>
                          <SelectTrigger id="create-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((r: any) => (
                              <SelectItem key={r.name} value={r.name}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm rounded border border-line-medium hover:bg-backdrop-medium text-neutral-medium"
                        onClick={() => setCreateOpen(false)}
                        disabled={creating}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="px-3 py-2 text-sm rounded bg-standout-high text-on-high hover:opacity-90 disabled:opacity-50"
                        onClick={createUser}
                        disabled={creating}
                      >
                        {creating ? 'Creating…' : 'Create'}
                      </button>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows().map((u) => {
                  const isUserAdmin = u.role === 'admin'
                  const canModifyUser = isSuperAdmin || !isUserAdmin
                  const canDeleteUser =
                    isSuperAdmin || (!isUserAdmin && String(me?.id) !== String(u.id))

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="max-w-[150px] sm:max-w-none">
                        <div className="truncate font-medium">{u.email}</div>
                        <div className="md:hidden text-xs text-neutral-low mt-0.5 truncate italic">
                          {u.username || 'No username'}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Input
                          defaultValue={u.username || ''}
                          disabled={!canModifyUser}
                          onBlur={(e) => {
                            const val = e.target.value
                            if (val !== (u.username || '')) saveRow(u.id, { username: val })
                          }}
                          placeholder="Username"
                          className="max-w-xs"
                        />
                      </TableCell>
                      <TableCell>
                        <Select
                          defaultValue={u.role}
                          disabled={!canModifyUser}
                          onValueChange={(val) => saveRow(u.id, { role: val as Role })}
                        >
                          <SelectTrigger className="w-[110px] sm:w-[160px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles
                              .filter((r: any) => isSuperAdmin || r.name !== 'admin')
                              .map((r: any) => (
                                <SelectItem key={r.name} value={r.name}>
                                  {r.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-2">
                        {canModifyUser && (
                          <>
                            <div className="flex items-center gap-2">
                              <a
                                href={adminPath(`users/${u.id}/edit`)}
                                className="px-2 py-1 text-[10px] sm:text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                              >
                                Edit
                              </a>
                              <button
                                className="px-2 py-1 text-[10px] sm:text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-high"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(
                                      `/api/users/${encodeURIComponent(u.id)}/profile`,
                                      {
                                        credentials: 'same-origin',
                                      }
                                    )
                                    const j = await res.json().catch(() => ({}))
                                    let pid: string | null = j?.id || null
                                    if (!pid) {
                                      const csrf = getXsrf()
                                      const createRes = await fetch(
                                        `/api/users/${encodeURIComponent(u.id)}/profile`,
                                        {
                                          method: 'POST',
                                          headers: {
                                            'Accept': 'application/json',
                                            'Content-Type': 'application/json',
                                            ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
                                          },
                                          credentials: 'same-origin',
                                        }
                                      )
                                      const cj = await createRes.json().catch(() => ({}))
                                      if (!createRes.ok) {
                                        toast.error(cj?.error || 'Failed to create profile')
                                        return
                                      }
                                      pid = cj?.id || null
                                    }
                                    if (pid) {
                                      bypassUnsavedChanges(true)
                                      router.visit(adminPath(`posts/${pid}/edit`))
                                    }
                                  } catch {
                                    toast.error('Failed to open profile')
                                  }
                                }}
                              >
                                Profile
                              </button>
                            </div>
                            
                            {pwdFor === u.id ? (
                              <div className="flex items-center gap-2 mt-1 sm:mt-0">
                                <Input
                                  type="password"
                                  value={pwd}
                                  onChange={(e) => setPwd(e.target.value)}
                                  placeholder="New"
                                  className="w-[100px] h-8 text-xs"
                                />
                                <button
                                  className="px-2 py-1 text-[10px] border border-line-medium rounded bg-standout-high text-on-high"
                                  disabled={!!saving[u.id]}
                                  onClick={() => {
                                    resetPassword(u.id, pwd)
                                    setPwdFor(null)
                                    setPwd('')
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  className="px-2 py-1 text-[10px] border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                                  onClick={() => {
                                    setPwdFor(null)
                                    setPwd('')
                                  }}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                className="px-2 py-1 text-[10px] sm:text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                                onClick={() => setPwdFor(u.id)}
                              >
                                PW
                              </button>
                            )}
                          </>
                        )}
                        {canDeleteUser && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <button className="px-2 py-1 text-[10px] sm:text-xs border border-[#ef4444] text-[#ef4444] rounded hover:bg-[rgba(239,68,68,0.1)]">
                                Del
                              </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete user?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. The account for {u.email} will be
                                  permanently removed.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={async () => {
                                    try {
                                      const csrf = getXsrf()
                                      const res = await fetch(
                                        `/api/users/${encodeURIComponent(u.id)}`,
                                        {
                                          method: 'DELETE',
                                          headers: { ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}) },
                                          credentials: 'same-origin',
                                        }
                                      )
                                      if (!res.ok) {
                                        const j = await res.json().catch(() => ({}))
                                        toast.error(j?.error || 'Failed to delete user')
                                        return
                                      }
                                      toast.success('User deleted')
                                      await load()
                                    } catch {
                                      toast.error('Failed to delete user')
                                    }
                                  }}
                                >
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
                {filteredRows().length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-neutral-low">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'profiles' && (
          <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
            <h3 className="text-base font-semibold text-neutral-high mb-4">Profile Settings</h3>
            {profileSettingsLoading ? (
              <p className="text-sm text-neutral-low">Loading…</p>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    Enable Profiles for Roles
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {availableRoles.map((r: any) => {
                      const checked = profileRolesEnabled.includes(r.name)
                      return (
                        <label
                          key={r.name}
                          className="inline-flex items-center gap-2 text-sm text-neutral-high cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            className="rounded border-line-medium text-standout-high focus:ring-standout-high"
                            onChange={(e) => {
                              const next = new Set(profileRolesEnabled)
                              if (e.target.checked) next.add(r.name)
                              else next.delete(r.name)
                              setProfileRolesEnabled(Array.from(next))
                            }}
                          />
                          <span>{r.label}</span>
                        </label>
                      )
                    })}
                  </div>
                  <p className="text-xs text-neutral-low mt-2">
                    Turning a role off will archive existing Profile posts for users with that role.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`px-3 py-2 text-sm rounded ${profileSettingsSaving ? 'opacity-60' : 'bg-standout-high text-on-high'}`}
                    disabled={profileSettingsSaving}
                    onClick={saveProfileSettings}
                  >
                    {profileSettingsSaving ? 'Saving…' : 'Save Profile Settings'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
