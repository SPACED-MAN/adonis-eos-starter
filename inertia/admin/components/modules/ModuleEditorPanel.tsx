import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { LexicalEditor } from '../LexicalEditor'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover'
import { Checkbox } from '~/components/ui/checkbox'
import { Slider } from '~/components/ui/slider'
import { Calendar } from '~/components/ui/calendar'
import { Input } from '~/components/ui/input'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '~/components/ui/select'
import { FormField } from '~/components/forms/field'
import { LabelWithDescription } from '~/components/forms/LabelWithDescription'
import { LinkField, type LinkFieldValue } from '~/components/forms/LinkField'
import { MediaPickerModal } from '../media/MediaPickerModal'
import { MediaRenderer } from '../../../components/MediaRenderer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { iconOptions, iconMap } from '../ui/iconOptions'
import { AgentModal, type Agent } from '../agents/AgentModal'
import { CustomFieldDefinition } from '~/types/custom_field'
import { type MediaVariant } from '~/lib/media'
import { TokenField } from '../ui/TokenField'

// Utilities for object manipulation
function getByPath(obj: any, path: string): any {
  if (!path) return undefined
  const parts = path.split('.')
  let curr = obj
  for (const p of parts) {
    if (curr === null || curr === undefined) return undefined
    curr = curr[p]
  }
  return curr
}

function setByPath(obj: any, path: string, value: any) {
  if (!path) return
  const parts = path.split('.')
  let curr = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (curr[p] === undefined || curr[p] === null || typeof curr[p] !== 'object') {
      curr[p] = {}
    }
    curr = curr[p]
  }
  curr[parts[parts.length - 1]] = value
}

function isPlainObject(val: any): val is Record<string, any> {
  return val !== null && typeof val === 'object' && !Array.isArray(val)
}

function mergeFields(
  props: Record<string, any>,
  overrides: Record<string, any> | null
): Record<string, any> {
  const next = JSON.parse(JSON.stringify(props || {}))
  if (!overrides) return next
  Object.keys(overrides).forEach((key) => {
    const val = overrides[key]
    if (isPlainObject(val) && isPlainObject(next[key])) {
      next[key] = mergeFields(next[key], val)
    } else {
      next[key] = val
    }
  })
  return next
}

function diffOverrides(
  base: Record<string, any>,
  edited: Record<string, any>
): Record<string, any> | null {
  const overrides: Record<string, any> = {}
  let changed = false
  Object.keys(edited).forEach((key) => {
    const b = base[key]
    const e = edited[key]
    if (isPlainObject(e) && (isPlainObject(b) || b === undefined)) {
      const sub = diffOverrides(b || {}, e)
      if (sub) {
        overrides[key] = sub
        changed = true
      }
    } else if (JSON.stringify(b) !== JSON.stringify(e)) {
      overrides[key] = e
      changed = true
    }
  })
  return changed ? overrides : null
}

function getLabel(path: string[], field: CustomFieldDefinition): string {
  if (field.label) return field.label
  const last = path[path.length - 1]
  if (!last) return ''
  return last
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

export interface ModuleListItem {
  id: string
  moduleInstanceId: string
  type: string
  scope: string
  props: Record<string, any>
  overrides: Record<string, any> | null
  locked: boolean
  orderIndex: number
  globalSlug?: string | null
  adminLabel?: string | null
}

const moduleSchemaCache = new Map<
  string,
  { schema: CustomFieldDefinition[] | null; label: string | null }
>()

export async function prefetchModuleSchemas(moduleTypes: string[]): Promise<void> {
  const unique = Array.from(new Set(moduleTypes.filter(Boolean)))
  const missing = unique.filter((t) => !moduleSchemaCache.has(t))
  if (missing.length === 0) return

  await Promise.allSettled(
    missing.map(async (type) => {
      try {
        const res = await fetch(`/api/modules/${encodeURIComponent(type)}/schema`, {
          credentials: 'same-origin',
        })
        const json = await res.json().catch(() => null)
        const ps =
          json?.data?.fieldSchema ||
          json?.fieldSchema ||
          json?.data?.propsSchema ||
          json?.propsSchema ||
          (json?.data?.schema
            ? json?.data?.schema?.fieldSchema || json?.data?.schema?.propsSchema
            : null) ||
          null
        const friendlyName: string | null =
          (json?.data && (json.data.name as string | undefined)) ||
          (json && (json.name as string | undefined)) ||
          null
        if (ps && typeof ps === 'object') {
          const fields: CustomFieldDefinition[] = Object.keys(ps).map((k) => {
            const def = (ps as any)[k] || {}
            return { slug: k, ...(def || {}) }
          })
          moduleSchemaCache.set(type, { schema: fields, label: friendlyName || type })
        } else {
          moduleSchemaCache.set(type, { schema: null, label: friendlyName || type })
        }
      } catch {
        moduleSchemaCache.set(type, { schema: null, label: type })
      }
    })
  )
}

type EditorFieldCtx = {
  latestDraft: React.MutableRefObject<Record<string, any>>
  setDraft: React.Dispatch<React.SetStateAction<Record<string, any>>>
  fieldComponents: Record<string, any>
  supportedFieldTypes: Set<string>
  pascalFromType: (t?: string | null) => string
  setByPath: (obj: any, path: string, value: any) => void
  getLabel: (path: string[], field: CustomFieldDefinition) => string
  syncFormToDraft: () => Record<string, any>
  getByPath: (obj: any, path: string) => any
  formRef: React.RefObject<HTMLFormElement | HTMLDivElement | null>
  postId?: string
  moduleInstanceId?: string
  moduleType?: string
  moduleItem?: ModuleListItem | null
  fieldAgents: Agent[]
  setSelectedFieldAgent: (agent: Agent | null) => void
  setAgentModalOpen: (open: boolean) => void
  setAgentFieldKey: (key: string) => void
  setAgentFieldType: (type: string) => void
  viewMode?: 'source' | 'review' | 'ai-review'
  customFields: Array<{ slug: string; label: string }>
  onDirty?: () => void
  pendingInputValueRef?: React.MutableRefObject<{
    name: string
    value: string
    rootId: string
    cursorPos: number
  } | null>
}

// --------------------------------------------------------------------------
// Global cache for media metadata
// --------------------------------------------------------------------------
const mediaMetadataCache = new Map<string, any>()
const mediaMetadataLoading = new Map<string, Promise<any>>()
const mediaMetadata404 = new Set<string>()

const AgentTrigger = ({ agents, onSelect }: { agents: Agent[]; onSelect: (a: Agent) => void }) => {
  if (agents.length === 0) return null
  if (agents.length === 1) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelect(agents[0])}
            className="text-neutral-low hover:text-standout-medium transition-colors"
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} size="sm" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Run AI Agent: {agents[0].name}</p>
        </TooltipContent>
      </Tooltip>
    )
  }
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-neutral-low hover:text-standout-medium transition-colors"
            >
              <FontAwesomeIcon icon={faWandMagicSparkles} size="sm" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p>Run AI Agent</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-48 p-2">
        <div className="text-[10px] font-bold text-neutral-medium uppercase mb-2 px-2">
          Run AI Agent
        </div>
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-backdrop-medium text-neutral-high transition-colors"
          >
            {agent.name}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

