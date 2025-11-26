import { useEffect, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { toast } from 'sonner'

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function UserEdit() {
  const page = usePage()
  const idParam = (page as any)?.props?.id || (() => {
    // Fallback parse from URL
    const parts = (typeof window !== 'undefined' ? window.location.pathname : '').split('/')
    return parts[parts.length - 2] === 'users' ? parts[parts.length - 1] : ''
  })()
  const userId = String(idParam || '').trim()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'translator'>('editor')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/users', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        const list: Array<{ id: number; email: string; fullName?: string | null; role: any }> = Array.isArray(j?.data) ? j.data : []
        const found = list.find((u) => String((u as any).id) === String(userId))
        if (alive && found) {
          setEmail((found as any).email || '')
          setFullName(((found as any).fullName || '') as string)
          setRole(((found as any).role || 'editor') as any)
        }
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [userId])

  async function save() {
    try {
      setSaving(true)
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ email, fullName, role }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to save')
        return
      }
      toast.success('User saved')
    } finally {
      setSaving(false)
    }
  }

  async function updatePassword() {
    if (!newPassword || newPassword.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }
    try {
      setSaving(true)
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/password`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ password: newPassword }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to update password')
        return
      }
      setNewPassword('')
      toast.success('Password updated')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <Head title="Edit User" />
      <AdminHeader title="Edit User" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Users', href: '/admin/users' }, { label: 'Edit' }]} />
        <div className="bg-backdrop-low rounded-lg border border-line p-6 space-y-6">
          {loading ? (
            <p className="text-sm text-neutral-low">Loading…</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">Email</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">Full Name</label>
                  <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">Role</label>
                  <Select defaultValue={role} onValueChange={(val) => setRole(val as any)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="translator">Translator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`px-3 py-2 text-sm rounded ${saving ? 'opacity-60' : 'bg-standout text-on-standout'}`}
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>

              <div className="border-t border-line pt-6">
                <h3 className="text-sm font-semibold text-neutral-high mb-2">Reset Password</h3>
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-[240px]"
                  />
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-line rounded hover:bg-backdrop-medium text-neutral-high"
                    onClick={updatePassword}
                  >
                    Update Password
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}




