import { useEffect, useState } from 'react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select'
import { toast } from 'sonner'

type Agent = {
  id: string
  name: string
  description: string
  type: string
  openEndedContext: {
    enabled: boolean
    label?: string
    placeholder?: string
    maxChars?: number
  }
  scopes: Array<{
    scope: string
    enabled: boolean
  }>
}

type AISettings = {
  defaultTextProvider: string | null
  defaultTextModel: string | null
  defaultMediaProvider: string | null
  defaultMediaModel: string | null
  options?: any
}

type ProviderModels = Record<string, string[]>

function getXsrf(): string | undefined {
  if (typeof document === 'undefined') return undefined
  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
  return m ? decodeURIComponent(m[1]) : undefined
}

export default function AgentsIndex() {
  const [activeTab, setActiveTab] = useState<'overview' | 'settings'>('overview')

  // Agents State
  const [agents, setAgents] = useState<Agent[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)

  // Settings State
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<AISettings>({
    defaultTextProvider: 'openai',
    defaultTextModel: 'gpt-4o',
    defaultMediaProvider: 'openai',
    defaultMediaModel: 'dall-e-3',
  })
  const [models, setModels] = useState<ProviderModels>({})
  const [providers, setProviders] = useState<string[]>([])

  async function loadAgents() {
    setAgentsLoading(true)
    try {
      // No scope param = returns all agents
      const res = await fetch('/api/agents', { credentials: 'same-origin' })
      const json = await res.json().catch(() => ({}))
      setAgents(Array.isArray(json?.data) ? json.data : [])
    } catch (error) {
      toast.error('Failed to load agents')
    } finally {
      setAgentsLoading(false)
    }
  }

  async function loadSettings() {
    setSettingsLoading(true)
    try {
      const res = await fetch('/api/ai-settings', { credentials: 'same-origin' })
      const j = await res.json().catch(() => ({}))
      if (j.data) {
        setSettings(j.data.settings)
        setModels(j.data.models)
        setProviders(j.data.providers)
      }
    } catch (error) {
      toast.error('Failed to load AI settings')
    } finally {
      setSettingsLoading(false)
    }
  }

  useEffect(() => {
    loadAgents()
    loadSettings()
  }, [])

  async function saveSettings() {
    try {
      setSaving(true)
      const res = await fetch('/api/ai-settings', {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(getXsrf() ? { 'X-XSRF-TOKEN': getXsrf()! } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify(settings),
      })
      if (res.ok) {
        toast.success('AI Settings saved')
      } else {
        const j = await res.json().catch(() => ({}))
        toast.error(j?.error || 'Failed to save')
      }
    } finally {
      setSaving(false)
    }
  }

  const textModels = models[settings.defaultTextProvider || ''] || []
  const mediaModels = models[settings.defaultMediaProvider || ''] || []

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title="Agents" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex border-b border-line-low">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'overview'
                ? 'border-standout-medium text-standout-high'
                : 'border-transparent text-neutral-medium hover:text-neutral-high'
            }`}
          >
            System Agents
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              activeTab === 'settings'
                ? 'border-standout-medium text-standout-high'
                : 'border-transparent text-neutral-medium hover:text-neutral-high'
            }`}
          >
            AI Configuration
          </button>
        </div>

        {activeTab === 'overview' ? (
          <div className="bg-backdrop-low rounded-lg shadow border border-line-low p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-high">Active Agents</h3>
                <p className="text-xs text-neutral-low mt-1">
                  All AI-powered tools currently configured in the system.
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Scopes</TableHead>
                  <TableHead>Context</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentsLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-neutral-low animate-pulse"
                    >
                      Loading agents...
                    </TableCell>
                  </TableRow>
                ) : agents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-neutral-low">
                      No agents found.
                    </TableCell>
                  </TableRow>
                ) : (
                  agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell className="capitalize">{agent.type}</TableCell>
                      <TableCell className="max-w-md text-sm text-neutral-medium">
                        {agent.description}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {agent.scopes.map((s) => (
                            <span
                              key={s.scope}
                              className="text-[10px] bg-backdrop-medium text-neutral-medium px-1.5 py-0.5 rounded border border-line-low"
                            >
                              {s.scope}
                            </span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {agent.openEndedContext.enabled ? (
                          <span className="text-[10px] bg-success-low text-success-high px-1.5 py-0.5 rounded border border-success-medium/20">
                            Open-ended
                          </span>
                        ) : (
                          <span className="text-[10px] bg-backdrop-medium text-neutral-low px-1.5 py-0.5 rounded">
                            Fixed
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-backdrop-low rounded-lg border border-line-low p-6 space-y-8 animate-in fade-in duration-300">
            <section>
              <h3 className="text-lg font-semibold mb-4">Reasoning (Text) Defaults</h3>
              <p className="text-sm text-neutral-medium mb-6">
                Global fallback for agents that do not specify a text provider/model in their config
                file.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-medium">
                    Default Provider
                  </label>
                  <Select
                    value={settings.defaultTextProvider || ''}
                    onValueChange={(val) => {
                      const firstModel = models[val]?.[0] || ''
                      setSettings({
                        ...settings,
                        defaultTextProvider: val,
                        defaultTextModel: firstModel,
                      })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-medium">Default Model</label>
                  <Select
                    value={settings.defaultTextModel || ''}
                    onValueChange={(val) => setSettings({ ...settings, defaultTextModel: val })}
                    disabled={!settings.defaultTextProvider}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {textModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="border-t border-line-low" />

            <section>
              <h3 className="text-lg font-semibold mb-4">Media (Generation) Defaults</h3>
              <p className="text-sm text-neutral-medium mb-6">
                Global fallback for agents that do not specify a media provider/model in their
                config file.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-medium">
                    Default Provider
                  </label>
                  <Select
                    value={settings.defaultMediaProvider || ''}
                    onValueChange={(val) => {
                      const firstModel = models[val]?.[0] || ''
                      setSettings({
                        ...settings,
                        defaultMediaProvider: val,
                        defaultMediaModel: firstModel,
                      })
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-medium">Default Model</label>
                  <Select
                    value={settings.defaultMediaModel || ''}
                    onValueChange={(val) => setSettings({ ...settings, defaultMediaModel: val })}
                    disabled={!settings.defaultMediaProvider}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Model" />
                    </SelectTrigger>
                    <SelectContent>
                      {mediaModels.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="flex items-center gap-3 pt-4 border-t border-line-low">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  saving
                    ? 'bg-standout-medium/50 text-on-standout/50 cursor-not-allowed'
                    : 'bg-standout-medium text-on-standout hover:bg-standout-high active:scale-95 shadow-sm hover:shadow-md'
                }`}
                disabled={saving}
                onClick={saveSettings}
              >
                {saving ? 'Saving…' : 'Save AI Settings'}
              </button>
              {settingsLoading && (
                <span className="text-xs text-neutral-low animate-pulse">
                  Fetching available models…
                </span>
              )}
            </div>
          </div>
        )}
      </main>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
    </div>
  )
}
