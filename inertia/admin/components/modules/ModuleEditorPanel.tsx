import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, memo } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { LexicalEditor } from '../LexicalEditor'
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
import { FormField, FormLabel } from '~/components/forms/field'
import { LinkField, type LinkFieldValue } from '~/components/forms/LinkField'
import { MediaPickerModal } from '../media/MediaPickerModal'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'
import { MediaRenderer } from '../../../components/MediaRenderer'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { iconOptions, iconMap } from '../ui/iconOptions'
import { AgentModal, type Agent } from '../agents/AgentModal'
import { useHasPermission } from '~/utils/permissions'
import { CustomFieldDefinition } from '~/types/custom_field'

import { TokenField } from '../ui/TokenField'

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

// Cache module schemas by type to avoid N identical fetches when rendering multiple editors.
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
          (json?.data?.schema ? json?.data?.schema?.fieldSchema || json?.data?.schema?.propsSchema : null) ||
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
  pascalFromType: (t: string) => string
  setByPath: (obj: Record<string, any>, path: string, value: any) => void
  getLabel: (path: string[], field: CustomFieldDefinition) => string
  syncFormToDraft: () => Record<string, any>
  getByPath: (obj: Record<string, any>, path: string) => any
  // NOTE: Inline editors use a <div> container; modal editor uses a <form>.
  // Both support querySelectorAll and (optionally) scrollTop.
  formRef: React.RefObject<HTMLElement | null>
  postId?: string
  moduleInstanceId?: string
  moduleType?: string
  fieldAgents: Agent[]
  viewMode?: 'source' | 'review' | 'ai-review'
  customFields?: Array<{ slug: string; label: string }>
  onDirty?: () => void
}

function setByPath(obj: Record<string, any>, path: string | string[], value: any) {
  const parts = typeof path === 'string' ? path.split('.') : path
  let target: any = obj

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    const nextKey = parts[i + 1]
    const nextIsIndex = /^\d+$/.test(nextKey)

    if (Array.isArray(target[key])) {
      target = target[key]
      continue
    }

    if (
      !Object.prototype.hasOwnProperty.call(target, key) ||
      (!isPlainObject(target[key]) && !Array.isArray(target[key]))
    ) {
      target[key] = nextIsIndex ? [] : {}
    }

    target = target[key]
  }

  const last = parts[parts.length - 1]
  if (Array.isArray(target) && /^\d+$/.test(last)) {
    target[Number(last)] = value
  } else {
    target[last] = value
  }
}

function getByPath(obj: Record<string, any>, path: string | string[]): any {
  const parts = typeof path === 'string' ? path.split('.') : path
  let target: any = obj
  for (const part of parts) {
    if (target === null || target === undefined) return undefined
    target = target[part]
  }
  return target
}

