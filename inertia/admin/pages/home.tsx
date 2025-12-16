import { useEffect, useState } from 'react'
import { Head } from '@inertiajs/react'
import { AdminHeader } from '../components/AdminHeader'
import { AdminFooter } from '../components/AdminFooter'

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function Home() {
  const [profileEnabled, setProfileEnabled] = useState<boolean>(false)
  const [hasProfile, setHasProfile] = useState<boolean>(false)
  const [profilePostId, setProfilePostId] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/profile/status', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (j?.data) {
          setProfileEnabled(!!j.data.enabledForRole)
          setHasProfile(!!j.data.hasProfile)
          setProfilePostId(j.data.profilePostId || null)
        }
      } catch {
        /* ignore */
      }
    })()
  }, [])

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <Head title="Dashboard" />
      <AdminHeader title="Dashboard" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
            <h3 className="text-base font-semibold text-neutral-high mb-2">Welcome</h3>
            <p className="text-sm text-neutral-medium">
              This dashboard will show useful insights and quick actions.
            </p>
          </div>
          {profileEnabled && !hasProfile && (
            <div className="bg-backdrop-low rounded-lg border border-line-low p-6">
              <h3 className="text-base font-semibold text-neutral-high mb-2">
                Create your Profile
              </h3>
              <p className="text-sm text-neutral-medium mb-3">
                You don’t have a Profile yet. Create one to manage your bio.
              </p>
              <button
                className="px-3 py-2 text-sm border border-line-low rounded bg-standout-medium text-on-standout"
                onClick={async () => {
                  const res = await fetch('/api/users/me/profile', {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
                    },
                    credentials: 'same-origin',
                  })
                  const j = await res.json().catch(() => ({}))
                  if (res.ok && j?.id) {
                    window.location.href = `/admin/posts/${j.id}/edit`
                  } else if (res.ok && profilePostId) {
                    window.location.href = `/admin/posts/${profilePostId}/edit`
                  } else {
                    alert(j?.error || 'Failed to create profile')
                  }
                }}
              >
                Create Profile
              </button>
            </div>
          )}
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
