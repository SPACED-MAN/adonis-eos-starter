import { useEffect, useState, useMemo } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { toast } from 'sonner'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'

type Settings = {
  siteTitle: string
  defaultMetaDescription: string | null
  faviconMediaId: string | null
  defaultOgMediaId: string | null
  logoMediaId: string | null
  profileRolesEnabled: string[]
  customFieldDefs?: Array<{ slug: string; label: string; type: 'text' | 'url' | 'textarea' | 'boolean' | 'media' | 'form-reference' }>
  customFields?: Record<string, any>
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
    logoMediaId: '',
    profileRolesEnabled: [],
    customFieldDefs: [],
    customFields: {},
  })

  const fieldComponents = useMemo(() => {
    const modules = import.meta.glob('../fields/*.tsx', { eager: true }) as Record<
      string,
      { default: any }
    >
    const map: Record<string, any> = {}
    Object.entries(modules).forEach(([path, mod]) => {
      const name = path.split('/').pop()?.replace(/\.\w+$/, '')
      if (name && mod?.default) {
        map[name] = mod.default
      }
    })
    return map
  }, [])

  const pascalFromType = (t: string) =>
    t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')

  useEffect(() => {
    let alive = true
      ; (async () => {
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
            logoMediaId: j?.data?.logoMediaId || '',
            profileRolesEnabled: Array.isArray(j?.data?.profileRolesEnabled) ? j.data.profileRolesEnabled : [],
            customFieldDefs: Array.isArray(j?.data?.customFieldDefs) ? j.data.customFieldDefs : [],
            customFields: (j?.data?.customFields && typeof j.data.customFields === 'object') ? j.data.customFields : {},
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
          logoMediaId: form.logoMediaId || null,
          profileRolesEnabled: form.profileRolesEnabled || [],
          customFields: form.customFields || {},
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

  function useIsDarkMode() {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
      // Initial check
      setIsDark(document.documentElement.classList.contains('dark'))

      // Watch for changes
      const observer = new MutationObserver(() => {
        setIsDark(document.documentElement.classList.contains('dark'))
      })
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      })
      return () => observer.disconnect()
    }, [])

    return isDark
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
    const [mediaData, setMediaData] = useState<{
      baseUrl: string
      variants: MediaVariant[]
      darkSourceUrl?: string
    } | null>(null)
    const id = value || ''
    const isDark = useIsDarkMode()

    // Fetch media data when id changes
    useEffect(() => {
      let alive = true
        ; (async () => {
          try {
            if (!id) {
              if (alive) {
                setMediaData(null)
                setPreviewUrl(null)
                setPreviewAlt('')
              }
              return
            }
            const res = await fetch(`/api/media/${encodeURIComponent(id)}`, { credentials: 'same-origin' })
            const j = await res.json().catch(() => ({}))
            const baseUrl = j?.data?.url || null
            const alt = j?.data?.alt || j?.data?.originalFilename || ''
            const meta = j?.data?.metadata || {}
            const variants: MediaVariant[] = Array.isArray(meta?.variants) ? meta.variants : []
            const darkSourceUrl = typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : undefined
            if (alive) {
              if (baseUrl) {
                setMediaData({ baseUrl, variants, darkSourceUrl })
              } else {
                setMediaData(null)
                setPreviewUrl(null)
              }
              setPreviewAlt(alt)
            }
          } catch {
            if (alive) {
              setMediaData(null)
              setPreviewUrl(null)
              setPreviewAlt('')
            }
          }
        })()
      return () => {
        alive = false
      }
    }, [id])

    // Resolve URL when media data or theme changes
    useEffect(() => {
      if (!mediaData) {
        setPreviewUrl(null)
        return
      }
      const resolved = pickMediaVariantUrl(mediaData.baseUrl, mediaData.variants, 'thumb', {
        darkSourceUrl: mediaData.darkSourceUrl,
      })
      setPreviewUrl(resolved)
    }, [mediaData, isDark])

    return (
      <div>
        <label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
        <div className="flex items-start gap-3">
          <div className="min-w-[72px]">
            {previewUrl ? (
              <div className="w-[72px] h-[72px] border border-line-medium rounded overflow-hidden bg-backdrop-medium">
                <img src={previewUrl} alt={previewAlt} className="w-full h-full object-cover" key={`${previewUrl}-${isDark}`} />
              </div>
            ) : (
              <div className="w-[72px] h-[72px] border border-dashed border-line-high rounded flex items-center justify-center text-[10px] text-neutral-medium">
                No image
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="mt-1 flex items-center gap-2">
              <button
                type="button"
                className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                onClick={() => setOpen(true)}
              >
                {id ? 'Change' : 'Choose'}
              </button>
              {id && (
                <button
                  type="button"
                  className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
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
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="General Settings" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-backdrop-low rounded-lg border border-line-low p-6 space-y-6">
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
                label="Logo"
                value={form.logoMediaId}
                onChange={(id) => setForm({ ...form, logoMediaId: id })}
              />
              <p className="text-xs text-neutral-low mt-1">
                Recommended SVG/PNG sized for your header. Theme-specific variants can be managed on the media item.
              </p>
            </div>
          </div>
          {/* Site Custom Fields */}
          {Array.isArray(form.customFieldDefs) && form.customFieldDefs.length > 0 && (
            <div className="border-t border-line-low pt-6">
              <h3 className="text-base font-semibold text-neutral-high mb-3">Site Fields</h3>
              <div className="space-y-4">
                {form.customFieldDefs.map((f) => {
                  const val = form.customFields?.[f.slug]
                  const compName = `${pascalFromType(f.type)}Field`
                  const Renderer = (fieldComponents as Record<string, any>)[compName]
                  if (Renderer) {
                    return (
                      <div key={f.slug}>
                        <label className="block text-sm font-medium text-neutral-medium mb-1">{f.label}</label>
                        <Renderer
                          value={val ?? null}
                          onChange={(next: any) =>
                            setForm((prev) => ({
                              ...prev,
                              customFields: { ...(prev.customFields || {}), [f.slug]: next },
                            }))
                          }
                          {...(f as any)}
                        />
                      </div>
                    )
                  }
                  // fallback
                  return (
                    <div key={f.slug}>
                      <label className="block text-sm font-medium text-neutral-medium mb-1">{f.label}</label>
                      <Input
                        value={typeof val === 'string' ? val : ''}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            customFields: { ...(prev.customFields || {}), [f.slug]: e.target.value },
                          }))
                        }
                        placeholder={f.type === 'url' ? 'https://' : ''}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          )}
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
            <button type="button" className={`px-3 py-2 text-sm rounded ${saving ? 'opacity-60' : 'bg-standout-medium text-on-standout'}`} disabled={saving} onClick={save}>
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


