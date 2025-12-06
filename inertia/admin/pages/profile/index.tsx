import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { getXsrf } from '~/utils/xsrf'
import { toast } from 'sonner'

export default function ProfileIndex() {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<{ enabledForRole: boolean; hasProfile: boolean; profilePostId?: string | null } | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/profile/status', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (j?.data) {
          setStatus(j.data)
          if (j.data.hasProfile && j.data.profilePostId) {
            window.location.href = `/admin/posts/${j.data.profilePostId}/edit`
          }
        }
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Profile" />
      <AdminHeader title="Profile" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
          {loading ? (
            <p className="text-sm text-neutral-low">Loading…</p>
          ) : !status ? (
            <p className="text-sm text-neutral-low">Unable to load profile status.</p>
          ) : status.enabledForRole ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-medium">You don’t have a Profile yet.</p>
              <button
                className="px-3 py-2 text-sm border border-line-low rounded bg-standout text-on-standout"
                onClick={async () => {
                  const res = await fetch('/api/users/me/profile', {
                    method: 'POST',
                    headers: {
                      Accept: 'application/json',
                      'Content-Type': 'application/json',
                      ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
                    },
                    credentials: 'same-origin',
                  })
                  try {
                    const j = await res.json().catch(() => ({}))
                    if (res.ok && j?.id) {
                      window.location.href = `/admin/posts/${j.id}/edit`
                    } else {
                      toast.error(j?.error || 'Failed to create profile')
                    }
                  } catch {
                    toast.error('Failed to create profile')
                  }
                }}
              >
                Create Profile
              </button>
            </div>
          ) : (
            <p className="text-sm text-neutral-medium">Profiles are not enabled for your role.</p>
          )}
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}




