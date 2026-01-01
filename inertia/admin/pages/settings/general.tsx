import { useEffect, useState, useMemo } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { useUnsavedChanges } from '~/hooks/useUnsavedChanges'
import { Input } from '../../../components/ui/input'
import { Textarea } from '../../../components/ui/textarea'
import { Checkbox } from '../../../components/ui/checkbox'
import { toast } from 'sonner'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'
import { MediaIdPicker } from '../../components/media/MediaIdPicker'
import { MediaRenderer } from '../../../components/MediaRenderer'
import { CustomFieldRenderer } from '../../components/CustomFieldRenderer'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import type { CustomFieldDefinition } from '~/types/custom_field'
import { FontAwesomeIcon, getIconProp } from '~/site/lib/icons'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select'

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
  faviconMediaId: string | null
  logoMediaId: string | null
  isMaintenanceMode: boolean
  defaultThemeMode: 'light' | 'dark'
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
  const [activeTab, setActiveTab] = useState<
    'general' | 'seo' | 'social' | 'system' | 'fields' | 'announcement' | 'security' | 'privacy'
  >('general')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [initialForm, setInitialForm] = useState<Settings | null>(null)
  const [form, setForm] = useState<Settings>({
    siteTitle: '',
    faviconMediaId: '',
    logoMediaId: '',
    isMaintenanceMode: false,
    defaultThemeMode: 'light',
    profileRolesEnabled: [],
    socialSettings: {
      profiles: [],
      sharing: [],
    },
    customFieldDefs: [],
    customFields: {},
  })

  const isDirty = useMemo(() => {
    if (!initialForm) return false
    // Only compare relevant fields, ignoring internal metadata if any
    return JSON.stringify(form) !== JSON.stringify(initialForm)
  }, [form, initialForm])

  useUnsavedChanges(isDirty)

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
      ; (async () => {
        try {
          setLoading(true)
          const res = await fetch('/api/site-settings', { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          if (!alive) return

          // Merge fetched social settings with defaults to ensure all networks are present
          const fetchedSocial = j?.data?.socialSettings || {}
          const mergedProfiles = defaultProfiles.map((def) => {
            const found = (fetchedSocial.profiles || []).find((p: any) => p.network === def.network)
            return found ? { ...def, ...found } : def
          })
          const mergedSharing = defaultSharing.map((def) => {
            const found = (fetchedSocial.sharing || []).find((s: any) => s.network === def.network)
            return found ? { ...def, ...found } : def
          })

          const s: Settings = {
            siteTitle: j?.data?.siteTitle || '',
            faviconMediaId: j?.data?.faviconMediaId || '',
            logoMediaId: j?.data?.logoMediaId || '',
            isMaintenanceMode: !!j?.data?.isMaintenanceMode,
            defaultThemeMode: j?.data?.defaultThemeMode || 'light',
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
          setInitialForm(JSON.parse(JSON.stringify(s)))
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
          logoMediaId: form.logoMediaId || null,
          faviconMediaId: form.faviconMediaId || null,
          isMaintenanceMode: form.isMaintenanceMode,
          defaultThemeMode: form.defaultThemeMode,
          profileRolesEnabled: form.profileRolesEnabled || [],
          socialSettings: form.socialSettings,
          customFields: form.customFields || {},
        }),
      })
      if (res.ok) {
        toast.success('Settings saved')
        setInitialForm(JSON.parse(JSON.stringify(form)))
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="General Settings" />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="border-b border-line-low mb-6">
          <nav className="flex gap-4 flex-wrap">
            {[
              { id: 'general', label: 'General' },
              {
                id: 'announcement',
                label: 'Announcement',
                hidden: !form.customFieldDefs?.some((f) => f.category === 'Announcement'),
              },
              { id: 'social', label: 'Social' },
              {
                id: 'privacy',
                label: 'Privacy',
                hidden: !form.customFieldDefs?.some((f) => f.category === 'Privacy'),
              },
              {
                id: 'fields',
                label: 'Other Fields',
                hidden: !form.customFieldDefs?.some(
                  (f) => !['Announcement', 'Security', 'Privacy', 'General', 'Contact'].includes(f.category || '')
                ),
              },
              { id: 'system', label: 'System' },
            ]
              .filter((t) => !t.hidden)
              .map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id
                    ? 'border-standout-high text-standout-high'
                    : 'border-transparent text-neutral-medium hover:text-neutral-high'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
          </nav>
        </div>

        <div className="bg-backdrop-low rounded-lg border border-line-low p-6 space-y-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-medium mb-1">
                  Site Title
                </label>
                <Input
                  value={form.siteTitle || ''}
                  onChange={(e) => setForm({ ...form, siteTitle: e.target.value })}
                  placeholder="Site Title"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <MediaIdPicker
                    label="Logo"
                    value={form.logoMediaId}
                    onChange={(id) => setForm({ ...form, logoMediaId: id })}
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Recommended SVG/PNG sized for your header.
                  </p>
                </div>
                <div>
                  <MediaIdPicker
                    label="Favicon"
                    value={form.faviconMediaId}
                    onChange={(id) => setForm({ ...form, faviconMediaId: id })}
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Should include 16x16, 32x32, and 180x180.
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-line-low">
                <CustomFieldRenderer
                  definitions={
                    form.customFieldDefs?.filter((f) => ['General', 'Contact'].includes(f.category || '')) || []
                  }
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
            </div>
          )}

          {activeTab === 'announcement' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-neutral-high">Site Announcement</h3>
              <p className="text-sm text-neutral-low -mt-4">
                Configure the banner displayed at the top of your site pages.
              </p>
              <CustomFieldRenderer
                definitions={form.customFieldDefs?.filter((f) => f.category === 'Announcement') || []}
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

          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-neutral-high">Privacy & Consent</h3>
              <p className="text-sm text-neutral-low -mt-4">
                Manage cookie consent and visitor privacy settings.
              </p>
              <CustomFieldRenderer
                definitions={form.customFieldDefs?.filter((f) => f.category === 'Privacy') || []}
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

          {activeTab === 'fields' && (
            <div className="space-y-6">
              <h3 className="text-base font-semibold text-neutral-high">Miscellaneous Fields</h3>
              <CustomFieldRenderer
                definitions={
                  form.customFieldDefs?.filter(
                    (f) => !['Announcement', 'Security', 'Privacy', 'General', 'Contact'].includes(f.category || '')
                  ) || []
                }
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

          {activeTab === 'social' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-semibold text-neutral-high mb-4">Social Profiles</h3>
                <div className="space-y-4">
                  {form.socialSettings?.profiles.map((profile, idx) => (
                    <div
                      key={profile.network}
                      className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 border border-line-low rounded-lg bg-backdrop-medium/30"
                    >
                      <div className="flex items-center gap-3 min-w-[120px]">
                        <div className="w-8 h-8 rounded bg-backdrop-high flex items-center justify-center text-neutral-medium">
                          <FontAwesomeIcon icon={getIconProp(profile.icon)} />
                        </div>
                        <span className="text-sm font-medium text-neutral-high">
                          {profile.label}
                        </span>
                      </div>

                      <div className="flex-1 w-full sm:w-auto">
                        <Input
                          value={profile.url || ''}
                          onChange={(e) => {
                            const next = [...(form.socialSettings?.profiles || [])]
                            next[idx] = { ...next[idx], url: e.target.value }
                            setForm({
                              ...form,
                              socialSettings: { ...form.socialSettings!, profiles: next },
                            })
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
                            setForm({
                              ...form,
                              socialSettings: { ...form.socialSettings!, profiles: next },
                            })
                          }}
                        />
                        <label
                          htmlFor={`profile-enable-${profile.network}`}
                          className="text-xs text-neutral-medium cursor-pointer"
                        >
                          Enabled
                        </label>
                      </div>

                      <div className="w-24">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Input
                              value={profile.icon || ''}
                              onChange={(e) => {
                                const next = [...(form.socialSettings?.profiles || [])]
                                next[idx] = { ...next[idx], icon: e.target.value }
                                setForm({
                                  ...form,
                                  socialSettings: { ...form.socialSettings!, profiles: next },
                                })
                              }}
                              placeholder="Icon name"
                              className="h-8 text-[10px] font-mono"
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>FontAwesome icon name</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-line-low pt-8">
                <h3 className="text-base font-semibold text-neutral-high mb-4">Social Sharing</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {form.socialSettings?.sharing.map((share, idx) => (
                    <div
                      key={share.network}
                      className="flex items-center justify-between p-3 border border-line-low rounded-lg bg-backdrop-medium/30"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-backdrop-high flex items-center justify-center text-neutral-medium">
                          <FontAwesomeIcon icon={getIconProp(share.icon)} />
                        </div>
                        <span className="text-xs font-medium text-neutral-high">{share.label}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-20">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Input
                                value={share.icon || ''}
                                onChange={(e) => {
                                  const next = [...(form.socialSettings?.sharing || [])]
                                  next[idx] = { ...next[idx], icon: e.target.value }
                                  setForm({
                                    ...form,
                                    socialSettings: { ...form.socialSettings!, sharing: next },
                                  })
                                }}
                                placeholder="Icon"
                                className="h-7 text-[10px] font-mono px-2"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>FontAwesome icon name</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <Checkbox
                          id={`share-enable-${share.network}`}
                          checked={share.enabled}
                          onCheckedChange={(checked) => {
                            const next = [...(form.socialSettings?.sharing || [])]
                            next[idx] = { ...next[idx], enabled: checked === true }
                            setForm({
                              ...form,
                              socialSettings: { ...form.socialSettings!, sharing: next },
                            })
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-low mt-4">
                  Icons for sharing are FontAwesome icons.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'system' && (
            <div className="space-y-8">
              <div>
                <h3 className="text-base font-semibold text-neutral-high mb-4">Appearance</h3>
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-neutral-medium mb-2">
                    Default Theme Mode
                  </label>
                  <Select
                    value={form.defaultThemeMode}
                    onValueChange={(val: 'light' | 'dark') =>
                      setForm({ ...form, defaultThemeMode: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select default theme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light Mode</SelectItem>
                      <SelectItem value="dark">Dark Mode</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-neutral-low mt-2">
                    This mode will be used if the visitor hasn't set a preference.
                  </p>
                </div>
              </div>

              <div className="border-t border-line-low pt-8">
                <h3 className="text-base font-semibold text-neutral-high mb-4">
                  Maintenance Mode
                </h3>
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
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-6 border-t border-line-low">
            <button
              type="button"
              className={`px-3 py-2 text-sm rounded ${saving ? 'opacity-60' : 'bg-standout-high text-on-high'}`}
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