function humanizeKey(raw: string): string {
  if (!raw) return ''
  let s = String(raw)
  s = s.replace(/[_-]+/g, ' ')
  s = s.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  s = s.trim()
  if (!s) return ''
  const words = s.split(/\s+/).map((w) => {
    const lower = w.toLowerCase()
    if (lower === 'cta') return 'CTA'
    if (lower === 'id') return 'ID'
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
  return words.join(' ')
}

function getLabel(path: string[], field: CustomFieldDefinition): string {
  const explicit = field.label
  if (explicit) return explicit as string
  const key = path[path.length - 1] || ''
  return humanizeKey(key)
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
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

function mergeFields(
  base: Record<string, any>,
  overrides: Record<string, any> | null
): Record<string, any> {
  if (!overrides) return base
  const result: Record<string, any> = { ...base }
  for (const key of Object.keys(overrides)) {
    const overrideVal = overrides[key]
    const baseVal = base[key]
    if (isPlainObject(overrideVal) && isPlainObject(baseVal)) {
      result[key] = mergeFields(baseVal, overrideVal)
    } else {
      result[key] = overrideVal
    }
  }
  return result
}

function diffOverrides(
  base: Record<string, any>,
  edited: Record<string, any>,
  depth = 0
): Record<string, any> | null {
  // Depth limit to prevent infinite loops on circular refs (though we sanitize them)
  if (depth > 10) return edited

  const out: Record<string, any> = {}
  let changed = false

  const allKeys = new Set([...Object.keys(base), ...Object.keys(edited)])

  for (const key of allKeys) {
    const b = base[key]
    const e = edited[key]

    // Fast check for reference equality
    if (b === e) continue

    if (isPlainObject(b) && isPlainObject(e)) {
      // For very large objects (e.g. rich text > 100KB), deep diffing is slow.
      // If it changed at all (ref check failed), just send it as-is if it's too big.
      const sizeB = JSON.stringify(b).length
      if (sizeB > 102400) {
        if (JSON.stringify(b) !== JSON.stringify(e)) {
          out[key] = e
          changed = true
        }
        continue
      }

      const child = diffOverrides(b, e, depth + 1)
      if (child && Object.keys(child).length) {
        out[key] = child
        changed = true
      }
    } else if (Array.isArray(b) || Array.isArray(e)) {
      // Optimized array comparison: skip stringify for simple cases
      if (!Array.isArray(b) || !Array.isArray(e) || b.length !== e.length) {
        out[key] = e
        changed = true
      } else {
        // Quick check for primitive arrays
        let arrayMatch = true
        for (let i = 0; i < b.length; i++) {
          if (b[i] !== e[i]) {
            arrayMatch = false
            break
          }
        }
        if (!arrayMatch) {
          // If primitives didn't match, fallback to JSON check
          if (JSON.stringify(b) !== JSON.stringify(e)) {
            out[key] = e
            changed = true
          }
        }
      }
    } else {
      // Primitive mismatch
      out[key] = e
      changed = true
    }
  }
  return changed ? out : null
}

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
  const [moduleLabel, setModuleLabel] = useState<string | null>(() => {
    const cached = moduleItem ? moduleSchemaCache.get(moduleItem.type) : null
    return cached ? cached.label : null
  })
  const formRef = useRef<HTMLFormElement | null>(null)
  const [fieldAgents, setFieldAgents] = useState<Agent[]>([])
  const hasFieldPermission = useHasPermission('agents.field')

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

  const pascalFromType = (t?: string | null) => {
    if (!t || typeof t !== 'string') return ''
    return t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
  }

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

  const isMountedRef = useRef(false)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fallbackDraftKeys = useMemo(
    () => Object.keys(draft || {}).filter((k) => k !== 'type' && k !== 'properties'),
    [draft]
  )

  const isNoFieldModule = moduleItem?.type === 'reading-progress'

  // Load field-scoped agents
  useEffect(() => {
    if (!open || !hasFieldPermission) {
      setFieldAgents([])
      return
    }
    let alive = true
      ; (async () => {
        try {
          const res = await fetch('/api/agents?scope=field', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) {
            setFieldAgents(list)
          }
        } catch (error) {
          console.error('Failed to load field-scoped agents:', error)
          if (alive) setFieldAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [open, hasFieldPermission])

  const syncFormToDraft = useCallback((): Record<string, any> => {
    // Avoid slow JSON stringify/parse for cloning the draft
    const edited = { ...(latestDraft.current || {}) }
    const form = formRef.current
    if (form) {
      const elements = form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input[name], textarea[name], select[name]')
      elements.forEach((el) => {
        const name = el.getAttribute('name')!
        if ((el as HTMLInputElement).type === 'checkbox') {
          setByPath(edited, name, (el as HTMLInputElement).checked)
        } else if ((el as HTMLInputElement).type === 'number') {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.json === '1'
        ) {
          const val = (el as HTMLInputElement).value
          try {
            setByPath(edited, name, val ? JSON.parse(val) : null)
          } catch {
            setByPath(edited, name, val)
          }
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.bool === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === 'true')
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.number === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if ((el as HTMLSelectElement).multiple) {
          const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
          setByPath(edited, name, vals)
        } else {
          setByPath(edited, name, (el as HTMLInputElement).value)
        }
      })
    }
    return edited
  }, [])

  useEffect(() => {
    if (!open || !moduleItem) return
    setDraft(mergeFields(moduleItem.props || {}, moduleItem.overrides || null))
    setModuleLabel(null)
    // Only reinitialize when the selection changes, not on object identity churn
  }, [open, moduleItem?.id])

  // Load module schema (if available)
  useEffect(() => {
    let alive = true
      ; (async () => {
        if (!open || !moduleItem) return
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
            json?.data?.propsSchema ||
            json?.propsSchema ||
            (json?.data?.schema ? json?.data?.schema?.propsSchema : null) ||
            null
          const friendlyName: string | null =
            (json?.data && (json.data.name as string | undefined)) ||
            (json && (json.name as string | undefined)) ||
            null
          if (alive) {
            setModuleLabel(friendlyName || moduleItem.type)
          }
          if (ps && typeof ps === 'object') {
            const fields: CustomFieldDefinition[] = Object.keys(ps).map((k) => {
              const def = (ps as any)[k] || {}
              return { slug: k, ...(def || {}) }
            })
            if (alive) setSchema(fields)
            moduleSchemaCache.set(moduleItem.type, { schema: fields, label: friendlyName || moduleItem.type })
          } else {
            if (alive) setSchema(null)
            moduleSchemaCache.set(moduleItem.type, { schema: null, label: friendlyName || moduleItem.type })
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
      fieldAgents,
      viewMode,
      customFields,
      onDirty: undefined,
    }),
    [
      setDraft,
      fieldComponents,
      supportedFieldTypes,
      pascalFromType,
      syncFormToDraft,
      postId,
      moduleInstanceId,
      moduleItem?.type,
      fieldAgents,
      viewMode,
      customFields,
    ]
  )

  const collectEdited = useCallback(() => {
    if (!moduleItem) return { overrides: null, edited: {} }
    const base = moduleItem?.props || {}
    const edited = JSON.parse(JSON.stringify(merged))
    const form = formRef.current
    if (form) {
      const elements = form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input[name], textarea[name], select[name]')
      elements.forEach((el) => {
        const name = el.getAttribute('name')!
        if ((el as HTMLInputElement).type === 'checkbox') {
          setByPath(edited, name, (el as HTMLInputElement).checked)
        } else if ((el as HTMLInputElement).type === 'number') {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.json === '1'
        ) {
          const val = (el as HTMLInputElement).value
          try {
            setByPath(edited, name, val ? JSON.parse(val) : null)
          } catch {
            setByPath(edited, name, val)
          }
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.bool === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === 'true')
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.number === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if ((el as HTMLSelectElement).multiple) {
          const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
          setByPath(edited, name, vals)
        } else {
          setByPath(edited, name, (el as HTMLInputElement).value)
        }
      })
    }
    const overrides = diffOverrides(base, edited)
    return { overrides, edited }
  }, [merged, moduleItem])

  const saveAndClose = useCallback(async () => {
    const { overrides, edited } = collectEdited()
    await onSave(overrides, edited)
    onClose()
  }, [collectEdited, onSave, onClose])

  // Auto-save when clicking outside (backdrop) - preserve changes
  const handleBackdropClick = useCallback(async () => {
    const { overrides, edited } = collectEdited()
    await onSave(overrides, edited)
    onClose()
  }, [collectEdited, onSave, onClose])

  // Keep hooks order stable; render null late.
  if (!open || !moduleItem) return null

  return createPortal(
    <div
      className="fixed inset-0 z-40"
      onMouseDown={(e) => {
        // prevent outside dnd or other handlers from stealing focus
        e.stopPropagation()
      }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={handleBackdropClick} />
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
        {moduleItem.scope === 'global' && (
          <div className="px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-500 flex items-center justify-between">
            <span>Global modules are shared across posts and must be edited in the global settings.</span>
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
          onSubmit={(e) => {
            e.preventDefault()
          }}
        >
          <fieldset disabled={processing || moduleItem.scope === 'global'} className="contents">
            {schema && schema.length > 0 ? (
              (() => {
                const groups: Record<string, CustomFieldDefinition[]> = {}
                schema.forEach((f) => {
                  const cat = f.category || 'General'
                  if (!groups[cat]) groups[cat] = []
                  groups[cat].push(f)
                })

                return Object.entries(groups).map(([category, fields]) => (
                  <div key={category} className="mb-8 space-y-4">
                    {category !== 'General' && (
                      <h4 className="text-[11px] font-bold text-neutral-medium uppercase tracking-wider border-b border-line-low pb-2 mb-4">
                        {category}
                      </h4>
                    )}
                    <div className="space-y-4">
                      {fields.map((f) => (
                        <FieldBySchemaInternal
                          key={f.slug}
                          path={[f.slug]}
                          field={f}
                          value={draft ? draft[f.slug] : undefined}
                          rootId={moduleItem.id}
                          ctx={ctx}
                        />
                      ))}
                    </div>
                  </div>
                ))
              })()
            ) : isNoFieldModule || fallbackDraftKeys.length === 0 ? (
              <p className="text-sm text-neutral-low">No editable fields.</p>
            ) : (
              fallbackDraftKeys.map((key) => {
                const rawVal = draft[key]
                // Heuristic: always treat 'content' as rich text
                if (key === 'content') {
                  let initial: any = undefined
                  if (isPlainObject(rawVal)) {
                    initial = rawVal
                  } else if (typeof rawVal === 'string') {
                    try {
                      const parsed = JSON.parse(rawVal)
                      initial = parsed
                    } catch {
                      initial = undefined
                    }
                  }
                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-neutral-medium mb-1">
                        {key}
                      </label>
                      {(fieldComponents as Record<string, any>)['RichtextField'] ? (
                        (fieldComponents as Record<string, any>)['RichtextField']({
                          editorKey: `${moduleItem.id}:${key}`,
                          value: initial,
                          onChange: (json: any) => {
                            const hidden =
                              (formRef.current?.querySelector(
                                `input[type="hidden"][name="${key}"]`
                              ) as HTMLInputElement) || null
                            if (hidden) {
                              try {
                                hidden.value = JSON.stringify(json)
                              } catch {
                                /* ignore */
                              }
                            }
                            const next = JSON.parse(JSON.stringify(draft))
                            setByPath(next, key, json)
                            setDraft(next)
                            ctx.onDirty?.()
                          },
                        })
                      ) : (
                        <LexicalEditor
                          editorKey={`${moduleItem.id}:${key}`}
                          value={initial}
                          onChange={(json) => {
                            const hidden =
                              (formRef.current?.querySelector(
                                `input[type="hidden"][name="${key}"]`
                              ) as HTMLInputElement) || null
                            if (hidden) {
                              try {
                                hidden.value = JSON.stringify(json)
                              } catch {
                                /* ignore */
                              }
                            }
                            const next = JSON.parse(JSON.stringify(draft))
                            setByPath(next, key, json)
                            setDraft(next)
                            ctx.onDirty?.()
                          }}
                        />
                      )}
                      <input
                        type="hidden"
                        name={key}
                        data-json="1"
                        defaultValue={
                          isPlainObject(rawVal)
                            ? JSON.stringify(rawVal)
                            : typeof rawVal === 'string'
                              ? rawVal
                              : ''
                        }
                      />
                    </div>
                  )
                }
                const val = rawVal
                if (isPlainObject(val) || Array.isArray(val)) {
                  return (
                    <div key={key}>
                      <label className="block text-sm font-medium text-neutral-medium mb-1">
                        {key}
                      </label>
                      <textarea
                        className="w-full px-3 py-2 min-h-[140px] border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs focus:ring-1 ring-ring focus:border-transparent"
                        defaultValue={JSON.stringify(val, null, 2)}
                        onBlur={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value || 'null')
                            const next = JSON.parse(JSON.stringify(draft))
                            setByPath(next, key, parsed)
                            setDraft(next)
                          } catch {
                            toast.error('Invalid JSON')
                          }
                        }}
                      />
                      <p className="text-xs text-neutral-low mt-1">Edit JSON directly.</p>
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
                          typeof val === 'number'
                            ? 'number'
                            : typeof val === 'boolean'
                              ? 'boolean'
                              : 'text',
                      } as any
                    }
                    value={val}
                    rootId={moduleItem.id}
                    ctx={ctx}
                  />
                )
              })
            )}
          </fieldset>
          <div className="flex items-center justify-end gap-2 border-t border-line-low pt-4">
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded border border-line-medium text-neutral-high hover:bg-backdrop-medium"
              onClick={onClose}
              disabled={processing}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 text-xs rounded bg-standout-medium text-on-standout disabled:opacity-60"
              onClick={saveAndClose}
              disabled={processing || moduleItem.scope === 'global'}
            >
              Done
            </button>
          </div>
        </form>
      </div>
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
  onSave: (overrides: Record<string, any> | null, edited: Record<string, any>) => Promise<void> | void
  // Called once when the user changes any field in this module (used to enable the page-level Save button)
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
  const [schema, setSchema] = useState<CustomFieldDefinition[] | null>(() => {
    const cached = moduleItem ? moduleSchemaCache.get(moduleItem.type) : null
    return cached ? cached.schema : null
  })
  const [moduleLabel, setModuleLabel] = useState<string | null>(() => {
    const cached = moduleItem ? moduleSchemaCache.get(moduleItem.type) : null
    return cached ? cached.label : null
  })
  // IMPORTANT: do not render a nested <form> inside the post editor's <form>.
  const formRef = useRef<HTMLDivElement | null>(null)

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

  const pascalFromType = (t?: string | null) => {
    if (!t || typeof t !== 'string') return ''
    return t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')
  }

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

  const isMountedRef = useRef(false)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fallbackDraftKeys = useMemo(
    () => Object.keys(draft || {}).filter((k) => k !== 'type' && k !== 'properties'),
    [draft]
  )

  const isNoFieldModule = moduleItem?.type === 'reading-progress'

  const syncFormToDraft = useCallback((): Record<string, any> => {
    // Avoid slow JSON stringify/parse for cloning the draft
    const edited = { ...(latestDraft.current || {}) }
    const form = formRef.current
    if (form) {
      const elements = form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input[name], textarea[name], select[name]')
      elements.forEach((el) => {
        const name = el.getAttribute('name')!
        if ((el as HTMLInputElement).type === 'checkbox') {
          setByPath(edited, name, (el as HTMLInputElement).checked)
        } else if ((el as HTMLInputElement).type === 'number') {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.json === '1'
        ) {
          const val = (el as HTMLInputElement).value
          try {
            setByPath(edited, name, val ? JSON.parse(val) : null)
          } catch {
            setByPath(edited, name, val)
          }
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.bool === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === 'true')
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.number === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if ((el as HTMLSelectElement).multiple) {
          const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
          setByPath(edited, name, vals)
        } else {
          setByPath(edited, name, (el as HTMLInputElement).value)
        }
      })
    }
    return edited
  }, [])

  useEffect(() => {
    const currentId = moduleItem?.id
    const prevId = prevModuleItemIdRef.current

    const pendingRef = pendingInputValueRef.current
    const hasPendingForThisModule = pendingRef && pendingRef.rootId === currentId

    // Check if we have pending input value (unsaved changes) for THIS module - if so, NEVER reset
    // This prevents losing edits when parent re-renders after onDirty
    // This check must happen BEFORE the ID check, because we want to preserve edits even if props change
    if (hasPendingForThisModule) {
      // Still update the ref so we don't keep checking
      if (currentId !== prevId) {
        prevModuleItemIdRef.current = currentId
      }
      return
    }

    // Only reset if the ID actually changed (not just a re-render)
    if (currentId === prevId) {
      return
    }

    // Only reset draft if ID actually changed AND we don't have pending edits
    const newDraft = mergeFields(moduleItem.props || {}, moduleItem.overrides || null)

    // Double-check: if we have pending edits, NEVER reset, even if props changed
    // This is a safety check in case the pending ref check above failed
    if (pendingInputValueRef.current && pendingInputValueRef.current.rootId === currentId) {
      prevModuleItemIdRef.current = currentId
      return
    }

    // Compare with current draft - only reset if actually different
    // This prevents unnecessary resets when parent re-renders with same data
    setDraft((prev) => {
      const prevStr = JSON.stringify(prev || {})
      const newStr = JSON.stringify(newDraft)
      if (prevStr === newStr) {
        return prev // No change, keep existing draft
      }
      return newDraft
    })
    setModuleLabel(null)
    prevModuleItemIdRef.current = currentId
  }, [moduleItem?.id]) // Only depend on ID, not props/overrides, to prevent resets when parent re-renders

  useEffect(() => {
    let alive = true
      ; (async () => {
        if (!moduleItem) return
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
            json?.data?.propsSchema ||
            json?.propsSchema ||
            (json?.data?.schema ? json?.data?.schema?.propsSchema : null) ||
            null
          const friendlyName: string | null =
            (json?.data && (json.data.name as string | undefined)) ||
            (json && (json.name as string | undefined)) ||
            null
          if (alive) setModuleLabel(friendlyName || moduleItem.type)
          if (ps && typeof ps === 'object') {
            const fields: CustomFieldDefinition[] = Object.keys(ps).map((k) => {
              const def = (ps as any)[k] || {}
              return { slug: k, ...(def || {}) }
            })
            if (alive) setSchema(fields)
            moduleSchemaCache.set(moduleItem.type, { schema: fields, label: friendlyName || moduleItem.type })
          } else {
            if (alive) setSchema(null)
            moduleSchemaCache.set(moduleItem.type, { schema: null, label: friendlyName || moduleItem.type })
          }
        } catch {
          if (alive) setSchema(null)
        }
      })()
    return () => {
      alive = false
    }
  }, [moduleItem?.type])

  const ctx = useMemo(
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
      fieldAgents,
      viewMode,
      customFields,
      onDirty: () => {
        if (isMountedRef.current && onDirty) onDirty()
      },
    }),
    [
      setDraft,
      fieldComponents,
      supportedFieldTypes,
      syncFormToDraft,
      postId,
      moduleInstanceId,
      moduleItem?.type,
      fieldAgents,
      viewMode,
      customFields,
      onDirty,
    ]
  )

  const collectEdited = useCallback(() => {
    const base = moduleItem?.props || {}
    // Avoid slow JSON stringify/parse for cloning the merged baseline
    const edited = { ...(merged || {}) }
    const form = formRef.current
    if (form) {
      const elements = form.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >('input[name], textarea[name], select[name]')
      elements.forEach((el) => {
        const name = el.getAttribute('name')!
        if ((el as HTMLInputElement).type === 'checkbox') {
          setByPath(edited, name, (el as HTMLInputElement).checked)
        } else if ((el as HTMLInputElement).type === 'number') {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.json === '1'
        ) {
          const val = (el as HTMLInputElement).value
          try {
            setByPath(edited, name, val ? JSON.parse(val) : null)
          } catch {
            setByPath(edited, name, val)
          }
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.bool === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === 'true')
        } else if (
          (el as HTMLInputElement).dataset &&
          (el as HTMLInputElement).dataset.number === '1'
        ) {
          const val = (el as HTMLInputElement).value
          setByPath(edited, name, val === '' ? 0 : Number(val))
        } else if ((el as HTMLSelectElement).multiple) {
          const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
          setByPath(edited, name, vals)
        } else {
          setByPath(edited, name, (el as HTMLInputElement).value)
        }
      })
    }
    const overrides = diffOverrides(base, edited)
    return { overrides, edited }
  }, [merged, moduleItem])

  const saveNow = useCallback(async () => {
    const { overrides, edited } = collectEdited()
    await onSave(overrides, edited)
  }, [collectEdited, onSave])

  useEffect(() => {
    if (!registerFlush) return
    registerFlush(saveNow)
    return () => {
      registerFlush(null)
    }
  }, [registerFlush, saveNow])

  const autosaveTimer = useRef<number | null>(null)
  const signalDirtyTimeoutRef = useRef<number | null>(null)
  // Store the current input value in a ref to preserve it across re-renders
  const pendingInputValueRef = useRef<{ name: string; value: string; rootId: string; cursorPos: number } | null>(null)
  // Track the previous moduleItem.id to detect actual ID changes
  const prevModuleItemIdRef = useRef<string | undefined>(moduleItem?.id)

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current)
        autosaveTimer.current = null
      }
      if (signalDirtyTimeoutRef.current) {
        window.clearTimeout(signalDirtyTimeoutRef.current)
        signalDirtyTimeoutRef.current = null
      }
    }
  }, [])

  // Track the last draft value we restored to prevent infinite loops
  const lastRestoredDraftRef = useRef<{ name: string; value: string } | null>(null)

  // Restore input value and draft after re-renders to prevent first character loss
  // This runs synchronously after DOM mutations but before paint, ensuring we catch any value resets
  useLayoutEffect(() => {
    if (pendingInputValueRef.current) {
      const { name, value, rootId, cursorPos } = pendingInputValueRef.current
      const el = formRef.current?.querySelector(
        `[name="${name}"][data-root-id="${rootId}"]`
      ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null

      // Restore input value if it was reset
      if (el && el.value !== value) {
        el.value = value
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.setSelectionRange(cursorPos, cursorPos)
        }
      }

      // Restore draft if it was reset (this happens after onDirty triggers parent re-renders)
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

        // Also restore the input value
        if (el && el.value !== value) {
          el.value = value
          if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.setSelectionRange(cursorPos, cursorPos)
          }
        }
      } else if (currentDraftValue === value && lastRestored?.name === name) {
        // Draft matches, clear the restoration tracking
        lastRestoredDraftRef.current = null
      }

      // Keep ref active for 1 second to handle all re-render cascades after onDirty
      // Only clear if draft matches and has been stable
      const timeoutId = window.setTimeout(() => {
        if (pendingInputValueRef.current?.name === name) {
          const finalDraftValue = draft ? draft[name] : undefined
          if (finalDraftValue === value) {
            pendingInputValueRef.current = null
            lastRestoredDraftRef.current = null
          }
        }
      }, 1000)

      return () => window.clearTimeout(timeoutId)
    }
  }, [draft])

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
          // Keep local draft in sync while typing so parent rerenders don't "wipe" in-progress edits.
          // IMPORTANT: do NOT call onSave here (that would churn parent state and steal focus).
          try {
            // Use the event target, not document.activeElement. Focus can temporarily move during the first edit,
            // and using activeElement can miss the correct input (causing the first character to be lost).
            const el = e.target as
              | HTMLInputElement
              | HTMLTextAreaElement
              | HTMLSelectElement
              | null
            const name = el?.getAttribute?.('name') || ''
            const rootId = el?.getAttribute?.('data-root-id') || ''
            if (!name) return

            // Capture the current input value IMMEDIATELY to preserve it across re-renders
            // This must happen before any state updates that might trigger re-renders
            const currentValue = (el as HTMLInputElement | HTMLTextAreaElement).value || ''

            // Prevent processing if this is a programmatic change (not user input)
            // Check if the value matches what we already have stored
            const storedValue = pendingInputValueRef.current?.name === name &&
              pendingInputValueRef.current?.rootId === rootId
              ? pendingInputValueRef.current.value
              : null
            if (storedValue !== null && currentValue === storedValue) {
              return
            }

            const cursorPos = el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement
              ? el.selectionStart ?? currentValue.length
              : currentValue.length

            // Store the value in a ref that persists across re-renders
            // This is the last line of defense against value loss
            if (rootId) {
              pendingInputValueRef.current = { name, value: currentValue, rootId, cursorPos }
            }

            // Update draft state - let React batch naturally for better performance during fast typing.
            // The pendingInputValueRef + useLayoutEffect still provide safety if a re-render resets the DOM.
            setDraft((prev) => {
              const next = { ...(prev || {}) }
              // Match syncFormToDraft coercions, but only for the changed field for performance.
              if ((el as HTMLInputElement).type === 'checkbox') {
                setByPath(next, name, (el as HTMLInputElement).checked)
              } else if ((el as HTMLInputElement).type === 'number') {
                const val = (el as HTMLInputElement).value
                setByPath(next, name, val === '' ? 0 : Number(val))
              } else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.json === '1') {
                const val = (el as HTMLInputElement).value
                try {
                  setByPath(next, name, val ? JSON.parse(val) : null)
                } catch {
                  setByPath(next, name, val)
                }
              } else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.bool === '1') {
                const val = (el as HTMLInputElement).value
                setByPath(next, name, val === 'true')
              } else if ((el as HTMLInputElement).dataset && (el as HTMLInputElement).dataset.number === '1') {
                const val = (el as HTMLInputElement).value
                setByPath(next, name, val === '' ? 0 : Number(val))
              } else if ((el as HTMLSelectElement).multiple) {
                const vals = Array.from((el as HTMLSelectElement).selectedOptions).map((o) => o.value)
                setByPath(next, name, vals)
              } else {
                // Use the captured value to ensure we have the latest
                setByPath(next, name, currentValue)
              }
              return next
            })

            // Signal dirty with a longer delay to avoid parent re-renders while the user is still typing.
            // A 400ms delay ensures that for fast typing, the parent re-render happens after the word is done.
              if (onDirty) {
              if (signalDirtyTimeoutRef.current) window.clearTimeout(signalDirtyTimeoutRef.current)
                signalDirtyTimeoutRef.current = window.setTimeout(() => {
                  signalDirtyTimeoutRef.current = null
                  onDirty()
                }, 400)
            }
          } catch {
            /* ignore */
          }
        }}
        onBlurCapture={() => {
          if (!autoSaveOnBlur) return
          if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current)
          autosaveTimer.current = window.setTimeout(() => {
            saveNow()
          }, 250)
        }}
      >
        <fieldset disabled={processing || moduleItem.scope === 'global'} className={moduleItem.scope === 'global' ? 'opacity-60' : ''}>
          {schema && schema.length > 0 ? (
            (() => {
              const groups: Record<string, CustomFieldDefinition[]> = {}
              schema.forEach((f) => {
                const cat = f.category || 'General'
                if (!groups[cat]) groups[cat] = []
                groups[cat].push(f)
              })

              return Object.entries(groups).map(([category, fields]) => (
                <div key={category} className="mb-8 space-y-4">
                  {category !== 'General' && (
                    <h4 className="text-[11px] font-bold text-neutral-medium uppercase tracking-wider border-b border-line-low pb-2 mb-4">
                      {category}
                    </h4>
                  )}
                  <div className="space-y-4">
                    {fields.map((f) => {
                      const fieldName = f.slug
                      const pendingRef = pendingInputValueRef.current
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
              ))
            })()
          ) : isNoFieldModule || fallbackDraftKeys.length === 0 ? (
            <p className="text-sm text-neutral-low">No editable fields.</p>
          ) : (
            fallbackDraftKeys.map((key) => {
              const rawVal = draft[key]
              if (key === 'content') {
                let initial: any = undefined
                if (isPlainObject(rawVal)) {
                  initial = rawVal
                } else if (typeof rawVal === 'string') {
                  try {
                    const parsed = JSON.parse(rawVal)
                    initial = parsed
                  } catch {
                    initial = undefined
                  }
                }
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">{key}</label>
                    {(fieldComponents as Record<string, any>)['RichtextField'] ? (
                      (fieldComponents as Record<string, any>)['RichtextField']({
                        editorKey: `${moduleItem.id}:${key}`,
                        value: initial,
                        onChange: (json: any) => {
                          const hidden =
                            (formRef.current?.querySelector(
                              `input[type="hidden"][name="${key}"]`
                            ) as HTMLInputElement) || null
                          if (hidden) {
                            try {
                              hidden.value = JSON.stringify(json)
                              hidden.dispatchEvent(new Event('input', { bubbles: true }))
                              hidden.dispatchEvent(new Event('change', { bubbles: true }))
                            } catch {
                              /* ignore */
                            }
                          }
                          const next = JSON.parse(JSON.stringify(draft))
                          setByPath(next, key, json)
                          setDraft(next)
                          ctx.onDirty?.()
                        },
                      })
                    ) : (
                      <LexicalEditor
                        editorKey={`${moduleItem.id}:${key}`}
                        value={initial}
                        onChange={(json) => {
                          const hidden =
                            (formRef.current?.querySelector(
                              `input[type="hidden"][name="${key}"]`
                            ) as HTMLInputElement) || null
                          if (hidden) {
                            try {
                              hidden.value = JSON.stringify(json)
                              hidden.dispatchEvent(new Event('input', { bubbles: true }))
                              hidden.dispatchEvent(new Event('change', { bubbles: true }))
                            } catch {
                              /* ignore */
                            }
                          }
                          const next = JSON.parse(JSON.stringify(draft))
                          setByPath(next, key, json)
                          setDraft(next)
                          ctx.onDirty?.()
                        }}
                      />
                    )}
                    <input
                      type="hidden"
                      name={key}
                      data-json="1"
                      defaultValue={
                        isPlainObject(rawVal)
                          ? JSON.stringify(rawVal)
                          : typeof rawVal === 'string'
                            ? rawVal
                            : ''
                      }
                    />
                  </div>
                )
              }
              const val = rawVal
              if (isPlainObject(val) || Array.isArray(val)) {
                return (
                  <div key={key}>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">{key}</label>
                    <textarea
                      className="w-full px-3 py-2 min-h-[140px] border border-border rounded-lg bg-backdrop-low text-neutral-high font-mono text-xs focus:ring-1 ring-ring focus:border-transparent"
                      defaultValue={JSON.stringify(val, null, 2)}
                      onBlur={(e) => {
                        try {
                          const parsed = JSON.parse(e.target.value || 'null')
                          const next = JSON.parse(JSON.stringify(draft))
                          setByPath(next, key, parsed)
                          setDraft(next)
                        } catch {
                          toast.error('Invalid JSON')
                        }
                      }}
                    />
                    <p className="text-xs text-neutral-low mt-1">Edit JSON directly.</p>
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
                        typeof val === 'number'
                          ? 'number'
                          : typeof val === 'boolean'
                            ? 'boolean'
                            : 'text',
                    } as any
                  }
                  value={val}
                  rootId={moduleItem.id}
                  ctx={ctx}
                />
              )
            })
          )}
        </fieldset>

        <div className="flex items-center justify-end gap-2 border-t border-line-low pt-4">
          <button
            type="button"
            className="px-3 py-1.5 text-xs rounded border border-line-medium text-neutral-high hover:bg-backdrop-medium"
            onClick={saveNow}
            disabled={processing || moduleItem.scope === 'global'}
            title={moduleLabel ? `Apply changes to ${moduleLabel}` : 'Apply changes'}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
})