const DateFieldInternal = memo(
  ({
    name,
    label,
    rootId,
    hideLabel,
    initial,
    ctx,
    field,
    matchingAgents = [],
  }: {
    name: string
    label: string
    rootId: string
    hideLabel: boolean
    initial: string
    ctx: EditorFieldCtx
    field?: CustomFieldDefinition
    matchingAgents?: Agent[]
  }) => {
    const initialDate = initial ? new Date(initial) : null
    const [selected, setSelected] = useState<Date | null>(initialDate)
    const hiddenRef = useRef<HTMLInputElement | null>(null)

    function formatDate(d: Date | null) {
      if (!d) return ''
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${da}`
    }

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={(field as any)?.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              ctx.setSelectedFieldAgent(agent)
              ctx.setAgentFieldKey(name)
              ctx.setAgentFieldType('date')
              ctx.setAgentModalOpen(true)
            }}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
            >
              {selected ? formatDate(selected) : 'Pick a date'}
            </button>
          </PopoverTrigger>
          <PopoverContent>
            <Calendar
              mode="single"
              selected={selected || undefined}
              onSelect={(d: Date | undefined) => {
                const val = d || null
                setSelected(val)
                const next = { ...(ctx.latestDraft.current || {}) }
                setByPath(next, name, formatDate(val))
                ctx.setDraft(next)
                ctx.onDirty?.()
                if (hiddenRef.current) {
                  hiddenRef.current.value = formatDate(val)
                  hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                  hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                }
              }}
            />
          </PopoverContent>
        </Popover>
        <input
          type="hidden"
          name={name}
          ref={hiddenRef}
          defaultValue={initial}
          data-root-id={rootId}
        />
      </FormField>
    )
  }
)

const SliderFieldInternal = memo(
  ({
    name,
    label,
    value,
    rootId,
    hideLabel,
    field,
    ctx,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    rootId: string
    hideLabel: boolean
    field: any
    ctx: EditorFieldCtx
    matchingAgents?: Agent[]
  }) => {
    const min = field.min ?? 0
    const max = field.max ?? 100
    const step = field.step ?? 1
    const unit = field.unit ?? ''
    const current = typeof value === 'number' ? value : min
    const [val, setVal] = useState<number>(current)
    const hiddenRef = useRef<HTMLInputElement | null>(null)

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={(field as any)?.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              ctx.setSelectedFieldAgent(agent)
              ctx.setAgentFieldKey(name)
              ctx.setAgentFieldType('slider')
              ctx.setAgentModalOpen(true)
            }}
          />
        </div>
        <Slider
          defaultValue={[current]}
          min={min}
          max={max}
          step={step}
          onValueChange={(v) => {
            const n = Array.isArray(v) ? (v[0] ?? min) : min
            setVal(n)
            const next = { ...(ctx.latestDraft.current || {}) }
            setByPath(next, name, n)
            ctx.setDraft(next)
            ctx.onDirty?.()
            if (hiddenRef.current) {
              hiddenRef.current.value = String(n)
              hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
              hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }}
        />
        <div className="mt-1 text-xs text-neutral-medium">
          {val}
          {unit} (min {min}, max {max}, step {step})
        </div>
        <input
          type="hidden"
          name={name}
          ref={hiddenRef}
          defaultValue={String(current)}
          data-number="1"
          data-root-id={rootId}
        />
      </FormField>
    )
  }
)

const MediaFieldInternal = memo(
  ({
    name,
    label,
    value,
    hideLabel,
    field,
    ctx,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    hideLabel: boolean
    field: any
    ctx: EditorFieldCtx
    matchingAgents?: Agent[]
  }) => {
    type ModalMediaItem = {
      id: string
      url: string
      mimeType?: string
      originalFilename?: string
      alt?: string | null
      metadata?: any
    }
    const storeAsId =
      field.storeAs === 'id' ||
      field.store === 'id' ||
      field.config?.storeAs === 'id' ||
      field.config?.store === 'id'
    const [modalOpen, setModalOpen] = useState(false)
    const [agentModalOpen, setAgentModalOpen] = useState(false)
    const [selectedFieldAgent, setSelectedFieldAgent] = useState<Agent | null>(null)
    const [preSelectedMediaId, setPreSelectedMediaId] = useState<string | null>(null)
    const hiddenRef = useRef<HTMLInputElement | null>(null)
    const currentVal = typeof value === 'string' ? value : value?.id || ''
    const [preview, setPreview] = useState<ModalMediaItem | null>(null)

    const [mediaData, setMediaData] = useState<{
      baseUrl: string
      mimeType?: string
      variants: MediaVariant[]
      darkSourceUrl?: string
      playMode?: 'autoplay' | 'inline' | 'modal'
    } | null>(null)
    const [localPlayMode, setLocalPlayMode] = useState<'autoplay' | 'inline' | 'modal'>('autoplay')

    useEffect(() => {
      if (
        !storeAsId ||
        !currentVal ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentVal)
      ) {
        if (!storeAsId && typeof value === 'string' && value) {
          setPreview({ id: '', url: value, originalFilename: value, alt: null })
        } else {
          setPreview(null)
        }
        setMediaData(null)
        return
      }

      if (mediaMetadata404.has(currentVal)) {
        setPreview(null)
        setMediaData(null)
        return
      }

      if (mediaMetadataCache.has(currentVal)) {
        const data = mediaMetadataCache.get(currentVal)
        setPreview(data.item)
        setMediaData(data.mediaData)
        setLocalPlayMode(data.mediaData.playMode || 'autoplay')
        return
      }

      let alive = true
        ; (async () => {
          try {
            let promise = mediaMetadataLoading.get(currentVal)
            if (!promise) {
              promise = fetch(`/api/media/${encodeURIComponent(currentVal)}`, {
                credentials: 'same-origin',
              }).then((res) => {
                if (res.status === 404) {
                  mediaMetadata404.add(currentVal)
                  throw new Error('404')
                }
                return res.json()
              })
              mediaMetadataLoading.set(currentVal, promise)
            }

            const j = await promise
            if (!j?.data) throw new Error('No data')

            const item: ModalMediaItem = {
              id: j.data.id,
              url: j.data.url,
              mimeType: j.data.mimeType,
              originalFilename: j.data.originalFilename,
              alt: j.data.alt,
              metadata: j.data.metadata,
            }
            const meta = j.data.metadata || {}
            const variants: MediaVariant[] = Array.isArray(meta?.variants) ? meta.variants : []
            const darkSourceUrl =
              typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : undefined
            const playMode = meta.playMode || 'autoplay'
            const mData = {
              baseUrl: j.data.url,
              mimeType: j.data.mimeType,
              variants,
              darkSourceUrl,
              playMode,
            }

            mediaMetadataCache.set(currentVal, { item, mediaData: mData })
            mediaMetadataLoading.delete(currentVal)

            if (alive) {
              setPreview(item)
              setMediaData(mData)
              setLocalPlayMode(playMode)
              ctx.setDraft((prev) => ({ ...prev }))
            }
          } catch {
            mediaMetadataLoading.delete(currentVal)
            if (alive) {
              setPreview(null)
              setMediaData(null)
            }
          }
        })()
      return () => {
        alive = false
      }
    }, [storeAsId, currentVal])

    const xsrfFromCookie = useMemo(() => {
      if (typeof document === 'undefined') return undefined
      const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
      return m ? decodeURIComponent(m[1]) : undefined
    }, [])

    async function updateMediaPlayMode(val: 'autoplay' | 'inline' | 'modal') {
      setLocalPlayMode(val)
      if (!preview?.id) return
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(preview.id)}`, {
          method: 'PATCH',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ playMode: val }),
        })
        if (!res.ok) throw new Error('Failed to update')

        const cached = mediaMetadataCache.get(preview.id)
        if (cached) {
          cached.mediaData.playMode = val
          mediaMetadataCache.set(preview.id, cached)
        }
        toast.success('Video play mode saved')
        ctx.setDraft((prev) => ({ ...prev }))
        if (ctx.onDirty) ctx.onDirty()
      } catch {
        toast.error('Failed to save play mode')
      }
    }

    function applySelection(m: ModalMediaItem) {
      if (hiddenRef.current) {
        hiddenRef.current.value = storeAsId ? m.id : m.url
        hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
        hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
      }
      ctx.setDraft((prev) => {
        const next = { ...(prev || {}) }
        setByPath(next, name, storeAsId ? m.id : m.url)
        return next
      })
      if (ctx.onDirty) ctx.onDirty()
      setPreview({
        id: m.id,
        url: m.url,
        mimeType: m.mimeType,
        originalFilename: m.originalFilename,
        alt: m.alt,
        metadata: m.metadata,
      })
    }

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={field.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              setSelectedFieldAgent(agent)
              setAgentModalOpen(true)
            }}
          />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-4 bg-backdrop-medium p-3 rounded-lg border border-line-low min-h-[100px]">
            <div className="relative w-20 h-20 rounded bg-backdrop-low dark:bg-backdrop-medium border border-line-low overflow-hidden flex items-center justify-center">
              {/* Subtle checkerboard for transparency awareness */}
              <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uAnRowBoEMBAQQWBgZAiM0E0DAAwiAsQD8LYYByDMc8EBIAVScG6S+69Z0AAAAASUVORK5CYII=")`,
                  backgroundSize: '8px 8px',
                }}
              />
              {preview ? (
                <MediaRenderer
                  image={preview}
                  alt={preview.alt}
                  className="w-full h-full object-cover relative z-10"
                />
              ) : (
                <span className="text-[10px] text-neutral-low text-center p-1 relative z-10">
                  No media
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2 flex-1 min-w-[120px]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 text-[11px] font-semibold rounded bg-standout-medium text-on-high hover:bg-standout-high transition-colors"
                  onClick={() => setModalOpen(true)}
                >
                  {preview ? 'Change Media' : 'Select Media'}
                </button>
                {preview && (
                  <button
                    type="button"
                    className="px-3 py-1.5 text-[11px] font-semibold rounded border border-line-medium text-neutral-high hover:bg-backdrop-medium transition-colors"
                    onClick={() => {
                      if (hiddenRef.current) {
                        hiddenRef.current.value = ''
                        hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                        hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                      }
                      ctx.setDraft((prev) => {
                        const next = { ...(prev || {}) }
                        setByPath(next, name, null)
                        return next
                      })
                      if (ctx.onDirty) ctx.onDirty()
                      setPreview(null)
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              {preview && (
                <div className="text-[11px] text-neutral-low truncate max-w-[240px]">
                  {(preview.alt || preview.originalFilename || '').toString()}
                </div>
              )}
            </div>
            {(() => {
              const isVideo =
                mediaData?.mimeType?.startsWith('video/') ||
                preview?.url?.toLowerCase().endsWith('.mp4') ||
                preview?.url?.toLowerCase().endsWith('.webm') ||
                preview?.url?.toLowerCase().endsWith('.ogg')

              if (!isVideo) return null

              return (
                <div className="mt-3 space-y-1">
                  <label className="text-[11px] font-medium text-neutral-medium">
                    Play Mode (Media Field)
                  </label>
                  <Select value={localPlayMode} onValueChange={(v: any) => updateMediaPlayMode(v)}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select play mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="autoplay">Inline (Auto-loop)</SelectItem>
                      <SelectItem value="inline">Inline (With Controls)</SelectItem>
                      <SelectItem value="modal">Open in Modal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            })()}
          </div>
          <MediaPickerModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            initialSelectedId={preSelectedMediaId || currentVal || undefined}
            onSelect={(m) => {
              applySelection(m as ModalMediaItem)
              setPreSelectedMediaId(null)
            }}
          />
          {selectedFieldAgent && (
            <AgentModal
              open={agentModalOpen}
              onOpenChange={setAgentModalOpen}
              agent={selectedFieldAgent}
              contextId={ctx.postId}
              context={{
                scope: 'field',
                fieldKey: name,
                fieldType: 'media',
                moduleInstanceId: ctx.moduleInstanceId,
              }}
              scope="field"
              fieldKey={name}
              fieldType="media"
              viewMode={ctx.viewMode}
              onSuccess={(response) => {
                setAgentModalOpen(false)
                setSelectedFieldAgent(null)
                if (response.generatedMediaId && storeAsId) {
                  setTimeout(() => {
                    setPreSelectedMediaId(response.generatedMediaId!)
                    setModalOpen(true)
                  }, 100)
                }
              }}
            />
          )}
        </div>
        <input
          type="hidden"
          name={name}
          ref={hiddenRef}
          defaultValue={currentVal}
          data-root-id={ctx.moduleItem?.id || ''}
        />
      </FormField>
    )
  }
)

const IconFieldInternal = memo(
  ({
    name,
    label,
    value,
    rootId,
    hideLabel,
    ctx,
    field,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    rootId: string
    hideLabel: boolean
    ctx: EditorFieldCtx
    field?: CustomFieldDefinition
    matchingAgents?: Agent[]
  }) => {
    const initial = typeof value === 'string' ? value : ''
    const [selectedIcon, setSelectedIcon] = useState<string>(initial)
    const [pickerOpen, setPickerOpen] = useState(false)
    const hiddenRef = useRef<HTMLInputElement | null>(null)

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={(field as any)?.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              ctx.setSelectedFieldAgent(agent)
              ctx.setAgentFieldKey(name)
              ctx.setAgentFieldType('icon')
              ctx.setAgentModalOpen(true)
            }}
          />
        </div>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium flex items-center gap-2"
            >
              {selectedIcon && iconMap[selectedIcon] ? (
                <>
                  <FontAwesomeIcon icon={iconMap[selectedIcon]} size="sm" />
                  <span>{selectedIcon}</span>
                </>
              ) : (
                <span className="text-neutral-low">Select an icon</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-96">
            <div className="grid grid-cols-4 gap-2 max-h-96 overflow-auto">
              {iconOptions.map((iconItem) => (
                <Tooltip key={iconItem.name}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`p-3 border rounded-lg hover:bg-backdrop-medium flex flex-col items-center gap-1 ${selectedIcon === iconItem.name
                        ? 'border-standout-medium bg-standout-medium/10'
                        : 'border-line-low'
                        }`}
                      onClick={() => {
                        setSelectedIcon(iconItem.name)
                        if (hiddenRef.current) {
                          hiddenRef.current.value = iconItem.name
                          hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                          hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
                        }
                        ctx.setDraft((prev) => {
                          const next = { ...(prev || {}) }
                          setByPath(next, name, iconItem.name)
                          return next
                        })
                        ctx.onDirty?.()
                        setPickerOpen(false)
                      }}
                    >
                      <FontAwesomeIcon icon={iconItem.icon} size="xl" />
                      <span className="text-[10px] text-neutral-low truncate w-full text-center">
                        {iconItem.label}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{iconItem.label}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <input
          type="hidden"
          name={name}
          ref={hiddenRef}
          defaultValue={initial}
          data-root-id={rootId}
        />
      </FormField>
    )
  }
)

const PostReferenceFieldInternal = memo(
  ({
    name,
    label,
    value,
    rootId,
    hideLabel,
    field,
    ctx,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    rootId: string
    hideLabel: boolean
    field: any
    ctx: EditorFieldCtx
    matchingAgents?: Agent[]
  }) => {
    const allowedTypes: string[] = Array.isArray(field.postTypes)
      ? field.postTypes
      : field.postType
        ? [String(field.postType)]
        : []

    const allowMultiple = field.allowMultiple !== false && field.multiple !== false

    const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
    const initialVals = Array.isArray(value) ? value : value ? [String(value)] : []
    const [vals, setVals] = useState<string[]>(initialVals)
    const [query, setQuery] = useState('')
    const hiddenRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
      if (hiddenRef.current) {
        const nextVal = allowMultiple ? JSON.stringify(vals) : (vals[0] ?? '')
        if (hiddenRef.current.value !== nextVal) {
          hiddenRef.current.value = nextVal
          hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
          hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))

          const next = { ...(ctx.latestDraft.current || {}) }
          setByPath(next, name, allowMultiple ? vals : (vals[0] ?? null))
          ctx.setDraft(next)
          ctx.onDirty?.()
        }
      }
    }, [vals, allowMultiple])

    useEffect(() => {
      let alive = true
        ; (async () => {
          try {
            const params = new URLSearchParams()
            params.set('limit', '100')
            params.set('sortBy', 'updated_at')
            params.set('sortOrder', 'desc')
            if (allowedTypes.length > 0) params.set('types', allowedTypes.join(','))
            const r = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
            const j = await r.json().catch(() => ({}))
            if (alive)
              setOptions((j?.data || []).map((p: any) => ({ label: p.title || p.id, value: p.id })))
          } catch {
            if (alive) setOptions([])
          }
        })()
      return () => {
        alive = false
      }
    }, [allowedTypes.join(',')])

    const filteredOptions =
      query.trim() === ''
        ? options
        : options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={(field as any)?.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              ctx.setSelectedFieldAgent(agent)
              ctx.setAgentModalOpen(true)
            }}
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
            >
              {vals.length === 0 ? 'Select posts' : `${vals.length} selected`}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="Search posts..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="max-h-64 overflow-auto space-y-2">
                {filteredOptions.length === 0 ? (
                  <div className="text-xs text-neutral-low">No posts found.</div>
                ) : (
                  filteredOptions.map((opt) => (
                    <label
                      key={opt.value}
                      className="flex items-center gap-2 cursor-pointer hover:bg-backdrop-medium p-1 rounded"
                    >
                      <Checkbox
                        checked={vals.includes(opt.value)}
                        onCheckedChange={(c) => {
                          setVals((prev) => {
                            if (allowMultiple) {
                              const next = new Set(prev)
                              if (c) next.add(opt.value)
                              else next.delete(opt.value)
                              return Array.from(next)
                            }
                            return c ? [opt.value] : []
                          })
                        }}
                      />
                      <span className="text-sm">{opt.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <input
          type="hidden"
          name={name}
          ref={hiddenRef}
          defaultValue={allowMultiple ? JSON.stringify(initialVals) : (initialVals[0] ?? '')}
          data-json={allowMultiple ? '1' : undefined}
          data-root-id={rootId}
        />
      </FormField>
    )
  }
)

const FormReferenceFieldInternal = memo(
  ({
    name,
    label,
    value,
    rootId,
    hideLabel,
    field,
    ctx,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    rootId: string
    hideLabel: boolean
    field: any
    ctx: EditorFieldCtx
    matchingAgents?: Agent[]
  }) => {
    const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
    const initial = typeof value === 'string' ? value : ''
    const [current, setCurrent] = useState<string>(initial)
    const hiddenRef = useRef<HTMLInputElement | null>(null)

    useEffect(() => {
      let alive = true
        ; (async () => {
          try {
            const res = await fetch('/api/forms-definitions', { credentials: 'same-origin' })
            const j = await res.json().catch(() => ({}))
            if (alive)
              setOptions(
                (j?.data || []).map((f: any) => ({ value: String(f.slug), label: f.title || f.slug }))
              )
          } catch {
            if (alive) setOptions([])
          }
        })()
      return () => {
        alive = false
      }
    }, [])

    useEffect(() => {
      if (hiddenRef.current) {
        if (hiddenRef.current.value !== (current || '')) {
          hiddenRef.current.value = current || ''
          hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
          hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))

          const next = { ...(ctx.latestDraft.current || {}) }
          setByPath(next, name, current || null)
          ctx.setDraft(next)
          ctx.onDirty?.()
        }
      }
    }, [current])

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={(field as any)?.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              ctx.setSelectedFieldAgent(agent)
              ctx.setAgentFieldKey(name)
              ctx.setAgentFieldType('form-reference')
              ctx.setAgentModalOpen(true)
            }}
          />
        </div>
        <Select defaultValue={initial || undefined} onValueChange={setCurrent}>
          <SelectTrigger>
            <SelectValue placeholder="Select a form" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          type="hidden"
          name={name}
          defaultValue={initial}
          ref={hiddenRef}
          data-root-id={rootId}
        />
      </FormField>
    )
  }
)

const SelectFieldInternal = memo(
  ({
    name,
    label,
    value,
    rootId,
    hideLabel,
    field,
    type,
    ctx,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    rootId: string
    hideLabel: boolean
    field: any
    type: string
    ctx: EditorFieldCtx
    matchingAgents?: Agent[]
  }) => {
    const isMulti = type === 'multiselect'
    const [dynamicOptions, setDynamicOptions] = useState<Array<{ label: string; value: string }>>(
      Array.isArray(field.options) ? field.options : []
    )
    const optionsSource = field.optionsSource as string | undefined

    useEffect(() => {
      let alive = true
        ; (async () => {
          try {
            if (dynamicOptions.length === 0 && optionsSource === 'post-types') {
              const r = await fetch('/api/post-types', { credentials: 'same-origin' })
              const j = await r.json().catch(() => ({}))
              if (alive)
                setDynamicOptions((j?.data || []).map((t: string) => ({ label: t, value: t })))
            }
          } catch { }
        })()
      return () => {
        alive = false
      }
    }, [optionsSource, dynamicOptions.length])

    if (!isMulti) {
      const initial = typeof value === 'string' ? value : ''
      const hiddenRef = useRef<HTMLInputElement | null>(null)
      return (
        <FormField className="group">
          <div className="flex items-center justify-between">
            <LabelWithDescription
              label={label}
              description={(field as any)?.description}
              hideLabel={hideLabel}
            />
            <AgentTrigger
              agents={matchingAgents}
              onSelect={(agent) => {
                ctx.setSelectedFieldAgent(agent)
                ctx.setAgentFieldKey(name)
                ctx.setAgentFieldType(type)
                ctx.setAgentModalOpen(true)
              }}
            />
          </div>
          <Select
            defaultValue={initial || undefined}
            onValueChange={(val) => {
              if (hiddenRef.current) {
                hiddenRef.current.value = val ?? ''
                hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))

                const next = { ...(ctx.latestDraft.current || {}) }
                setByPath(next, name, val || null)
                ctx.setDraft(next)
                ctx.onDirty?.()
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {dynamicOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label ?? opt.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            type="hidden"
            name={name}
            defaultValue={initial}
            ref={hiddenRef}
            data-root-id={rootId}
          />
        </FormField>
      )
    } else {
      const initial = Array.isArray(value) ? value : []
      const [vals, setVals] = useState<string[]>(initial)
      const hiddenRef = useRef<HTMLInputElement | null>(null)

      useEffect(() => {
        if (hiddenRef.current) {
          const nextVal = JSON.stringify(vals)
          if (hiddenRef.current.value !== nextVal) {
            hiddenRef.current.value = nextVal
            hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
            hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))

            const next = { ...(ctx.latestDraft.current || {}) }
            setByPath(next, name, vals)
            ctx.setDraft(next)
            ctx.onDirty?.()
          }
        }
      }, [vals])

      return (
        <FormField className="group">
          <div className="flex items-center justify-between">
            <LabelWithDescription
              label={label}
              description={(field as any)?.description}
              hideLabel={hideLabel}
            />
            <AgentTrigger
              agents={matchingAgents}
              onSelect={(agent) => {
                ctx.setSelectedFieldAgent(agent)
                ctx.setAgentFieldKey(name)
                ctx.setAgentFieldType(type)
                ctx.setAgentModalOpen(true)
              }}
            />
          </div>
          <div className="space-y-2 border border-border rounded-lg p-3 bg-backdrop-low">
            {dynamicOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-2 cursor-pointer hover:bg-backdrop-medium p-1 rounded"
              >
                <Checkbox
                  checked={vals.includes(opt.value)}
                  onCheckedChange={(c) => {
                    setVals((prev) => {
                      const next = new Set(prev)
                      if (c) next.add(opt.value)
                      else next.delete(opt.value)
                      return Array.from(next)
                    })
                  }}
                />
                <span className="text-sm">{opt.label ?? opt.value}</span>
              </label>
            ))}
          </div>
          <input
            type="hidden"
            name={name}
            defaultValue={JSON.stringify(initial)}
            ref={hiddenRef}
            data-json="1"
            data-root-id={rootId}
          />
        </FormField>
      )
    }
  }
)

