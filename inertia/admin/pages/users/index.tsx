import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { toast } from 'sonner'

type UserRow = {
  id: number
  email: string
  fullName: string | null
  role: 'admin' | 'editor' | 'translator'
  createdAt?: string
}

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function UsersIndex() {
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<UserRow[]>([])
  const [filter, setFilter] = useState('')
  const [saving, setSaving] = useState<Record<number, boolean>>({})
  const [pwdFor, setPwdFor] = useState<number | null>(null)
  const [pwd, setPwd] = useState('')

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

  useEffect(() => {
    load()
  }, [])

  function filteredRows() {
    const q = filter.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      r.email.toLowerCase().includes(q) ||
      (r.fullName || '').toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q)
    )
  }

  async function saveRow(id: number, patch: Partial<UserRow>) {
    setSaving((s) => ({ ...s, [id]: true }))
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to save user')
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
          Accept: 'application/json',
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

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="User Management" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Users' }]} />
        <div className="bg-backdrop-low rounded-lg border border-line p-6">
          <div className="flex items-center justify-between mb-4">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by email, name, role…"
              className="max-w-sm"
            />
            {loading && <span className="text-xs text-neutral-low">Loading…</span>}
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-neutral-medium">
                  <th className="text-left py-2 pr-2">Email</th>
                  <th className="text-left py-2 pr-2">Full Name</th>
                  <th className="text-left py-2 pr-2">Role</th>
                  <th className="text-right py-2 pl-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows().map((u) => (
                  <tr key={u.id} className="border-t border-line">
                    <td className="py-2 pr-2">{u.email}</td>
                    <td className="py-2 pr-2">
                      <Input
                        defaultValue={u.fullName || ''}
                        onBlur={(e) => {
                          const val = e.target.value
                          if (val !== (u.fullName || '')) saveRow(u.id, { fullName: val })
                        }}
                        placeholder="Full name"
                        className="max-w-xs"
                      />
                    </td>
                    <td className="py-2 pr-2">
                      <Select defaultValue={u.role} onValueChange={(val) => saveRow(u.id, { role: val as any })}>
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                          <SelectItem value="translator">Translator</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-2 pl-2 text-right">
                  <a
                    href={`/admin/users/${u.id}/edit`}
                    className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium mr-2"
                  >
                    Edit
                  </a>
                      {pwdFor === u.id ? (
                        <div className="inline-flex items-center gap-2">
                          <Input
                            type="password"
                            value={pwd}
                            onChange={(e) => setPwd(e.target.value)}
                            placeholder="New password"
                            className="w-[200px]"
                          />
                          <button
                            className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-high"
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
                            className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
                            onClick={() => { setPwdFor(null); setPwd('') }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
                          onClick={() => setPwdFor(u.id)}
                        >
                          Reset Password
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredRows().length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-neutral-low">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}