// --------------------------------------------------------------------------
// Global cache for media metadata to avoid N fetches for the same ID across modules
// --------------------------------------------------------------------------
const mediaMetadataCache = new Map<string, any>()
const mediaMetadataLoading = new Map<string, Promise<any>>()
const mediaMetadata404 = new Set<string>()

const DateFieldInternal = memo(({
  name,
  label,
  rootId,
  hideLabel,
  initial,
  ctx,
}: {
  name: string
  label: string
  rootId: string
  hideLabel: boolean
  initial: string
  ctx: EditorFieldCtx
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
    <FormField>
      {!hideLabel && <FormLabel>{label}</FormLabel>}
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
              ctx.setByPath(next, name, formatDate(val))
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
})

const SliderFieldInternal = memo(({
  name,
  label,
  value,
  rootId,
  hideLabel,
  field,
  ctx,
}: {
  name: string
  label: string
  value: any
  rootId: string
  hideLabel: boolean
  field: any
  ctx: EditorFieldCtx
}) => {
  const min = field.min ?? 0
  const max = field.max ?? 100
  const step = field.step ?? 1
  const unit = field.unit ?? ''
  const current = typeof value === 'number' ? value : min
  const [val, setVal] = useState<number>(current)
  const hiddenRef = useRef<HTMLInputElement | null>(null)

  return (
    <FormField>
      {!hideLabel && <FormLabel>{label}</FormLabel>}
      <Slider
        defaultValue={[current]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => {
          const n = Array.isArray(v) ? (v[0] ?? min) : min
          setVal(n)
          const next = { ...(ctx.latestDraft.current || {}) }
          ctx.setByPath(next, name, n)
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
})

const MediaFieldInternal = memo(({
  name,
  label,
  value,
  hideLabel,
  field,
  ctx,
}: {
  name: string
  label: string
  value: any
  hideLabel: boolean
  field: any
  ctx: EditorFieldCtx
}) => {
  type ModalMediaItem = {
    id: string
    url: string
    mimeType?: string
    originalFilename?: string
    alt?: string | null
  }
  const storeAsId = field.storeAs === 'id' || field.store === 'id'
  const [modalOpen, setModalOpen] = useState(false)
  const [agentModalOpen, setAgentModalOpen] = useState(false)
  const [selectedFieldAgent, setSelectedFieldAgent] = useState<Agent | null>(null)
  const [preSelectedMediaId, setPreSelectedMediaId] = useState<string | null>(null)
  const hiddenRef = useRef<HTMLInputElement | null>(null)
  const displayRef = useRef<HTMLInputElement | null>(null)
  const currentVal = typeof value === 'string' ? value : (value?.id || '')
  const [preview, setPreview] = useState<ModalMediaItem | null>(null)

  const matchingAgents = ctx.fieldAgents.filter((agent: any) => {
    return agent.scopes?.some((scope: any) => {
      if (scope.scope !== 'field' || !scope.enabled) return false
      if (Array.isArray(scope.fieldTypes) && scope.fieldTypes.length > 0) {
        return scope.fieldTypes.includes('media')
      }
      return true
    })
  })

  const [mediaData, setMediaData] = useState<{
    baseUrl: string
    mimeType?: string
    variants: MediaVariant[]
    darkSourceUrl?: string
    playMode?: 'autoplay' | 'inline' | 'modal'
  } | null>(null)
  const [localPlayMode, setLocalPlayMode] = useState<'autoplay' | 'inline' | 'modal'>('autoplay')
  const isDark = useIsDarkMode()

  useEffect(() => {
    if (!storeAsId || !currentVal || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentVal)) {
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
            promise = fetch(`/api/media/${encodeURIComponent(currentVal)}`, { credentials: 'same-origin' })
              .then(res => {
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
          }
          const meta = j.data.metadata || {}
          const variants: MediaVariant[] = Array.isArray(meta?.variants) ? meta.variants : []
          const darkSourceUrl = typeof meta.darkSourceUrl === 'string' ? meta.darkSourceUrl : undefined
          const playMode = meta.playMode || 'autoplay'
          const mData = { baseUrl: j.data.url, mimeType: j.data.mimeType, variants, darkSourceUrl, playMode }

          mediaMetadataCache.set(currentVal, { item, mediaData: mData })
          mediaMetadataLoading.delete(currentVal)

          if (alive) {
            setPreview(item)
            setMediaData(mData)
            setLocalPlayMode(playMode)
            // Trigger a re-render of the editor so showIf conditions can re-evaluate
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
    return () => { alive = false }
  }, [storeAsId, currentVal])

  const displayUrl = useMemo(() => {
    if (!preview) return null
    if (!mediaData) return preview.url
    return pickMediaVariantUrl(mediaData.baseUrl, mediaData.variants, 'thumb', {
      darkSourceUrl: mediaData.darkSourceUrl,
    })
  }, [preview, mediaData, isDark])

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

      // Update cache
      const cached = mediaMetadataCache.get(preview.id)
      if (cached) {
        cached.mediaData.playMode = val
        mediaMetadataCache.set(preview.id, cached)
      }
      toast.success('Video play mode saved')
      // Trigger a re-render
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
      ctx.setByPath(next, name, storeAsId ? m.id : m.url)
      return next
    })
    if (ctx.onDirty) ctx.onDirty()
    setPreview(m)
    if (m.mimeType) {
      const meta = (m as any).metadata || {}
      const playMode = meta.playMode || 'autoplay'
      setMediaData({
        baseUrl: m.url,
        mimeType: m.mimeType,
        variants: meta.variants || [],
        darkSourceUrl: meta.darkSourceUrl,
        playMode,
      })
      setLocalPlayMode(playMode)
    } else {
      setMediaData(null)
    }
  }

  const fieldKey = ctx.moduleType && ctx.postId ? `module.${ctx.moduleType}.${name}` : undefined

  return (
    <FormField className="group">
      <div className="flex items-center justify-between">
        {!hideLabel && <FormLabel>{label}</FormLabel>}
        {matchingAgents.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelectedFieldAgent(matchingAgents[0])
              setAgentModalOpen(true)
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded hover:bg-backdrop-medium text-primary"
            title="AI Assistant"
          >
            <FontAwesomeIcon icon={faWandMagicSparkles} className="text-sm" />
          </button>
        )}
      </div>
      <div className="flex items-start gap-3">
        <div className="min-w-[72px]">
          {preview ? (
            <div className="w-[72px] h-[72px] border border-line-medium rounded overflow-hidden bg-backdrop-medium">
              <MediaRenderer
                url={displayUrl || preview.url}
                mimeType={mediaData?.mimeType}
                alt={preview?.alt || preview?.originalFilename || ''}
                className="w-full h-full object-cover"
                key={`${displayUrl}-${isDark}`}
                controls={false}
                autoPlay={false}
                playMode={mediaData?.mimeType?.startsWith('video/') ? (mediaData as any).playMode : undefined}
              />
            </div>
          ) : (
            <div className="w-[72px] h-[72px] border border-dashed border-line-high rounded flex items-center justify-center text-[10px] text-neutral-medium">
              No media
            </div>
          )}
        </div>
        <div className="flex-1">
          {storeAsId ? (
            <>
              <input type="hidden" name={name} defaultValue={currentVal} ref={hiddenRef} />
              <input type="text" defaultValue={currentVal} ref={displayRef} className="hidden" readOnly />
            </>
          ) : (
            <Input
              type="text"
              name={name}
              defaultValue={value ?? ''}
              ref={displayRef}
              placeholder={field.placeholder || 'https://...'}
            />
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
              onClick={() => setModalOpen(true)}
            >
              {preview ? 'Change' : 'Choose'}
            </button>
            {preview && (
              <button
                type="button"
                className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                onClick={() => applySelection({ id: '', url: '', originalFilename: '', alt: '' })}
              >
                Clear
              </button>
            )}
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
          onOpenChange={(open) => {
            setModalOpen(open)
            if (!open) setPreSelectedMediaId(null)
          }}
          initialSelectedId={storeAsId ? preSelectedMediaId || currentVal || undefined : undefined}
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
              fieldKey,
              fieldType: 'media',
              moduleInstanceId: ctx.moduleInstanceId,
            }}
            scope="field"
            fieldKey={fieldKey}
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
    </FormField>
  )
})

const IconFieldInternal = memo(({
  name,
  label,
  value,
  rootId,
  hideLabel,
  ctx,
}: {
  name: string
  label: string
  value: any
  rootId: string
  hideLabel: boolean
  ctx: EditorFieldCtx
}) => {
  const initial = typeof value === 'string' ? value : ''
  const [selectedIcon, setSelectedIcon] = useState<string>(initial)
  const [pickerOpen, setPickerOpen] = useState(false)
  const hiddenRef = useRef<HTMLInputElement | null>(null)

  return (
    <FormField>
      {!hideLabel && <FormLabel>{label}</FormLabel>}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium flex items-center gap-2"
          >
            {selectedIcon && iconMap[selectedIcon] ? (
              <>
                <FontAwesomeIcon icon={iconMap[selectedIcon]} className="w-4 h-4" />
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
              <button
                key={iconItem.name}
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
                    ctx.setByPath(next, name, iconItem.name)
                    return next
                  })
                  ctx.onDirty?.()
                  setPickerOpen(false)
                }}
                title={iconItem.label}
              >
                <FontAwesomeIcon icon={iconItem.icon} className="w-6 h-6" />
                <span className="text-[10px] text-neutral-low truncate w-full text-center">
                  {iconItem.label}
                </span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <input type="hidden" name={name} ref={hiddenRef} defaultValue={initial} data-root-id={rootId} />
    </FormField>
  )
})