const BooleanFieldInternal = memo(
  ({
    name,
    label,
    value,
    rootId,
    ctx,
    matchingAgents = [],
  }: {
    name: string
    label: string
    value: any
    rootId: string
    ctx: EditorFieldCtx
    matchingAgents?: Agent[]
  }) => {
    const initial = !!value
    const [checked, setChecked] = useState(initial)
    const hiddenRef = useRef<HTMLInputElement | null>(null)

    return (
      <FormField className="flex items-center gap-3">
        <Checkbox
          checked={checked}
          onCheckedChange={(c) => {
            const v = !!c
            setChecked(v)
            const next = { ...(ctx.latestDraft.current || {}) }
            setByPath(next, name, v)
            ctx.setDraft(next)
            ctx.onDirty?.()
            if (hiddenRef.current) {
              hiddenRef.current.value = v ? 'true' : 'false'
              hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
              hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
            }
          }}
        />
        <LabelWithDescription label={label} />
        <AgentTrigger
          agents={matchingAgents}
          onSelect={(agent) => {
            ctx.setSelectedFieldAgent(agent)
            ctx.setAgentFieldKey(name)
            ctx.setAgentFieldType('boolean')
            ctx.setAgentModalOpen(true)
          }}
        />
        <input
          type="hidden"
          name={name}
          ref={hiddenRef}
          defaultValue={initial ? 'true' : 'false'}
          data-bool="1"
          data-root-id={rootId}
        />
      </FormField>
    )
  }
)

