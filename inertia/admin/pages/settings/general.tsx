import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { toast } from 'sonner'

type Settings = {
  siteTitle: string
  defaultMetaDescription: string | null
  faviconMediaId: string | null
  defaultOgMediaId: string | null
  logoLightMediaId: string | null
  logoDarkMediaId: string | null
}

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function GeneralSettings() {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Settings>({
    siteTitle: '',
    defaultMetaDescription: '',
    faviconMediaId: '',
    defaultOgMediaId: '',
    logoLightMediaId: '',
    logoDarkMediaId: '',
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (!alive) return
        const s: Settings = {
          siteTitle: j?.data?.siteTitle || '',
          defaultMetaDescription: j?.data?.defaultMetaDescription || '',
          faviconMediaId: j?.data?.faviconMediaId || '',
          defaultOgMediaId: j?.data?.defaultOgMediaId || '',
          logoLightMediaId: j?.data?.logoLightMediaId || '',
          logoDarkMediaId: j?.data?.logoDarkMediaId || '',
        }
        setForm(s)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [])

  async function save() {
    try {
      setSaving(true)
      const res = await fetch('/api/site-settings', {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          siteTitle: form.siteTitle,
          defaultMetaDescription: form.defaultMetaDescription,
          faviconMediaId: form.faviconMediaId || null,
          defaultOgMediaId: form.defaultOgMediaId || null,
          logoLightMediaId: form.logoLightMediaId || null,
          logoDarkMediaId: form.logoDarkMediaId || null,
        }),
      })
      if (res.ok) {
        toast.success('Settings saved')
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="General Settings" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminBreadcrumbs items={[{ label: 'Dashboard', href: '/admin' }, { label: 'Settings', href: '/admin/settings' }, { label: 'General' }]} />
        <div className="bg-backdrop-low rounded-lg border border-line p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-medium mb-1">Site Title</label>
            <Input value={form.siteTitle} onChange={(e) => setForm({ ...form, siteTitle: e.target.value })} placeholder="Site Title" />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-medium mb-1">Default Meta Description</label>
            <Textarea value={form.defaultMetaDescription || ''} onChange={(e) => setForm({ ...form, defaultMetaDescription: e.target.value })} rows={3} placeholder="Default meta description" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-1">Favicon Media ID</label>
              <Input value={form.faviconMediaId || ''} onChange={(e) => setForm({ ...form, faviconMediaId: e.target.value })} placeholder="Media ID for favicon" />
              <p className="text-xs text-neutral-low mt-1">Upload via Media Library and paste the ID. Derivatives should include 16x16, 32x32, and 180x180.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-1">Default OG Image Media ID</label>
              <Input value={form.defaultOgMediaId || ''} onChange={(e) => setForm({ ...form, defaultOgMediaId: e.target.value })} placeholder="Media ID for default OG image" />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-1">Logo (Light mode) Media ID</label>
              <Input value={form.logoLightMediaId || ''} onChange={(e) => setForm({ ...form, logoLightMediaId: e.target.value })} placeholder="Media ID for light logo" />
              <p className="text-xs text-neutral-low mt-1">Recommended transparent PNG/SVG sized for your header. Provide a light-on-dark version here.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-medium mb-1">Logo (Dark mode) Media ID</label>
              <Input value={form.logoDarkMediaId || ''} onChange={(e) => setForm({ ...form, logoDarkMediaId: e.target.value })} placeholder="Media ID for dark logo" />
              <p className="text-xs text-neutral-low mt-1">Provide a dark-on-light version for light backgrounds.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={`px-3 py-2 text-sm rounded ${saving ? 'opacity-60' : 'bg-standout text-on-standout'}`} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {loading && <span className="text-xs text-neutral-low">Loading…</span>}
          </div>
        </div>
      </main>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}