const PostReferenceFieldInternal = memo(({
  name,
  label,
  value,
  rootId,
  hideLabel,
  field,
  ctx,
}: {
  name: string
  label: string
  value: any
  rootId: string
  hideLabel: boolean
  field: any
  ctx: EditorFieldCtx
}) => {
  // Normalize allowed types from field (support singular postType or plural postTypes)
  const allowedTypes: string[] = Array.isArray(field.postTypes)
    ? field.postTypes
    : field.postType
      ? [String(field.postType)]
      : []

  // Normalize allowMultiple from field (support multiple or allowMultiple)
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
        ctx.setByPath(next, name, allowMultiple ? vals : (vals[0] ?? null))
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
          // In the admin, we usually want to be able to refer to any post that isn't archived/deleted
          params.set('limit', '100')
          params.set('sortBy', 'updated_at')
          params.set('sortOrder', 'desc')
          if (allowedTypes.length > 0) params.set('types', allowedTypes.join(','))
          const r = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const j = await r.json().catch(() => ({}))
          if (alive) setOptions((j?.data || []).map((p: any) => ({ label: p.title || p.id, value: p.id })))
        } catch {
          if (alive) setOptions([])
        }
      })()
    return () => { alive = false }
  }, [allowedTypes.join(',')])

  const filteredOptions = query.trim() === '' ? options : options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <FormField>
      {!hideLabel && <FormLabel>{label}</FormLabel>}
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
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-backdrop-medium p-1 rounded">
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
})