const FieldPrimitiveInternal = memo(
  ({
    path,
    field,
    value,
    rootId,
    ctx,
  }: {
    path: string[]
    field: CustomFieldDefinition
    value: any
    rootId: string
    ctx: EditorFieldCtx
  }) => {
    const name = path.join('.')
    const hideLabel = (field as any).hideLabel === true
    const label = hideLabel ? '' : getLabel(path, field)
    const type = (field as any).type as string

    const matchingAgents = useMemo(() => {
      return ctx.fieldAgents.filter((agent: any) => {
        return agent.scopes?.some((scope: any) => {
          if (scope.scope !== 'field' || !scope.enabled) return false
          if (Array.isArray(scope.fieldTypes) && scope.fieldTypes.length > 0) {
            return scope.fieldTypes.includes(type)
          }
          return true
        })
      })
    }, [ctx.fieldAgents, type])

    const maybeRenderComponent = () => {
      const compName = `${ctx.pascalFromType(type)}Field`
      const Renderer = (ctx.fieldComponents as Record<string, any>)[compName]
      if (!Renderer || !ctx.supportedFieldTypes.has(type)) return null

      const hiddenRef = useRef<HTMLInputElement | null>(null)
      const cfg = field as any
      const handleChange = (val: any) => {
        try {
          const next = { ...(ctx.latestDraft.current || {}) }
          setByPath(next, name, val)
          ctx.setDraft(next)
          ctx.onDirty?.()
        } catch { }
        if (hiddenRef.current) {
          if (val === null || val === undefined) hiddenRef.current.value = ''
          else if (typeof val === 'object') hiddenRef.current.value = JSON.stringify(val)
          else hiddenRef.current.value = String(val)
          hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
          hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }

      const {
        type: _t,
        name: _n,
        label: _l,
        hideLabel: _hl,
        required: _r,
        translatable: _tr,
        fields: _f,
        item: _i,
        validation: _v,
        optionsSource: _os,
        store: _s,
        storeAs: _sa,
        placeholder: _p,
        min: _min,
        max: _max,
        step: _step,
        unit: _u,
        aiGuidance: _aig,
        defaultValue: _dv,
        description: _desc,
        ...domSafeCfg
      } = cfg

      const props: Record<string, any> = {
        value: value ?? null,
        onChange: handleChange,
        ...domSafeCfg,
      }
      props.name = name
      props['data-root-id'] = rootId
      if (type === 'richtext') props.editorKey = `${rootId}:${name}:${ctx.viewMode || 'source'}`
      if (type === 'select' || type === 'multiselect') {
        props.options = Array.isArray(cfg.options) ? cfg.options : []
        if (type === 'multiselect') props.multiple = true
      }
      if (type === 'taxonomy') props.taxonomySlug = cfg.taxonomySlug

      return (
        <FormField className="group">
          <div className="flex items-center justify-between">
            <LabelWithDescription
              label={label}
              description={cfg.description}
              hideLabel={hideLabel}
            />
            <AgentTrigger
              agents={matchingAgents}
              onSelect={(agent) => {
                ctx.setSelectedFieldAgent(agent)
                ctx.setAgentFieldKey(name)
                ctx.setAgentFieldType(type)
                ctx.setAgentModalOpen(true)
              }}
            />
          </div>
          <Renderer {...props} />
          <input
            ref={hiddenRef}
            type="hidden"
            name={name}
            data-root-id={rootId}
            defaultValue={
              value === null || value === undefined
                ? ''
                : typeof value === 'object'
                  ? JSON.stringify(value)
                  : typeof value === 'boolean'
                    ? value
                      ? 'true'
                      : 'false'
                    : String(value)
            }
            data-bool={type === 'boolean' ? '1' : undefined}
            data-json={isPlainObject(value) || Array.isArray(value) ? '1' : undefined}
          />
        </FormField>
      )
    }

    const rendered = maybeRenderComponent()
    if (rendered) return rendered

    if (type === 'date')
      return (
        <DateFieldInternal
          name={name}
          label={label}
          rootId={rootId}
          hideLabel={hideLabel}
          initial={typeof value === 'string' ? value : ''}
          ctx={ctx}
          field={field}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'slider')
      return (
        <SliderFieldInternal
          name={name}
          label={label}
          value={value}
          rootId={rootId}
          hideLabel={hideLabel}
          field={field}
          ctx={ctx}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'media')
      return (
        <MediaFieldInternal
          name={name}
          label={label}
          value={value}
          hideLabel={hideLabel}
          field={field}
          ctx={ctx}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'icon')
      return (
        <IconFieldInternal
          name={name}
          label={label}
          value={value}
          rootId={rootId}
          hideLabel={hideLabel}
          ctx={ctx}
          field={field}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'post-reference')
      return (
        <PostReferenceFieldInternal
          name={name}
          label={label}
          value={value}
          rootId={rootId}
          hideLabel={hideLabel}
          field={field}
          ctx={ctx}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'form-reference')
      return (
        <FormReferenceFieldInternal
          name={name}
          label={label}
          value={value}
          rootId={rootId}
          hideLabel={hideLabel}
          field={field}
          ctx={ctx}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'select' || type === 'multiselect')
      return (
        <SelectFieldInternal
          name={name}
          label={label}
          value={value}
          rootId={rootId}
          hideLabel={hideLabel}
          field={field}
          type={type}
          ctx={ctx}
          matchingAgents={matchingAgents}
        />
      )
    if (type === 'boolean')
      return (
        <BooleanFieldInternal
          name={name}
          label={label}
          value={value}
          rootId={rootId}
          ctx={ctx}
          matchingAgents={matchingAgents}
        />
      )

    if (type === 'link') {
      const initial: LinkFieldValue = (value as any) ?? null
      const hiddenRef = useRef<HTMLInputElement | null>(null)
      return (
        <>
          <LinkField
            label={label}
            value={value}
            onChange={(val: LinkFieldValue) => {
              if (hiddenRef.current) {
                hiddenRef.current.value = val ? JSON.stringify(val) : ''
                hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
                hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
              }
              const next = { ...(ctx.latestDraft.current || {}) }
              setByPath(next, name, val)
              ctx.setDraft(next)
              ctx.onDirty?.()
            }}
          />
          <input
            type="hidden"
            name={name}
            defaultValue={initial ? JSON.stringify(initial) : ''}
            ref={hiddenRef}
            data-json="1"
            data-root-id={rootId}
          />
        </>
      )
    }

    if (type === 'textarea') {
      return (
        <FormField className="group">
          <div className="flex items-center justify-between">
            <LabelWithDescription
              label={label}
              description={field.description}
              hideLabel={hideLabel}
            />
            <AgentTrigger
              agents={matchingAgents}
              onSelect={(agent) => {
                ctx.setSelectedFieldAgent(agent)
                ctx.setAgentFieldKey(name)
                ctx.setAgentFieldType(type)
                ctx.setAgentModalOpen(true)
              }}
            />
          </div>
          <TokenField
            type="textarea"
            name={name}
            value={value ?? ''}
            onChange={(val) => {
              const next = { ...(ctx.latestDraft.current || {}) }
              setByPath(next, name, val)
              ctx.setDraft(next)
              ctx.onDirty?.()
            }}
            data-root-id={rootId}
            customFields={ctx.customFields}
          />
        </FormField>
      )
    }

    return (
      <FormField className="group">
        <div className="flex items-center justify-between">
          <LabelWithDescription
            label={label}
            description={field.description}
            hideLabel={hideLabel}
          />
          <AgentTrigger
            agents={matchingAgents}
            onSelect={(agent) => {
              ctx.setSelectedFieldAgent(agent)
              ctx.setAgentFieldKey(name)
              ctx.setAgentFieldType(type)
              ctx.setAgentModalOpen(true)
            }}
          />
        </div>
        <TokenField
          type="text"
          name={name}
          placeholder={(field as any).placeholder || ''}
          value={value ?? ''}
          onChange={(val) => {
            const next = { ...(ctx.latestDraft.current || {}) }
            setByPath(next, name, val)
            ctx.setDraft(next)
            ctx.onDirty?.()
          }}
          data-root-id={rootId}
          customFields={ctx.customFields}
        />
      </FormField>
    )
  }
)

const FieldBySchemaInternal = memo(
  ({
    path,
    field,
    value,
    rootId,
    ctx,
  }: {
    path: string[]
    field: CustomFieldDefinition
    value: any
    rootId: string
    ctx: EditorFieldCtx
  }) => {
    const showIf = (field as any).showIf
    if (showIf && typeof showIf === 'object') {
      const depPath = showIf.field
      const depValue = getByPath(ctx.latestDraft.current, depPath)

      if (showIf.isVideo === true) {
        const cached = mediaMetadataCache.get(depValue)
        const isVideo =
          cached?.mediaData?.mimeType?.startsWith('video/') ||
          (typeof depValue === 'string' &&
            (depValue.toLowerCase().endsWith('.mp4') ||
              depValue.toLowerCase().endsWith('.webm') ||
              depValue.toLowerCase().endsWith('.ogg')))
        if (!isVideo) return null
      } else if (showIf.equals !== undefined) {
        if (depValue !== showIf.equals) return null
      } else if (showIf.notEquals !== undefined) {
        if (depValue === showIf.notEquals) return null
      }
    }

    const type = (field as any).type as string
    const name = path.join('.')
    const label = getLabel(path, field)

    if (type === 'object') {
      const rawFields: any = (field as any).fields
      let objectFields: CustomFieldDefinition[] | null = null
      if (Array.isArray(rawFields)) objectFields = rawFields
      else if ((field as any).properties && typeof (field as any).properties === 'object') {
        const props = (field as any).properties as Record<string, any>
        objectFields = Object.keys(props).map((k) => ({ slug: k, ...(props[k] || {}) }))
      }

      if (objectFields && objectFields.length > 0) {
        return (
          <fieldset className="border border-line-low rounded-lg mt-4 p-3">
            <legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
            <div className="grid grid-cols-1 gap-4">
              {objectFields.map((f) => (
                <FieldBySchemaInternal
                  key={`${name}.${f.slug}`}
                  path={[...path, f.slug]}
                  field={f}
                  value={value ? value[f.slug] : undefined}
                  rootId={rootId}
                  ctx={ctx}
                />
              ))}
            </div>
          </fieldset>
        )
      }
    }

    if (type === 'repeater' || type === 'array') {
      const items: any[] = Array.isArray(value) ? value : []
      const rawItemSchema: CustomFieldDefinition | undefined = (field as any).item
      const rawItemsDef: any = (field as any).items
      let itemSchema: CustomFieldDefinition | undefined = rawItemSchema
      if (!itemSchema && rawItemsDef) {
        if (rawItemsDef.type === 'object' && rawItemsDef.properties) {
          const fields = Object.keys(rawItemsDef.properties).map((k) => ({
            slug: k,
            ...(rawItemsDef.properties[k] || {}),
          }))
          itemSchema = { slug: 'item', type: 'object', fields } as any
        } else {
          itemSchema = { slug: 'item', ...(rawItemsDef || {}) } as any
        }
      }

      return (
        <fieldset className="border border-line-low rounded-lg mt-4 p-3">
          <legend className="px-1 text-xs font-medium text-neutral-low">{label}</legend>
          <div className="space-y-3">
            {items.length === 0 && (
              <p className="text-xs text-neutral-low">No items. Click “Add Item”.</p>
            )}
            {items.map((it, idx) => (
              <div key={`${name}.${idx}`} className="border border-line-low rounded p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 border-b border-line-low pb-2 mb-2">
                  <span className="text-[10px] font-bold text-neutral-low uppercase tracking-wider">
                    Item {idx + 1}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] uppercase font-bold text-neutral-low hover:text-red-500 transition-colors"
                      onClick={() => {
                        const next = ctx.syncFormToDraft()
                        const arr = [...(getByPath(next, name) || [])]
                        arr.splice(idx, 1)
                        setByPath(next, name, arr)
                        ctx.setDraft(next)
                        ctx.onDirty?.()
                      }}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] uppercase font-bold text-neutral-low hover:text-primary disabled:opacity-30 transition-colors"
                      disabled={idx === 0}
                      onClick={() => {
                        const next = ctx.syncFormToDraft()
                        const arr = [...(getByPath(next, name) || [])]
                        const [moved] = arr.splice(idx, 1)
                        arr.splice(idx - 1, 0, moved)
                        setByPath(next, name, arr)
                        ctx.setDraft(next)
                        ctx.onDirty?.()
                      }}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="px-2 py-1 text-[10px] uppercase font-bold text-neutral-low hover:text-primary disabled:opacity-30 transition-colors"
                      disabled={idx >= items.length - 1}
                      onClick={() => {
                        const next = ctx.syncFormToDraft()
                        const arr = [...(getByPath(next, name) || [])]
                        const [moved] = arr.splice(idx, 1)
                        arr.splice(idx + 1, 0, moved)
                        setByPath(next, name, arr)
                        ctx.setDraft(next)
                        ctx.onDirty?.()
                      }}
                    >
                      Down
                    </button>
                  </div>
                </div>
                {itemSchema ? (
                  <FieldBySchemaInternal
                    path={[...path, String(idx)]}
                    field={{ ...itemSchema, slug: String(idx), hideLabel: true } as any}
                    value={it}
                    rootId={rootId}
                    ctx={ctx}
                  />
                ) : (
                  <FieldPrimitiveInternal
                    path={[...path, String(idx)]}
                    field={{ name: String(idx), type: 'text', hideLabel: true } as any}
                    value={it}
                    rootId={rootId}
                    ctx={ctx}
                  />
                )}
              </div>
            ))}
            <button
              type="button"
              className="px-3 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium"
              onClick={() => {
                const next = ctx.syncFormToDraft()
                const arr = [...(getByPath(next, name) || [])]
                let empty: any = ''
                if (itemSchema) {
                  const t = (itemSchema as any).type
                  if (t === 'object') {
                    empty = {}
                      ; ((itemSchema as any).fields || []).forEach((f: any) => {
                        empty[f.slug] = f.type === 'number' ? 0 : f.type === 'boolean' ? false : ''
                      })
                  } else if (t === 'number') empty = 0
                  else if (t === 'boolean') empty = false
                  else if (t === 'multiselect') empty = []
                }
                arr.push(empty)
                setByPath(next, name, arr)
                ctx.setDraft(next)
                ctx.onDirty?.()
              }}
            >
              Add Item
            </button>
          </div>
        </fieldset>
      )
    }

    return (
      <FieldPrimitiveInternal path={path} field={field} value={value} rootId={rootId} ctx={ctx} />
    )
  }
)

