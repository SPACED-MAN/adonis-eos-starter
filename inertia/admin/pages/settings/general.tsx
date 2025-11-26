import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { AdminBreadcrumbs } from '../../components/AdminBreadcrumbs'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { toast } from 'sonner'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'

type Settings = {
  siteTitle: string
  defaultMetaDescription: string | null
  faviconMediaId: string | null
  defaultOgMediaId: string | null
  logoLightMediaId: string | null
  logoDarkMediaId: string | null
  profileRolesEnabled: string[]
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
    profileRolesEnabled: [],
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
          profileRolesEnabled: Array.isArray(j?.data?.profileRolesEnabled) ? j.data.profileRolesEnabled : [],
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
          profileRolesEnabled: form.profileRolesEnabled || [],
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

  function MediaIdPicker({
    label,
    value,
    onChange,
  }: {
    label: string
    value: string | null
    onChange: (id: string | null) => void
  }) {
    const [open, setOpen] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [previewAlt, setPreviewAlt] = useState<string>('')
    const id = value || ''

    useEffect(() => {
      let alive = true
      ;(async () => {
        try {
          if (!id) {
            if (alive) {
              setPreviewUrl(null)
              setPreviewAlt('')
            }
            return
          }
          const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          const url = j?.data?.url || null
          const alt = j?.data?.alt || j?.data?.originalFilename || ''
          if (alive) {
            setPreviewUrl(url)
            setPreviewAlt(alt)
          }
        } catch {
          if (alive) {
            setPreviewUrl(null)
            setPreviewAlt('')
          }
        }
      })()
      return () => {
        alive = false
      }
    }, [id])

    return (
      <div>
        <label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
        <div className="flex items-start gap-3">
          <div className="min-w-[72px]">
            {previewUrl ? (
              <div className="w-[72px] h-[72px] border border-line rounded overflow-hidden bg-backdrop-medium">
                <img src={previewUrl} alt={previewAlt} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-[72px] h-[72px] border border-dashed border-line rounded flex items-center justify-center text-[10px] text-neutral-medium">
                No image
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
                onClick={() => setOpen(true)}
              >
                {id ? 'Change' : 'Choose'}
              </button>
              {id && (
                <button
                  type="button"
                  className="px-2 py-1 text-xs border border-line rounded hover:bg-backdrop-medium text-neutral-medium"
                  onClick={() => onChange(null)}
                >
                  Clear
                </button>
              )}
              {previewAlt && <div className="text-[11px] text-neutral-low truncate max-w-[240px]">{previewAlt}</div>}
            </div>
          </div>
        </div>
        <MediaPickerModal
          open={open}
          onOpenChange={setOpen}
          initialSelectedId={id || undefined}
          onSelect={(m) => onChange(m.id)}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-backdrop-low">
      <AdminHeader title="General Settings" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <MediaIdPicker
                label="Favicon"
                value={form.faviconMediaId}
                onChange={(id) => setForm({ ...form, faviconMediaId: id })}
              />
              <p className="text-xs text-neutral-low mt-1">Derivatives should include 16x16, 32x32, and 180x180.</p>
            </div>
            <div>
              <MediaIdPicker
                label="Default OG Image"
                value={form.defaultOgMediaId}
                onChange={(id) => setForm({ ...form, defaultOgMediaId: id })}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <MediaIdPicker
                label="Logo (Light mode)"
                value={form.logoLightMediaId}
                onChange={(id) => setForm({ ...form, logoLightMediaId: id })}
              />
              <p className="text-xs text-neutral-low mt-1">Recommended transparent PNG/SVG sized for your header. Provide a light-on-dark version here.</p>
            </div>
            <div>
              <MediaIdPicker
                label="Logo (Dark mode)"
                value={form.logoDarkMediaId}
                onChange={(id) => setForm({ ...form, logoDarkMediaId: id })}
              />
              <p className="text-xs text-neutral-low mt-1">Provide a dark-on-light version for light backgrounds.</p>
            </div>
          </div>
          {/* Profiles enablement */}
          <div>
            <label className="block text-sm font-medium text-neutral-medium mb-2">Enable Profiles for Roles</label>
            <div className="flex flex-wrap gap-3">
              {['admin', 'editor', 'translator'].map((r) => {
                const checked = form.profileRolesEnabled.includes(r)
                return (
                  <label key={r} className="inline-flex items-center gap-2 text-sm text-neutral-high">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const next = new Set(form.profileRolesEnabled)
                        if (e.target.checked) next.add(r)
                        else next.delete(r)
                        setForm({ ...form, profileRolesEnabled: Array.from(next) })
                      }}
                    />
                    <span className="capitalize">{r}</span>
                  </label>
                )
              })}
            </div>
            <p className="text-xs text-neutral-low mt-1">
              Turning a role off will archive existing Profile posts for users with that role.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className={`px-3 py-2 text-sm rounded ${saving ? 'opacity-60' : 'bg-standout text-on-standout'}`} disabled={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {loading && <span className="text-xs text-neutral-low">Loading…</span>}
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}