const FormReferenceFieldInternal = memo(({
  name,
  label,
  value,
  rootId,
  hideLabel,
  ctx,
}: {
  name: string
  label: string
  value: any
  rootId: string
  hideLabel: boolean
  ctx: EditorFieldCtx
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
          if (alive) setOptions((j?.data || []).map((f: any) => ({ value: String(f.slug), label: f.title || f.slug })))
        } catch {
          if (alive) setOptions([])
        }
      })()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (hiddenRef.current) {
      if (hiddenRef.current.value !== (current || '')) {
      hiddenRef.current.value = current || ''
      hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
      hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
        
        const next = { ...(ctx.latestDraft.current || {}) }
        ctx.setByPath(next, name, current || null)
        ctx.setDraft(next)
        ctx.onDirty?.()
      }
    }
  }, [current])

  return (
    <FormField>
      {!hideLabel && <FormLabel>{label}</FormLabel>}
      <Select defaultValue={initial || undefined} onValueChange={setCurrent}>
        <SelectTrigger>
          <SelectValue placeholder="Select a form" />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} defaultValue={initial} ref={hiddenRef} data-root-id={rootId} />
    </FormField>
  )
})

const SelectFieldInternal = memo(({
  name,
  label,
  value,
  rootId,
  hideLabel,
  field,
  type,
}: {
  name: string
  label: string
  value: any
  rootId: string
  hideLabel: boolean
  field: any
  type: string
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
            if (alive) setDynamicOptions((j?.data || []).map((t: string) => ({ label: t, value: t })))
          }
        } catch { }
      })()
    return () => { alive = false }
  }, [optionsSource, dynamicOptions.length])

  if (!isMulti) {
    const initial = typeof value === 'string' ? value : ''
    const hiddenRef = useRef<HTMLInputElement | null>(null)
    return (
      <FormField>
        {!hideLabel && <FormLabel>{label}</FormLabel>}
        <Select
          defaultValue={initial || undefined}
          onValueChange={(val) => {
            if (hiddenRef.current) {
              hiddenRef.current.value = val ?? ''
              hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
              hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
              
              const next = { ...(ctx.latestDraft.current || {}) }
              ctx.setByPath(next, name, val || null)
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
              <SelectItem key={opt.value} value={opt.value}>{opt.label ?? opt.value}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input type="hidden" name={name} defaultValue={initial} ref={hiddenRef} data-root-id={rootId} />
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
        ctx.setByPath(next, name, vals)
        ctx.setDraft(next)
        ctx.onDirty?.()
      }
      }
    }, [vals])
    return (
      <FormField>
        {!hideLabel && <FormLabel>{label}</FormLabel>}
        {vals.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {vals.map((v) => (
              <button
                key={v}
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-backdrop-low border border-border px-3 py-1 text-sm text-neutral-high hover:bg-backdrop-medium"
                onClick={() => setVals((prev) => prev.filter((x) => x !== v))}
              >
                <span>{dynamicOptions.find((o) => o.value === v)?.label ?? v}</span>
                <span className="text-neutral-low">✕</span>
              </button>
            ))}
          </div>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="w-full text-left px-3 py-2 border border-border rounded-lg bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
            >
              {vals.length === 0 ? 'Select options' : 'Edit selection'}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <div className="space-y-2">
              {dynamicOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer hover:bg-backdrop-medium p-1 rounded">
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
          </PopoverContent>
        </Popover>
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
})

const BooleanFieldInternal = memo(({
  name,
  label,
  value,
  rootId,
  ctx,
}: {
  name: string
  label: string
  value: any
  rootId: string
  ctx: EditorFieldCtx
}) => {
  const hiddenRef = useRef<HTMLInputElement | null>(null)
  const checked = !!value

  useEffect(() => {
    if (hiddenRef.current) {
      hiddenRef.current.value = checked ? 'true' : 'false'
    }
  }, [checked])

  return (
    <div className="flex items-center gap-2">
      <Checkbox
        checked={checked}
        onCheckedChange={(c) => {
          if (hiddenRef.current) {
            hiddenRef.current.value = c ? 'true' : 'false'
            hiddenRef.current.dispatchEvent(new Event('input', { bubbles: true }))
            hiddenRef.current.dispatchEvent(new Event('change', { bubbles: true }))
          }
          ctx.setDraft((prev) => {
            const next = { ...(prev || {}) }
            ctx.setByPath(next, name, !!c)
            return next
          })
        }}
        id={`${rootId}:${name}`}
      />
      <label htmlFor={`${rootId}:${name}`} className="text-sm text-neutral-high cursor-pointer">
        {label}
      </label>
      <input
        ref={hiddenRef}
        type="hidden"
        name={name}
        defaultValue={checked ? 'true' : 'false'}
        data-bool="1"
        data-root-id={rootId}
      />
    </div>
  )
})

const FieldPrimitiveInternal = memo(({
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
  const label = hideLabel ? '' : ctx.getLabel(path, field)
  const type = (field as any).type as string

  const maybeRenderComponent = () => {
    const compName = `${ctx.pascalFromType(type)}Field`
    const Renderer = (ctx.fieldComponents as Record<string, any>)[compName]
    if (!Renderer || !ctx.supportedFieldTypes.has(type)) return null

    const hiddenRef = useRef<HTMLInputElement | null>(null)
    const cfg = field as any
    const handleChange = (val: any) => {
      try {
        const next = { ...(ctx.latestDraft.current || {}) }
        ctx.setByPath(next, name, val)
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
      // Standard schema props that might leak
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
    // Ensure visible controls are uniquely targetable for focus restoration (multiple modules can share field names).
    props.name = name
    props['data-root-id'] = rootId
    if (type === 'richtext') props.editorKey = `${rootId}:${name}`
    if (type === 'select') props.options = Array.isArray(cfg.options) ? cfg.options : []
    if (type === 'multiselect') {
      props.options = Array.isArray(cfg.options) ? cfg.options : []
      props.multiple = true
    }
    if (type === 'taxonomy') props.taxonomySlug = cfg.taxonomySlug

    return (
      <FormField>
        {!hideLabel && <FormLabel>{label}</FormLabel>}
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
        />
      </FormField>
    )
  }

  const rendered = maybeRenderComponent()
  if (rendered) return rendered

  if (type === 'date') {
    return (
      <DateFieldInternal
        name={name}
        label={label}
        rootId={rootId}
        hideLabel={hideLabel}
        initial={typeof value === 'string' ? value : ''}
      />
    )
  }
  if (type === 'slider') {
    return (
      <SliderFieldInternal
        name={name}
        label={label}
        value={value}
        rootId={rootId}
        hideLabel={hideLabel}
        field={field}
      />
    )
  }
  if (type === 'textarea') {
    return (
      <FormField>
        {!hideLabel && <FormLabel>{label}</FormLabel>}
        <TokenField
          type="textarea"
          name={name}
          value={value ?? ''}
          onChange={(val) => {
            const next = { ...(ctx.latestDraft.current || {}) }
            ctx.setByPath(next, name, val)
            ctx.setDraft(next)
            ctx.onDirty?.()
          }}
          data-root-id={rootId}
          customFields={ctx.customFields}
        />
      </FormField>
    )
  }
  if (type === 'media') {
    return (
      <MediaFieldInternal
        name={name}
        label={label}
        value={value}
        hideLabel={hideLabel}
        field={field}
        ctx={ctx}
      />
    )
  }
  if (type === 'icon') {
    return (
      <IconFieldInternal
        name={name}
        label={label}
        value={value}
        rootId={rootId}
        hideLabel={hideLabel}
        ctx={ctx}
      />
    )
  }
  if (type === 'number') {
    return (
      <FormField>
        {!hideLabel && <FormLabel>{label}</FormLabel>}
        <Input type="number" name={name} defaultValue={value ?? 0} data-root-id={rootId} />
      </FormField>
    )
  }
  if (type === 'post-reference') {
    return (
      <PostReferenceFieldInternal
        name={name}
        label={label}
        value={value}
        rootId={rootId}
        hideLabel={hideLabel}
        field={field}
      />
    )
  }
  if (type === 'form-reference') {
    return (
      <FormReferenceFieldInternal
        name={name}
        label={label}
        value={value}
        rootId={rootId}
        hideLabel={hideLabel}
      />
    )
  }
  if (type === 'select' || type === 'multiselect') {
    return (
      <SelectFieldInternal
        name={name}
        label={label}
        value={value}
        rootId={rootId}
        hideLabel={hideLabel}
        field={field}
        type={type}
      />
    )
  }
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
  if (type === 'boolean') {
    return (
      <BooleanFieldInternal
        name={name}
        label={label}
        value={value}
        rootId={rootId}
        ctx={ctx}
      />
    )
  }
  // text, url fallback to text input
  return (
    <FormField>
      {!hideLabel && <FormLabel>{label}</FormLabel>}
      <TokenField
        type="text"
        name={name}
        placeholder={(field as any).placeholder || ''}
        value={value ?? ''}
        onChange={(val) => {
          const next = { ...(ctx.latestDraft.current || {}) }
          ctx.setByPath(next, name, val)
          ctx.setDraft(next)
        }}
        data-root-id={rootId}
        customFields={ctx.customFields}
      />
    </FormField>
  )
})

const FieldBySchemaInternal = memo(({
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
    const depValue = ctx.getByPath(ctx.latestDraft.current, depPath)

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
  const label = ctx.getLabel(path, field)
  if (type === 'object') {
    // Support both `fields: CustomFieldDefinition[]` and `properties: { [key]: schema }`
    const rawFields: any = (field as any).fields
    let objectFields: CustomFieldDefinition[] | null = null

    if (Array.isArray(rawFields)) {
      objectFields = rawFields as CustomFieldDefinition[]
    } else if ((field as any).properties && typeof (field as any).properties === 'object') {
      const props = (field as any).properties as Record<string, any>
      objectFields = Object.keys(props).map((propName) => {
        const def = props[propName] || {}
        return { slug: propName, ...(def as any) } as CustomFieldDefinition
      })
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

    // Support "array + items.properties" shape from backend by mapping to a repeater item schema
    if (!itemSchema && rawItemsDef) {
      const itemsType = (rawItemsDef as any).type
      const props = (rawItemsDef as any).properties
      if (itemsType === 'object' && props && typeof props === 'object') {
        const fields: CustomFieldDefinition[] = Object.keys(props).map((propName) => {
          const def = (props as any)[propName] || {}
          return { slug: propName, ...(def || {}) }
        })
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
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const scroller = ctx.formRef.current
                    const prevScrollTop = scroller ? scroller.scrollTop : 0
                    const next = ctx.syncFormToDraft()
                    const currentValue = ctx.getByPath(next, name)
                    const arr = Array.isArray(currentValue) ? [...currentValue] : []
                    arr.splice(idx, 1)
                    ctx.setByPath(next, name, arr)
                    ctx.setDraft(next)
                    ctx.onDirty?.()
                    requestAnimationFrame(() => {
                      if (scroller) scroller.scrollTop = prevScrollTop
                    })
                  }}
                >
                  Remove
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (idx === 0) return
                    const scroller = ctx.formRef.current
                    const prevScrollTop = scroller ? scroller.scrollTop : 0
                    const next = ctx.syncFormToDraft()
                    const currentValue = ctx.getByPath(next, name)
                    const arr = Array.isArray(currentValue) ? [...currentValue] : []
                    const [moved] = arr.splice(idx, 1)
                    arr.splice(idx - 1, 0, moved)
                    ctx.setByPath(next, name, arr)
                    ctx.setDraft(next)
                    ctx.onDirty?.()
                    requestAnimationFrame(() => {
                      if (scroller) scroller.scrollTop = prevScrollTop
                    })
                  }}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (idx >= items.length - 1) return
                    const scroller = ctx.formRef.current
                    const prevScrollTop = scroller ? scroller.scrollTop : 0
                    const next = ctx.syncFormToDraft()
                    const currentValue = ctx.getByPath(next, name)
                    const arr = Array.isArray(currentValue) ? [...currentValue] : []
                    const [moved] = arr.splice(idx, 1)
                    arr.splice(idx + 1, 0, moved)
                    ctx.setByPath(next, name, arr)
                    ctx.setDraft(next)
                    ctx.onDirty?.()
                    requestAnimationFrame(() => {
                      if (scroller) scroller.scrollTop = prevScrollTop
                    })
                  }}
                >
                  Down
                </button>
              </div>
              {itemSchema ? (
                <>
                  {(itemSchema as any).type === 'object' &&
                    Array.isArray((itemSchema as any).fields) ? (
                    <>
                      {((itemSchema as any).fields as CustomFieldDefinition[]).map((f) => (
                        <FieldBySchemaInternal
                          key={`${name}.${idx}.${f.slug}`}
                          path={[...path, String(idx), f.slug]}
                          field={f}
                          value={it ? it[f.slug] : undefined}
                          rootId={rootId}
                          ctx={ctx}
                        />
                      ))}
                    </>
                  ) : (
                    <FieldBySchemaInternal
                      path={[...path, String(idx)]}
                      field={{ ...itemSchema, slug: String(idx), hideLabel: true } as any}
                      value={it}
                      rootId={rootId}
                      ctx={ctx}
                    />
                  )}
                </>
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
            className="px-3 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const scroller = ctx.formRef.current
              const prevScrollTop = scroller ? scroller.scrollTop : 0
              const next = ctx.syncFormToDraft()
              const currentValue = ctx.getByPath(next, name)
              const arr = Array.isArray(currentValue) ? [...currentValue] : []
              // Create an empty item based on schema
              let empty: any = ''
              if (itemSchema) {
                const t = (itemSchema as any).type
                if (t === 'object' && Array.isArray((itemSchema as any).fields)) {
                  empty = {}
                    ; (itemSchema as any).fields.forEach((f: any) => {
                      empty[f.slug] = f.type === 'number' ? 0 : f.type === 'boolean' ? false : ''
                    })
                } else if (t === 'number') {
                  empty = 0
                } else if (t === 'boolean') {
                  empty = false
                } else if (t === 'multiselect') {
                  empty = []
                } else {
                  empty = ''
                }
              }
              arr.push(empty)
              ctx.setByPath(next, name, arr)
              ctx.setDraft(next)
              ctx.onDirty?.()
              requestAnimationFrame(() => {
                if (scroller) scroller.scrollTop = prevScrollTop
              })
            }}
          >
            Add Item
          </button>
        </div>
      </fieldset>
    )
  }
  // primitive field types
  return (
    <FieldPrimitiveInternal path={path} field={field} value={value} rootId={rootId} ctx={ctx} />
  )
})