const ModuleFieldsRenderer = memo(
  ({
    schema,
    draft,
    moduleItem,
    ctx,
    isNoFieldModule,
    fallbackDraftKeys,
  }: {
    schema: CustomFieldDefinition[] | null
    draft: Record<string, any>
    moduleItem: ModuleListItem
    ctx: EditorFieldCtx
    isNoFieldModule: boolean
    fallbackDraftKeys: string[]
  }) => {
    if (schema && schema.length > 0) {
      const groups: Record<string, CustomFieldDefinition[]> = {}
      schema.forEach((f) => {
        const cat = f.category || 'General'
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(f)
      })

      return (
        <>
          {Object.entries(groups).map(([category, fields]) => (
            <div key={category} className="mb-8 space-y-4">
              {category !== 'General' && (
                <h4 className="text-[11px] font-bold text-neutral-medium uppercase tracking-wider border-b border-line-low pb-2 mb-4">
                  {category}
                </h4>
              )}
              <div className="space-y-4">
                {fields.map((f) => {
                  const fieldName = f.slug
                  const pendingRef = ctx.pendingInputValueRef?.current
                  const hasPendingValue =
                    pendingRef?.name === fieldName && pendingRef?.rootId === moduleItem.id
                  const pendingValue = hasPendingValue && pendingRef ? pendingRef.value : null
                  const draftValue = draft ? draft[fieldName] : undefined
                  const valueToUse = pendingValue !== null ? pendingValue : draftValue

                  return (
                    <FieldBySchemaInternal
                      key={fieldName}
                      path={[fieldName]}
                      field={f}
                      value={valueToUse}
                      rootId={moduleItem.id}
                      ctx={ctx}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </>
      )
    }

    if (isNoFieldModule || (fallbackDraftKeys && fallbackDraftKeys.length === 0)) {
      return <p className="text-sm text-neutral-low">No editable fields.</p>
    }

    return (
      <>
        {fallbackDraftKeys.map((key) => {
          const rawVal = draft[key]
          if (key === 'content') {
            let initial: any = rawVal
            if (typeof rawVal === 'string') {
              const trimmed = rawVal.trim()
              if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
                try {
                  initial = JSON.parse(trimmed)
                } catch {
                  /* ignore, keep as string */
                }
              }
            }
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-neutral-medium mb-1">{key}</label>
                {(ctx.fieldComponents as Record<string, any>)['RichtextField'] ? (
                  (ctx.fieldComponents as Record<string, any>)['RichtextField']({
                    editorKey: `${moduleItem.id}:${key}:${ctx.viewMode || 'source'}`,
                    value: initial,
                    onChange: (json: any) => {
                      const next = JSON.parse(JSON.stringify(draft))
                      setByPath(next, key, json)
                      ctx.setDraft(next)
                      ctx.onDirty?.()
                    },
                  })
                ) : (
                  <LexicalEditor
                    editorKey={`${moduleItem.id}:${key}:${ctx.viewMode || 'source'}`}
                    value={initial}
                    onChange={(json) => {
                      const next = JSON.parse(JSON.stringify(draft))
                      setByPath(next, key, json)
                      ctx.setDraft(next)
                      ctx.onDirty?.()
                    }}
                  />
                )}
              </div>
            )
          }
          if (isPlainObject(rawVal) || Array.isArray(rawVal)) {
            return (
              <div key={key}>
                <label className="block text-sm font-medium text-neutral-medium mb-1">{key}</label>
                <textarea
                  className="w-full px-3 py-2 min-h-[140px] border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs"
                  defaultValue={JSON.stringify(rawVal, null, 2)}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || 'null')
                      const next = JSON.parse(JSON.stringify(draft))
                      setByPath(next, key, parsed)
                      ctx.setDraft(next)
                      ctx.onDirty?.()
                    } catch {
                      toast.error('Invalid JSON')
                    }
                  }}
                />
              </div>
            )
          }
          return (
            <FieldPrimitiveInternal
              key={key}
              path={[key]}
              field={
                {
                  name: key,
                  type:
                    typeof rawVal === 'number'
                      ? 'number'
                      : typeof rawVal === 'boolean'
                        ? 'boolean'
                        : 'text',
                } as any
              }
              value={rawVal}
              rootId={moduleItem.id}
              ctx={ctx}
            />
          )
        })}
      </>
    )
  }
)

export function ModuleEditorPanel({
  open,
  moduleItem,
  onClose,
  onSave,
  processing = false,
  postId,
  moduleInstanceId,
  viewMode,
  customFields = [],
  allowGlobalEditing = false,
}: {
  open: boolean
  moduleItem: ModuleListItem | null
  onClose: () => void
  onSave: (
    overrides: Record<string, any> | null,
    edited: Record<string, any>
  ) => Promise<void> | void
  processing?: boolean
  postId?: string
  moduleInstanceId?: string
  viewMode?: 'source' | 'review' | 'ai-review'
  customFields?: Array<{ slug: string; label: string }>
  allowGlobalEditing?: boolean
}) {
  const merged = useMemo(
    () => (moduleItem ? mergeFields(moduleItem.props || {}, moduleItem.overrides || null) : {}),
    [moduleItem]
  )
  const [draft, setDraft] = useState<Record<string, any>>(merged)
  const [schema, setSchema] = useState<CustomFieldDefinition[] | null>(() => {
    const cached = moduleItem ? moduleSchemaCache.get(moduleItem.type) : null
    return cached ? cached.schema : null
  })

  // Merge default values into draft if it's a global module being edited directly
  useEffect(() => {
    if (allowGlobalEditing && schema && schema.length > 0) {
      setDraft((prev) => {
        const next = { ...prev }
        let changed = false
        schema.forEach((field) => {
          if (next[field.slug] === undefined && field.default !== undefined) {
            next[field.slug] = field.default
            changed = true
          }
        })
        return changed ? next : prev
      })
    }
  }, [allowGlobalEditing, schema])
  const [moduleLabel, setModuleLabel] = useState<string | null>(() => {
    const cached = moduleItem ? moduleSchemaCache.get(moduleItem.type) : null
    return cached ? cached.label : null
  })

  const formRef = useRef<HTMLFormElement | null>(null)
  const [selectedFieldAgent, setSelectedFieldAgent] = useState<Agent | null>(null)
  const [agentModalOpen, setAgentModalOpen] = useState(false)
  const [agentFieldKey, setAgentFieldKey] = useState<string>('')
  const [agentFieldType, setAgentFieldType] = useState<string>('')
  const fieldAgents = useMemo(() => [], []) // Placeholder

  const fieldComponents = useMemo(() => {
    const modules = import.meta.glob('../../fields/*.tsx', { eager: true }) as Record<
      string,
      { default: any }
    >
    const map: Record<string, any> = {}
    Object.entries(modules).forEach(([p, mod]) => {
      const nm = p
        .split('/')
        .pop()
        ?.replace(/\.\w+$/, '')
      if (nm && mod?.default) map[nm] = mod.default
    })
    return map
  }, [])

  const pascalFromType = useCallback((t?: string | null) => {
    if (!t || typeof t !== 'string') return ''
    return t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
  }, [])

  const supportedFieldTypes = useMemo(
    () =>
      new Set([
        'text',
        'textarea',
        'number',
        'select',
        'multiselect',
        'boolean',
        'url',
        'link',
        'file',
        'taxonomy',
        'form-reference',
        'post-reference',
        'richtext',
        'slider',
      ]),
    []
  )

  const latestDraft = useRef(draft)
  useEffect(() => {
    latestDraft.current = draft
  }, [draft])
  const pendingInputValueRef = useRef<{
    name: string
    value: string
    rootId: string
    cursorPos: number
  } | null>(null)
  const lastRestoredDraftRef = useRef<{ name: string; value: string } | null>(null)

  const syncFormToDraft = useCallback(() => {
    const edited = { ...(latestDraft.current || {}) }
    if (formRef.current) {
      const els = formRef.current.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input[name], textarea[name], select[name]')
      els.forEach((el) => {
        const name = el.getAttribute('name')!
        if ((el as HTMLInputElement).type === 'checkbox')
          setByPath(edited, name, (el as HTMLInputElement).checked)
        else if ((el as HTMLInputElement).type === 'number')
          setByPath(edited, name, el.value === '' ? 0 : Number(el.value))
        else if (el.dataset.json === '1') {
          try {
            setByPath(edited, name, el.value ? JSON.parse(el.value) : null)
          } catch {
            setByPath(edited, name, el.value)
          }
        } else if (el.dataset.bool === '1') setByPath(edited, name, el.value === 'true')
        else setByPath(edited, name, el.value)
      })
    }
    return edited
  }, [])

  useLayoutEffect(() => {
    if (pendingInputValueRef.current) {
      const { name, value, rootId, cursorPos } = pendingInputValueRef.current
      const el = formRef.current?.querySelector(`[name="${name}"][data-root-id="${rootId}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
      if (el && el.value !== value) {
        el.value = value
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
          el.setSelectionRange(cursorPos, cursorPos)
      }
      const currentDraftValue = draft ? draft[name] : undefined
      const lastRestored = lastRestoredDraftRef.current
      const alreadyRestored = lastRestored?.name === name && lastRestored?.value === value
      if (currentDraftValue !== value && !alreadyRestored) {
        setDraft((prev) => {
          const next = { ...(prev || {}) }
          setByPath(next, name, value)
          return next
        })
        lastRestoredDraftRef.current = { name, value }
      } else if (currentDraftValue === value && lastRestored?.name === name) {
        lastRestoredDraftRef.current = null
      }
      const timeoutId = window.setTimeout(() => {
        if (
          pendingInputValueRef.current?.name === name &&
          (draft ? draft[name] : undefined) === value
        ) {
          pendingInputValueRef.current = null
          lastRestoredDraftRef.current = null
        }
      }, 1000)
      return () => window.clearTimeout(timeoutId)
    }
  }, [draft])

  useEffect(() => {
    if (!open || !moduleItem) return
    let alive = true
      ; (async () => {
        try {
          const cached = moduleSchemaCache.get(moduleItem.type)
          if (cached) {
            if (alive) {
              setModuleLabel(cached.label || moduleItem.type)
              setSchema(cached.schema)
            }
            return
          }
          const res = await fetch(`/api/modules/${encodeURIComponent(moduleItem.type)}/schema`, {
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => null)
          const ps =
            json?.data?.fieldSchema ||
            json?.fieldSchema ||
            json?.data?.propsSchema ||
            json?.propsSchema ||
            (json?.data?.schema
              ? json?.data?.schema?.fieldSchema || json?.data?.schema?.propsSchema
              : null) ||
            null
          const friendlyName = (json?.data && json.data.name) || json?.name || null
          if (alive) setModuleLabel(friendlyName || moduleItem.type)
          if (ps && typeof ps === 'object') {
            const fields: CustomFieldDefinition[] = Object.keys(ps).map((k) => ({
              slug: k,
              ...(ps[k] || {}),
            }))
            if (alive) setSchema(fields)
            moduleSchemaCache.set(moduleItem.type, {
              schema: fields,
              label: friendlyName || moduleItem.type,
            })
          } else {
            if (alive) setSchema(null)
            moduleSchemaCache.set(moduleItem.type, {
              schema: null,
              label: friendlyName || moduleItem.type,
            })
          }
        } catch {
          if (alive) setSchema(null)
        }
      })()
    return () => {
      alive = false
    }
  }, [open, moduleItem?.type])

  const ctx: EditorFieldCtx = useMemo(
    () => ({
      latestDraft,
      setDraft,
      fieldComponents,
      supportedFieldTypes,
      pascalFromType,
      setByPath,
      getLabel,
      syncFormToDraft,
      getByPath,
      formRef,
      postId,
      moduleInstanceId,
      moduleType: moduleItem?.type,
      moduleItem,
      fieldAgents,
      setSelectedFieldAgent,
      setAgentModalOpen,
      setAgentFieldKey,
      setAgentFieldType,
      viewMode,
      customFields,
      pendingInputValueRef,
      onDirty: () => { },
    }),
    [
      fieldComponents,
      supportedFieldTypes,
      pascalFromType,
      postId,
      moduleInstanceId,
      moduleItem,
      fieldAgents,
      viewMode,
      customFields,
    ]
  )

  const handleClose = async () => {
    // Automatically save current draft state before closing
    const base = moduleItem?.props || {}
    const edited = syncFormToDraft()
    const overrides = diffOverrides(base, edited)
    await onSave(overrides, edited)
    onClose()
  }

  if (!open || !moduleItem) return null

  const isNoFieldModule = moduleItem.type === 'reading-progress'
  const fallbackDraftKeys = Object.keys(draft || {}).filter(
    (k) => k !== 'type' && k !== 'properties'
  )

  // Debug log to see why global module fields might be visible
  console.log('[ModuleEditorPanel] Rendering:', {
    type: moduleItem.type,
    scope: moduleItem.scope,
    globalSlug: moduleItem.globalSlug,
    allowGlobalEditing,
    shouldHideFields:
      (moduleItem.scope === 'global' || moduleItem.scope === 'static' || !!moduleItem.globalSlug) &&
      !allowGlobalEditing,
  })

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-2xl bg-backdrop-low border-l border-line-low shadow-xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-4 border-b border-line-low flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-high">
            Module Custom Fields — {moduleLabel || moduleItem.type}
          </h3>
        </div>
        {moduleItem.scope === 'global' && !allowGlobalEditing && (
          <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500 flex items-center justify-between">
            <span>
              Global modules are shared across posts and must be edited in the global settings.
            </span>
            <a
              href={`/admin/modules?tab=globals&editSlug=${moduleItem.globalSlug}`}
              className="font-semibold underline hover:text-amber-400"
            >
              Edit Global Module
            </a>
          </div>
        )}
        <form
          ref={formRef}
          className="p-5 grid grid-cols-1 gap-5 overflow-auto"
          onSubmit={(e) => e.preventDefault()}
          onChangeCapture={(e) => {
            try {
              const el = e.target as
                | HTMLInputElement
                | HTMLTextAreaElement
                | HTMLSelectElement
                | null
              const name = el?.getAttribute?.('name') || ''
              const rootId = el?.getAttribute?.('data-root-id') || moduleItem?.id || ''
              if (!name) return
              const currentValue = (el as HTMLInputElement | HTMLTextAreaElement).value || ''
              const storedValue =
                pendingInputValueRef.current?.name === name &&
                  pendingInputValueRef.current?.rootId === rootId
                  ? pendingInputValueRef.current.value
                  : null
              if (storedValue !== null && currentValue === storedValue) return
              const cursorPos =
                el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
                  ? (el.selectionStart ?? currentValue.length)
                  : currentValue.length
              if (rootId)
                pendingInputValueRef.current = { name, value: currentValue, rootId, cursorPos }
              setDraft((prev) => {
                const next = { ...(prev || {}) }
                if ((el as HTMLInputElement).type === 'checkbox')
                  setByPath(next, name, (el as HTMLInputElement).checked)
                else if ((el as HTMLInputElement).type === 'number')
                  setByPath(
                    next,
                    name,
                    (el as HTMLInputElement).value === ''
                      ? 0
                      : Number((el as HTMLInputElement).value)
                  )
                else if ((el as HTMLInputElement).dataset?.json === '1') {
                  try {
                    setByPath(next, name, currentValue ? JSON.parse(currentValue) : null)
                  } catch {
                    setByPath(next, name, currentValue)
                  }
                } else if ((el as HTMLInputElement).dataset?.bool === '1')
                  setByPath(next, name, currentValue === 'true')
                else setByPath(next, name, currentValue)
                return next
              })
            } catch { }
          }}
        >
          {(moduleItem.scope === 'global' ||
            moduleItem.scope === 'static' ||
            !!moduleItem.globalSlug) &&
            !allowGlobalEditing ? (
            <div className="py-12 text-center space-y-4">
              <div className="text-neutral-low mb-2">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-4xl opacity-20" />
              </div>
              <p className="text-sm text-neutral-medium max-w-xs mx-auto">
                This is a {moduleItem.scope || 'global'} module. To edit its fields, please go to
                the Global Modules settings.
              </p>
              {moduleItem.globalSlug && (
                <a
                  href={`/admin/modules?tab=globals&editSlug=${moduleItem.globalSlug}`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-standout-medium text-on-high rounded-lg text-sm font-semibold hover:bg-standout-high transition-colors"
                >
                  Edit Global Module
                </a>
              )}
            </div>
          ) : (
            <fieldset disabled={processing} className="contents">
              <ModuleFieldsRenderer
                schema={schema}
                draft={draft}
                moduleItem={moduleItem}
                ctx={ctx}
                isNoFieldModule={isNoFieldModule}
                fallbackDraftKeys={fallbackDraftKeys}
              />
            </fieldset>
          )}
          <div className="flex items-center justify-end gap-2 border-t border-line-low pt-4 mt-auto">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded bg-standout-medium text-on-high disabled:opacity-60"
              onClick={handleClose}
              disabled={processing || (moduleItem.scope !== 'post' && !allowGlobalEditing)}
            >
              Close
            </button>
          </div>
        </form>
      </div>
      {selectedFieldAgent && (
        <AgentModal
          open={agentModalOpen}
          onOpenChange={setAgentModalOpen}
          agent={selectedFieldAgent}
          contextId={postId}
          context={{
            scope: 'field',
            fieldKey: agentFieldKey,
            fieldType: agentFieldType,
            moduleInstanceId,
          }}
          scope="field"
          fieldKey={agentFieldKey}
          fieldType={agentFieldType}
          viewMode={viewMode}
        />
      )}
    </div>,
    document.body
  )
}

export const ModuleEditorInline = memo(function ModuleEditorInline({
  moduleItem,
  onSave,
  onDirty,
  processing = false,
  postId,
  moduleInstanceId,
  viewMode,
  fieldAgents = [],
  autoSaveOnBlur = true,
  registerFlush,
  className = '',
  customFields = [],
}: {
  moduleItem: ModuleListItem
  onSave: (
    overrides: Record<string, any> | null,
    edited: Record<string, any>
  ) => Promise<void> | void
  onDirty?: () => void
  processing?: boolean
  postId?: string
  moduleInstanceId?: string
  viewMode?: 'source' | 'review' | 'ai-review'
  fieldAgents?: Agent[]
  autoSaveOnBlur?: boolean
  registerFlush?: (flush: (() => Promise<void>) | null) => void
  className?: string
  customFields?: Array<{ slug: string; label: string }>
}) {
  const merged = useMemo(
    () => (moduleItem ? mergeFields(moduleItem.props || {}, moduleItem.overrides || null) : {}),
    [moduleItem]
  )
  const [draft, setDraft] = useState<Record<string, any>>(merged)
  // Suppress "dirty" signals during initial hydration and when we're syncing incoming props -> draft.
  // Without this, some field components will fire programmatic change events (isTrusted=false) on mount
  // or after a rehydrate, which incorrectly enables the page-level Save button.
  const suppressDirtyRef = useRef(true)
  useEffect(() => {
    // After first paint, allow dirty tracking.
    const id = setTimeout(() => {
      suppressDirtyRef.current = false
    }, 0)
    return () => clearTimeout(id)
  }, [])

  const safeOnDirty = useCallback(() => {
    if (suppressDirtyRef.current) return
    onDirty?.()
  }, [onDirty])

  // If the incoming merged props change AND we are not locally edited, sync draft to match.
  // This keeps the editor aligned after reloads/saves without stomping in-progress typing.
  useEffect(() => {
    // If the user has unsaved local edits, do not overwrite.
    const locallyEdited = JSON.stringify(draft || {}) !== JSON.stringify(merged || {})
    if (locallyEdited) return

    suppressDirtyRef.current = true
    setDraft(merged)
    const id = setTimeout(() => {
      suppressDirtyRef.current = false
    }, 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleItem?.id, viewMode, merged])
  const [schema, setSchema] = useState<CustomFieldDefinition[] | null>(() => {
    const cached = moduleItem ? moduleSchemaCache.get(moduleItem.type) : null
    return cached ? cached.schema : null
  })

  const formRef = useRef<HTMLDivElement | null>(null)
  const [selectedFieldAgent, setSelectedFieldAgent] = useState<Agent | null>(null)
  const [agentModalOpen, setAgentModalOpen] = useState(false)
  const [agentFieldKey, setAgentFieldKey] = useState<string>('')
  const [agentFieldType, setAgentFieldType] = useState<string>('')
  const pendingInputValueRef = useRef<{
    name: string
    value: string
    rootId: string
    cursorPos: number
  } | null>(null)
  const lastRestoredDraftRef = useRef<{ name: string; value: string } | null>(null)

  const fieldComponents = useMemo(() => {
    const modules = import.meta.glob('../../fields/*.tsx', { eager: true }) as Record<
      string,
      { default: any }
    >
    const map: Record<string, any> = {}
    Object.entries(modules).forEach(([p, mod]) => {
      const nm = p
        .split('/')
        .pop()
        ?.replace(/\.\w+$/, '')
      if (nm && mod?.default) map[nm] = mod.default
    })
    return map
  }, [])

  const pascalFromType = useCallback((t?: string | null) => {
    if (!t || typeof t !== 'string') return ''
    return t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
  }, [])

  const supportedFieldTypes = useMemo(
    () =>
      new Set([
        'text',
        'textarea',
        'number',
        'select',
        'multiselect',
        'boolean',
        'url',
        'link',
        'file',
        'taxonomy',
        'form-reference',
        'post-reference',
        'richtext',
        'slider',
      ]),
    []
  )

  const latestDraft = useRef(draft)
  useEffect(() => {
    latestDraft.current = draft
  }, [draft])

  const syncFormToDraft = useCallback(() => {
    const edited = { ...(latestDraft.current || {}) }
    if (formRef.current) {
      const els = formRef.current.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input[name], textarea[name], select[name]')
      els.forEach((el) => {
        const name = el.getAttribute('name')!
        if ((el as HTMLInputElement).type === 'checkbox')
          setByPath(edited, name, (el as HTMLInputElement).checked)
        else if ((el as HTMLInputElement).type === 'number')
          setByPath(edited, name, el.value === '' ? 0 : Number(el.value))
        else if (el.dataset.json === '1') {
          try {
            setByPath(edited, name, el.value ? JSON.parse(el.value) : null)
          } catch {
            setByPath(edited, name, el.value)
          }
        } else if (el.dataset.bool === '1') setByPath(edited, name, el.value === 'true')
        else setByPath(edited, name, el.value)
      })
    }
    return edited
  }, [])

  useLayoutEffect(() => {
    if (pendingInputValueRef.current) {
      const { name, value, rootId, cursorPos } = pendingInputValueRef.current
      const el = formRef.current?.querySelector(`[name="${name}"][data-root-id="${rootId}"]`) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
      if (el && el.value !== value) {
        el.value = value
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
          el.setSelectionRange(cursorPos, cursorPos)
      }
      const currentDraftValue = draft ? draft[name] : undefined
      const lastRestored = lastRestoredDraftRef.current
      const alreadyRestored = lastRestored?.name === name && lastRestored?.value === value
      if (currentDraftValue !== value && !alreadyRestored) {
        setDraft((prev) => {
          const next = { ...(prev || {}) }
          setByPath(next, name, value)
          return next
        })
        lastRestoredDraftRef.current = { name, value }
      } else if (currentDraftValue === value && lastRestored?.name === name) {
        lastRestoredDraftRef.current = null
      }
      const timeoutId = window.setTimeout(() => {
        if (
          pendingInputValueRef.current?.name === name &&
          (draft ? draft[name] : undefined) === value
        ) {
          pendingInputValueRef.current = null
          lastRestoredDraftRef.current = null
        }
      }, 1000)
      return () => window.clearTimeout(timeoutId)
    }
  }, [draft])

  useEffect(() => {
    if (!moduleItem) return
    let alive = true
      ; (async () => {
        try {
          const cached = moduleSchemaCache.get(moduleItem.type)
          if (cached) {
            if (alive) {
              setSchema(cached.schema)
            }
            return
          }
          const res = await fetch(`/api/modules/${encodeURIComponent(moduleItem.type)}/schema`, {
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => null)
          const ps =
            json?.data?.fieldSchema ||
            json?.fieldSchema ||
            json?.data?.propsSchema ||
            json?.propsSchema ||
            (json?.data?.schema
              ? json?.data?.schema?.fieldSchema || json?.data?.schema?.propsSchema
              : null) ||
            null
          const friendlyName = (json?.data && json.data.name) || json?.name || null
          if (ps && typeof ps === 'object') {
            const fields: CustomFieldDefinition[] = Object.keys(ps).map((k) => ({
              slug: k,
              ...(ps[k] || {}),
            }))
            if (alive) setSchema(fields)
            moduleSchemaCache.set(moduleItem.type, {
              schema: fields,
              label: friendlyName || moduleItem.type,
            })
          } else {
            if (alive) setSchema(null)
            moduleSchemaCache.set(moduleItem.type, {
              schema: null,
              label: friendlyName || moduleItem.type,
            })
          }
        } catch {
          if (alive) setSchema(null)
        }
      })()
    return () => {
      alive = false
    }
  }, [moduleItem?.type])

  const ctx: EditorFieldCtx = useMemo(
    () => ({
      latestDraft,
      setDraft,
      fieldComponents,
      supportedFieldTypes,
      pascalFromType,
      setByPath,
      getLabel,
      syncFormToDraft,
      getByPath,
      formRef,
      postId,
      moduleInstanceId,
      moduleType: moduleItem?.type,
      moduleItem,
      fieldAgents,
      setSelectedFieldAgent,
      setAgentModalOpen,
      setAgentFieldKey,
      setAgentFieldType,
      viewMode,
      customFields,
      onDirty: safeOnDirty,
      pendingInputValueRef,
    }),
    [
      fieldComponents,
      supportedFieldTypes,
      pascalFromType,
      syncFormToDraft,
      postId,
      moduleInstanceId,
      moduleItem,
      fieldAgents,
      viewMode,
      customFields,
      onDirty,
    ]
  )

  const saveNow = useCallback(async () => {
    const base = moduleItem?.props || {}
    const edited = syncFormToDraft()
    const overrides = diffOverrides(base, edited)
    await onSave(overrides, edited)
  }, [moduleItem, syncFormToDraft, onSave])

  useEffect(() => {
    if (registerFlush) registerFlush(saveNow)
    return () => {
      if (registerFlush) registerFlush(null)
    }
  }, [registerFlush, saveNow])

  const isNoFieldModule = moduleItem.type === 'reading-progress'
  const fallbackDraftKeys = Object.keys(draft || {}).filter(
    (k) => k !== 'type' && k !== 'properties'
  )

  return (
    <div className={className}>
      {moduleItem.scope === 'global' && (
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-500 flex items-center justify-between">
          <span>Global module (shared) - edit in settings.</span>
          <a
            href={`/admin/modules?tab=globals&editSlug=${moduleItem.globalSlug}`}
            className="font-semibold underline hover:text-amber-400"
          >
            Edit Global
          </a>
        </div>
      )}
      <div
        ref={formRef}
        className="grid grid-cols-1 gap-5"
        onChangeCapture={(e) => {
          try {
            const el = e.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null
            const name = el?.getAttribute?.('name') || ''
            const rootId = el?.getAttribute?.('data-root-id') || moduleItem?.id || ''
            if (!name) return
            const currentValue = (el as HTMLInputElement | HTMLTextAreaElement).value || ''
            const storedValue =
              pendingInputValueRef.current?.name === name &&
                pendingInputValueRef.current?.rootId === rootId
                ? pendingInputValueRef.current.value
                : null
            if (storedValue !== null && currentValue === storedValue) return
            const cursorPos =
              el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
                ? (el.selectionStart ?? currentValue.length)
                : currentValue.length
            if (rootId)
              pendingInputValueRef.current = { name, value: currentValue, rootId, cursorPos }
            setDraft((prev) => {
              const next = { ...(prev || {}) }
              if ((el as HTMLInputElement).type === 'checkbox')
                setByPath(next, name, (el as HTMLInputElement).checked)
              else if ((el as HTMLInputElement).type === 'number')
                setByPath(
                  next,
                  name,
                  (el as HTMLInputElement).value === '' ? 0 : Number((el as HTMLInputElement).value)
                )
              else if ((el as HTMLInputElement).dataset?.json === '1') {
                try {
                  setByPath(next, name, currentValue ? JSON.parse(currentValue) : null)
                } catch {
                  setByPath(next, name, currentValue)
                }
              } else if ((el as HTMLInputElement).dataset?.bool === '1')
                setByPath(next, name, currentValue === 'true')
              else setByPath(next, name, currentValue)
              return next
            })
            // Only consider real user-originated events as "dirty". Programmatic events from hydration
            // (isTrusted=false) should not enable the page-level Save button.
            const trusted =
              (e as any)?.isTrusted ??
              (e as any)?.nativeEvent?.isTrusted ??
              (e as any)?.nativeEvent?.detail?.isTrusted ??
              false
            if (trusted) safeOnDirty()
          } catch { }
        }}
        onBlurCapture={() => {
          if (autoSaveOnBlur) saveNow()
        }}
      >
        {moduleItem.scope === 'global' ||
          moduleItem.scope === 'static' ||
          !!moduleItem.globalSlug ? (
          <div className="py-8 text-center bg-amber-500/5 rounded-lg border border-dashed border-amber-500/20">
            <p className="text-sm text-neutral-medium italic">
              {(moduleItem.scope || 'global').charAt(0).toUpperCase() +
                (moduleItem.scope || 'global').slice(1)}{' '}
              module fields are hidden in the post editor.
            </p>
          </div>
        ) : (
          <fieldset disabled={processing}>
            <ModuleFieldsRenderer
              schema={schema}
              draft={draft}
              moduleItem={moduleItem}
              ctx={ctx}
              isNoFieldModule={isNoFieldModule}
              fallbackDraftKeys={fallbackDraftKeys}
            />
          </fieldset>
        )}
      </div>
      {selectedFieldAgent && (
        <AgentModal
          open={agentModalOpen}
          onOpenChange={setAgentModalOpen}
          agent={selectedFieldAgent}
          contextId={postId}
          context={{
            scope: 'field',
            fieldKey: agentFieldKey,
            fieldType: agentFieldType,
            moduleInstanceId,
          }}
          scope="field"
          fieldKey={agentFieldKey}
          fieldType={agentFieldType}
          viewMode={viewMode}
        />
      )}
    </div>
  )
})
