import { useEffect, useState } from 'react'
import { Head, usePage } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { toast } from 'sonner'
import { getXsrf } from '~/utils/xsrf'
import { ROLES, type Role } from '~/types/roles'

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
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<Role>('editor' as Role)
  const [newPassword, setNewPassword] = useState('')
  const [siteSettings, setSiteSettings] = useState<{ profileRolesEnabled?: string[] } | null>(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<{ slug: string; customFields?: Array<{ slug: string; value: any }> } | null>(null)

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          setLoading(true)
          const res = await fetch('/api/users', { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          const list: Array<{ id: number; email: string; username?: string | null; role: Role }> = Array.isArray(j?.data) ? j.data : []
          const found = list.find((u) => String((u as any).id) === String(userId))
          if (alive && found) {
            setEmail((found as any).email || '')
            setUsername(((found as any).username || '') as string)
            setRole(((found as any).role || 'editor') as Role)
          }
          // Load site settings for profile enablement
          try {
            const sres = await fetch('/api/site-settings', { credentials: 'same-origin' })
            const sj = await sres.json().catch(() => ({}))
            if (alive) setSiteSettings((sj?.data || null) as any)
          } catch { /* ignore */ }
        } finally {
          if (alive) setLoading(false)
        }
      })()
    return () => { alive = false }
  }, [userId])

  const profileEnabledForRole = (() => {
    const enabledList = Array.isArray(siteSettings?.profileRolesEnabled) ? siteSettings!.profileRolesEnabled! : []
    return enabledList.length === 0 || enabledList.includes(role)
  })()

  async function loadProfile() {
    setProfileLoading(true)
    try {
      // lookup by user id
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}/profile`, { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      const pid: string | null = j?.id || null
      setProfileId(pid)
      if (pid) {
        // load export for custom fields/slug
        const es = await fetch(`/api/posts/${encodeURIComponent(pid)}/export`, { credentials: 'same-origin' })
        const ej = await es.json().catch(() => ({}))
        const post = ej?.post
        if (post) {
          setProfileData({ slug: post.slug, customFields: Array.isArray(post.customFields) ? post.customFields : [] })
        } else {
          setProfileData(null)
        }
      } else {
        setProfileData(null)
      }
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    if (profileEnabledForRole) {
      loadProfile()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileEnabledForRole, userId])

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
        body: JSON.stringify({ email, username, role }),
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
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Edit User" />
      <AdminHeader title="Edit User" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Users', href: '/admin/users' }, { label: 'Edit' }]} />
        <div className="bg-backdrop-low rounded-lg border border-line-low p-6 space-y-6">
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
                  <label className="block text-sm font-medium text-neutral-medium mb-1">Username</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">Role</label>
                  <Select defaultValue={role} onValueChange={(val) => setRole(val as Role)}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </SelectItem>
                      ))}
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

              <div className="border-t border-line-low pt-6">
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
                    className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high"
                    onClick={updatePassword}
                  >
                    Update Password
                  </button>
                </div>
              </div>

              {profileEnabledForRole && (
                <div className="border-t border-line-low pt-6">
                  <h3 className="text-sm font-semibold text-neutral-high mb-3">Profile</h3>
                  {profileLoading ? (
                    <p className="text-sm text-neutral-low">Loading…</p>
                  ) : (
                    <>
                      {profileId ? (
                        <>
                          {Array.isArray(profileData?.customFields) && profileData!.customFields!.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                              {profileData!.customFields!.map((f, idx) => {
                                const v = (f as any).value
                                // Media: show thumbnail if url present, else show id
                                if (typeof v === 'object' && v && (v.url || v.id)) {
                                  const url = v.url || null
                                  return (
                                    <div key={`${f.slug}-${idx}`} className="text-sm">
                                      <div className="text-neutral-medium mb-1">{f.slug}</div>
                                      <div className="border border-line-low rounded p-2 bg-backdrop-low inline-flex items-center gap-3">
                                        <div className="w-12 h-12 bg-backdrop-medium rounded overflow-hidden flex items-center justify-center">
                                          {url ? <img src={url} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-neutral-medium">{v.id}</span>}
                                        </div>
                                        {!url && typeof v.id === 'string' && <span className="text-xs text-neutral-medium">{v.id}</span>}
                                      </div>
                                    </div>
                                  )
                                }
                                // Text-like
                                return (
                                  <div key={`${f.slug}-${idx}`} className="text-sm">
                                    <div className="text-neutral-medium mb-1">{f.slug}</div>
                                    <div className="border border-line-low rounded p-2 bg-backdrop-low">{String(v ?? '') || <span className="text-neutral-low">—</span>}</div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-sm text-neutral-low mb-3">No profile details yet.</p>
                          )}
                          <div className="flex items-center gap-2">
                            <a
                              href={`/admin/posts/${profileId}/edit`}
                              className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high"
                            >
                              Edit Profile
                            </a>
                            {profileData?.slug && (
                              <a
                                href={`/posts/${profileData.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-medium"
                              >
                                View Profile
                              </a>
                            )}
                          </div>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high"
                          onClick={async () => {
                            try {
                              const csrf = getXsrf()
                              const res = await fetch(`/api/users/${encodeURIComponent(userId)}/profile`, {
                                method: 'POST',
                                headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}) },
                                credentials: 'same-origin',
                              })
                              const j = await res.json().catch(() => ({}))
                              if (!res.ok || !j?.id) {
                                toast.error(j?.error || 'Failed to create profile')
                                return
                              }
                              toast.success('Profile created')
                              window.location.href = `/admin/posts/${j.id}/edit`
                            } catch {
                              toast.error('Failed to create profile')
                            }
                          }}
                        >
                          Create Profile
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
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




