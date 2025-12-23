import { useEffect, useState, useMemo } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Checkbox } from '../../../components/ui/checkbox'
import { toast } from 'sonner'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'
import { CustomFieldRenderer } from '../../components/CustomFieldRenderer'
import type { CustomFieldDefinition } from '~/types/custom_field'
import { FontAwesomeIcon, getIconProp } from '~/site/lib/icons'

type SocialProfile = {
  network: string
  label: string
  icon: string
  url: string
  enabled: boolean
}

type SocialSharing = {
  network: string
  label: string
  icon: string
  enabled: boolean
}

type Settings = {
  siteTitle: string
  defaultMetaDescription: string | null
  faviconMediaId: string | null
  defaultOgMediaId: string | null
  logoMediaId: string | null
  isMaintenanceMode: boolean
  profileRolesEnabled: string[]
  socialSettings?: {
    profiles: SocialProfile[]
    sharing: SocialSharing[]
  }
  customFieldDefs?: CustomFieldDefinition[]
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
    isMaintenanceMode: false,
    profileRolesEnabled: [],
    socialSettings: {
      profiles: [],
      sharing: [],
    },
    customFieldDefs: [],
    customFields: {},
  })

  const defaultProfiles: SocialProfile[] = [
    { network: 'facebook', label: 'Facebook', icon: 'facebook-f', url: '', enabled: false },
    { network: 'twitter', label: 'X (Twitter)', icon: 'x-twitter', url: '', enabled: false },
    { network: 'linkedin', label: 'LinkedIn', icon: 'linkedin-in', url: '', enabled: false },
    { network: 'instagram', label: 'Instagram', icon: 'instagram', url: '', enabled: false },
    { network: 'youtube', label: 'YouTube', icon: 'youtube', url: '', enabled: false },
  ]

  const defaultSharing: SocialSharing[] = [
    { network: 'facebook', label: 'Facebook', icon: 'facebook-f', enabled: true },
    { network: 'twitter', label: 'X (Twitter)', icon: 'x-twitter', enabled: true },
    { network: 'linkedin', label: 'LinkedIn', icon: 'linkedin-in', enabled: true },
    { network: 'email', label: 'Email', icon: 'envelope', enabled: true },
    { network: 'link', label: 'Copy Link', icon: 'link', enabled: true },
  ]

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
        const j = await res.json().catch(() => ({}))
        if (!alive) return
        
        // Merge fetched social settings with defaults to ensure all networks are present
        const fetchedSocial = j?.data?.socialSettings || {}
        const mergedProfiles = defaultProfiles.map(def => {
          const found = (fetchedSocial.profiles || []).find((p: any) => p.network === def.network)
          return found ? { ...def, ...found } : def
        })
        const mergedSharing = defaultSharing.map(def => {
          const found = (fetchedSocial.sharing || []).find((s: any) => s.network === def.network)
          return found ? { ...def, ...found } : def
        })

        const s: Settings = {
          siteTitle: j?.data?.siteTitle || '',
          defaultMetaDescription: j?.data?.defaultMetaDescription || '',
          faviconMediaId: j?.data?.faviconMediaId || '',
          defaultOgMediaId: j?.data?.defaultOgMediaId || '',
          logoMediaId: j?.data?.logoMediaId || '',
          isMaintenanceMode: !!j?.data?.isMaintenanceMode,
          profileRolesEnabled: Array.isArray(j?.data?.profileRolesEnabled)
            ? j.data.profileRolesEnabled
            : [],
          socialSettings: {
            profiles: mergedProfiles,
            sharing: mergedSharing,
          },
          customFieldDefs: Array.isArray(j?.data?.customFieldDefs) ? j.data.customFieldDefs : [],
          customFields:
            j?.data?.customFields && typeof j.data.customFields === 'object'
              ? j.data.customFields
              : {},
        }
        setForm(s)
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  async function save() {
    try {
      setSaving(true)
      const res = await fetch('/api/site-settings', {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
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
          isMaintenanceMode: form.isMaintenanceMode,
          profileRolesEnabled: form.profileRolesEnabled || [],
          socialSettings: form.socialSettings,
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
      ;(async () => {
        try {
          if (!id) {
            if (alive) {
              setMediaData(null)
              setPreviewUrl(null)
              setPreviewAlt('')
            }
            return
          }
          const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
            credentials: 'same-origin',
          })
          const j = await res.json().catch(() => ({}))
          const baseUrl = j?.data?.url || null
          const alt = j?.data?.alt || j?.data?.originalFilename || ''
          const meta = j?.data?.metadata || {}
          const variants: MediaVariant[] = Array.isArray(meta?.variants) ? meta.variants : []
          const darkSourceUrl =
            typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : undefined
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
                <img
                  src={previewUrl}
                  alt={previewAlt}
                  className="w-full h-full object-cover"
                  key={`${previewUrl}-${isDark}`}
                />
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
              {previewAlt && (
                <div className="text-[11px] text-neutral-low truncate max-w-[240px]">
                  {previewAlt}
                </div>
              )}
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
            <Input
              value={form.siteTitle}
              onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
              placeholder="Site Title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-medium mb-1">
              Default Meta Description
            </label>
            <Textarea
              value={form.defaultMetaDescription || ''}
              onChange={(e) => setForm({ ...form, defaultMetaDescription: e.target.value })}
              rows={3}
              placeholder="Default meta description"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <MediaIdPicker
                label="Favicon"
                value={form.faviconMediaId}
                onChange={(id) => setForm({ ...form, faviconMediaId: id })}
              />
              <p className="text-xs text-neutral-low mt-1">
                Derivatives should include 16x16, 32x32, and 180x180.
              </p>
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
                Recommended SVG/PNG sized for your header. Theme-specific variants can be managed on
                the media item.
              </p>
            </div>
          </div>

          <div className="border-t border-line-low pt-6">
            <h3 className="text-base font-semibold text-neutral-high mb-4">Maintenance Mode</h3>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="maintenance-mode"
                  checked={form.isMaintenanceMode}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, isMaintenanceMode: checked === true })
                  }
                  className="mt-1"
                />
                <div>
                  <label
                    htmlFor="maintenance-mode"
                    className="text-sm font-semibold text-amber-900 dark:text-amber-200 cursor-pointer"
                  >
                    Enable Maintenance Mode
                  </label>
                  <p className="text-xs text-amber-800/70 dark:text-amber-400/70 mt-1">
                    When enabled, public visitors will see a maintenance page. 
                    Administrators and Editors can still access the site and admin panel.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-line-low pt-6">
            <h3 className="text-base font-semibold text-neutral-high mb-4">Social Networks</h3>
            
            <div className="space-y-8">
              {/* Social Profiles */}
              <div>
                <h4 className="text-sm font-medium text-neutral-medium mb-3">Social Profiles</h4>
                <div className="space-y-4">
                  {form.socialSettings?.profiles.map((profile, idx) => (
                    <div key={profile.network} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-line-low rounded-lg bg-backdrop-medium/30">
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <div className="w-8 h-8 rounded bg-backdrop-high flex items-center justify-center text-neutral-medium">
                          <FontAwesomeIcon icon={getIconProp(profile.icon)} />
                        </div>
                        <span className="text-sm font-medium text-neutral-high">{profile.label}</span>
                      </div>
                      
                      <div className="flex-1 w-full sm:w-auto">
                        <Input
                          value={profile.url}
                          onChange={(e) => {
                            const next = [...(form.socialSettings?.profiles || [])]
                            next[idx] = { ...next[idx], url: e.target.value }
                            setForm({ ...form, socialSettings: { ...form.socialSettings!, profiles: next } })
                          }}
                          placeholder="https://..."
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 min-w-[100px]">
                        <Checkbox
                          id={`profile-enable-${profile.network}`}
                          checked={profile.enabled}
                          onCheckedChange={(checked) => {
                            const next = [...(form.socialSettings?.profiles || [])]
                            next[idx] = { ...next[idx], enabled: checked === true }
                            setForm({ ...form, socialSettings: { ...form.socialSettings!, profiles: next } })
                          }}
                        />
                        <label htmlFor={`profile-enable-${profile.network}`} className="text-xs text-neutral-medium cursor-pointer">
                          Enabled
                        </label>
                      </div>

                      <div className="w-24">
                        <Input
                          value={profile.icon}
                          onChange={(e) => {
                            const next = [...(form.socialSettings?.profiles || [])]
                            next[idx] = { ...next[idx], icon: e.target.value }
                            setForm({ ...form, socialSettings: { ...form.socialSettings!, profiles: next } })
                          }}
                          placeholder="Icon name"
                          className="h-8 text-[10px] font-mono"
                          title="FontAwesome icon name"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Social Sharing */}
              <div>
                <h4 className="text-sm font-medium text-neutral-medium mb-3">Social Sharing</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {form.socialSettings?.sharing.map((share, idx) => (
                    <div key={share.network} className="flex items-center justify-between p-3 border border-line-low rounded-lg bg-backdrop-medium/30">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-backdrop-high flex items-center justify-center text-neutral-medium">
                          <FontAwesomeIcon icon={getIconProp(share.icon)} />
                        </div>
                        <span className="text-xs font-medium text-neutral-high">{share.label}</span>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="w-20">
                          <Input
                            value={share.icon}
                            onChange={(e) => {
                              const next = [...(form.socialSettings?.sharing || [])]
                              next[idx] = { ...next[idx], icon: e.target.value }
                              setForm({ ...form, socialSettings: { ...form.socialSettings!, sharing: next } })
                            }}
                            placeholder="Icon"
                            className="h-7 text-[10px] font-mono px-2"
                          />
                        </div>
                        <Checkbox
                          id={`share-enable-${share.network}`}
                          checked={share.enabled}
                          onCheckedChange={(checked) => {
                            const next = [...(form.socialSettings?.sharing || [])]
                            next[idx] = { ...next[idx], enabled: checked === true }
                            setForm({ ...form, socialSettings: { ...form.socialSettings!, sharing: next } })
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-low mt-2">
                  Icons for sharing are FontAwesome icons. Some networks (email, copy link) have special handling.
                </p>
              </div>
            </div>
          </div>

          {/* Site Custom Fields */}
          {Array.isArray(form.customFieldDefs) && form.customFieldDefs.length > 0 && (
            <div className="border-t border-line-low pt-6">
              <h3 className="text-base font-semibold text-neutral-high mb-6">Site Fields</h3>
              <CustomFieldRenderer
                definitions={form.customFieldDefs}
                values={form.customFields || {}}
                onChange={(slug, val) => {
                  setForm((prev) => ({
                    ...prev,
                    customFields: {
                      ...(prev.customFields || {}),
                      [slug]: val,
                    },
                  }))
                }}
              />
            </div>
          )}
          {/* Profiles enablement */}
          <div>
            <label className="block text-sm font-medium text-neutral-medium mb-2">
              Enable Profiles for Roles
            </label>
            <div className="flex flex-wrap gap-3">
              {['admin', 'editor', 'translator'].map((r) => {
                const checked = form.profileRolesEnabled.includes(r)
                return (
                  <label
                    key={r}
                    className="inline-flex items-center gap-2 text-sm text-neutral-high"
                  >
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
            <button
              type="button"
              className={`px-3 py-2 text-sm rounded ${saving ? 'opacity-60' : 'bg-standout-medium text-on-standout'}`}
              disabled={saving}
              onClick={save}
            >
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
