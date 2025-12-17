/**
 * Admin Post Editor
 *
 * Main editing interface for posts with modules, translations, and metadata.
 */

import { useForm, usePage, router } from '@inertiajs/react'
import { AdminHeader } from '../../components/AdminHeader'
import { AdminFooter } from '../../components/AdminFooter'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Badge } from '~/components/ui/badge'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'
import { ModulePicker } from '../../components/modules/ModulePicker'
import { FormEvent, memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { humanizeSlug } from '~/utils/strings'
import type { CustomFieldType } from '~/types/custom_field'
import { ModuleEditorInline, prefetchModuleSchemas } from '../../components/modules/ModuleEditorPanel'
import { MediaPickerModal } from '../../components/media/MediaPickerModal'
import { Popover, PopoverTrigger, PopoverContent } from '~/components/ui/popover'
import { Calendar } from '~/components/ui/calendar'
import { Checkbox } from '~/components/ui/checkbox'
import { Spinner } from '~/components/ui/spinner'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Star } from 'lucide-react'
import { DragHandle } from '../../components/ui/DragHandle'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReact } from '@fortawesome/free-brands-svg-icons'
import { faGlobe, faWandMagicSparkles } from '@fortawesome/free-solid-svg-icons'
import { getXsrf } from '~/utils/xsrf'
import { LinkField, type LinkFieldValue } from '~/components/forms/LinkField'
import { useHasPermission } from '~/utils/permissions'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'
import { AgentModal, type Agent } from '../../components/agents/AgentModal'
// Field components are auto-discovered via Vite glob below

const flattenTerms = (
  nodes: TaxonomyTermNode[],
  prefix = ''
): Array<{ id: string; label: string }> => {
  const out: Array<{ id: string; label: string }> = []
  for (const node of nodes) {
    const label = prefix ? `${prefix} › ${node.name}` : node.name
    out.push({ id: node.id, label })
    if (Array.isArray(node.children) && node.children.length > 0) {
      out.push(...flattenTerms(node.children, label))
    }
  }
  return out
}

type TaxonomyTermNode = {
  id: string
  slug: string
  name: string
  children?: TaxonomyTermNode[]
}

const InlineModuleEditor = memo(function InlineModuleEditor({
  module,
  postId,
  viewMode,
  fieldAgents,
  registerFlush,
  onStage,
  onMarkDirty,
}: {
  module: {
    id: string
    moduleInstanceId: string
    type: string
    scope: string
    props: Record<string, any>
    overrides?: Record<string, any> | null
    locked: boolean
    orderIndex: number
  }
  postId: string
  viewMode: 'source' | 'review' | 'ai-review'
  fieldAgents: Agent[]
  registerFlush: (moduleId: string, flush: (() => Promise<void>) | null) => void
  onStage: (moduleId: string, overrides: Record<string, any> | null, edited: Record<string, any>) => void
  onMarkDirty: (mode: 'source' | 'review' | 'ai-review', moduleId: string) => void
}) {
  const onDirty = useCallback(() => onMarkDirty(viewMode, module.id), [onMarkDirty, viewMode, module.id])
  const onSave = useCallback(
    (overrides: Record<string, any> | null, edited: Record<string, any>) =>
      onStage(module.id, overrides, edited),
    [onStage, module.id]
  )
  const onRegisterFlush = useCallback(
    (flush: (() => Promise<void>) | null) => registerFlush(module.id, flush),
    [registerFlush, module.id]
  )

  return (
    <ModuleEditorInline
      moduleItem={{
        id: module.id,
        moduleInstanceId: module.moduleInstanceId,
        type: module.type,
        scope: module.scope,
        props: module.props || {},
        overrides: module.overrides || null,
        locked: module.locked,
        orderIndex: module.orderIndex,
      }}
      postId={postId}
      moduleInstanceId={module.moduleInstanceId}
      viewMode={viewMode}
      fieldAgents={fieldAgents}
      onDirty={onDirty}
      // Avoid re-render churn while typing (which can steal focus).
      // We flush all module edits right before Save/Publish.
      autoSaveOnBlur={false}
      registerFlush={onRegisterFlush}
      onSave={onSave}
    />
  )
}, (prev, next) => {
  // Prevent re-rendering the editor subtree when unrelated parent state changes (e.g. enabling Save).
  // Re-rendering/remounting here can drop focus and even revert the first typed character for controlled inputs.
  return (
    prev.postId === next.postId &&
    prev.viewMode === next.viewMode &&
    prev.fieldAgents === next.fieldAgents &&
    prev.registerFlush === next.registerFlush &&
    prev.onStage === next.onStage &&
    prev.onMarkDirty === next.onMarkDirty &&
    prev.module.id === next.module.id &&
    prev.module.type === next.module.type &&
    prev.module.scope === next.module.scope &&
    prev.module.locked === next.module.locked &&
    prev.module.orderIndex === next.module.orderIndex &&
    prev.module.props === next.module.props &&
    prev.module.overrides === next.module.overrides
  )
})

interface EditorProps {
  post: {
    id: string
    type: string
    slug: string
    title: string
    excerpt: string | null
    status: string
    locale: string
    metaTitle: string | null
    metaDescription: string | null
    canonicalUrl: string | null
    robotsJson: Record<string, any> | null
    jsonldOverrides: Record<string, any> | null
    featuredImageId: string | null
    createdAt: string
    updatedAt: string
    publicPath: string
    author?: { id: number; email: string; fullName: string | null } | null
  }
  modules: {
    id: string
    moduleInstanceId: string
    type: string
    scope: string
    props: Record<string, any>
    reviewProps?: Record<string, any> | null
    aiReviewProps?: Record<string, any> | null
    overrides: Record<string, any> | null
    reviewOverrides?: Record<string, any> | null
    aiReviewOverrides?: Record<string, any> | null
    reviewAdded?: boolean
    reviewDeleted?: boolean
    aiReviewAdded?: boolean
    aiReviewDeleted?: boolean
    locked: boolean
    orderIndex: number
  }[]
  translations: { id: string; locale: string }[]
  reviewDraft?: any | null
  aiReviewDraft?: any | null
  customFields?: Array<{
    id: string
    slug: string
    label: string
    fieldType: CustomFieldType
    config?: Record<string, any>
    translatable?: boolean
    value?: any
  }>
  uiConfig?: {
    hideCoreFields?: string[]
    hierarchyEnabled?: boolean
    permalinksEnabled?: boolean
    hasPermalinks?: boolean
    modulesEnabled?: boolean
    featuredImage?: {
      enabled: boolean
      label?: string
    }
  }
  taxonomies?: Array<{ slug: string; name: string; terms: TaxonomyTermNode[] }>
  selectedTaxonomyTermIds?: string[]
  fieldTypes?: Array<{ type: string; adminComponent: string }>
}

function SortableItem({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: React.ReactNode | ((listeners: any, attributes: any) => React.ReactNode)
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id,
    disabled: !!disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return (
    <div ref={setNodeRef} style={style} {...(disabled ? {} : attributes)}>
      {typeof children === 'function'
        ? children(disabled ? {} : listeners, disabled ? {} : attributes)
        : children}
    </div>
  )
}

const ModuleRow = memo(function ModuleRow({
  m,
  viewMode,
  isDraggingModules,
  modulesAccordionOpen,
  moduleSchemasReady,
  moduleFieldAgents,
  globalSlugToLabel,
  moduleRegistry,
  moduleFlushFns,
  setModulesAccordionOpen,
  setPendingRemoved,
  setPendingReviewRemoved,
  setModules,
  registerModuleFlush,
  stageModuleEdits,
  markModuleDirty,
  postId,
}: {
  m: any
  viewMode: 'source' | 'review' | 'ai-review'
  isDraggingModules: boolean
  modulesAccordionOpen: Set<string>
  moduleSchemasReady: boolean
  moduleFieldAgents: Agent[]
  globalSlugToLabel: Map<string, string>
  moduleRegistry: Record<string, any>
  moduleFlushFns: React.MutableRefObject<Record<string, (() => Promise<void>) | null>>
  setModulesAccordionOpen: React.Dispatch<React.SetStateAction<Set<string>>>
  setPendingRemoved: React.Dispatch<React.SetStateAction<Set<string>>>
  setPendingReviewRemoved: React.Dispatch<React.SetStateAction<Set<string>>>
  setModules: React.Dispatch<React.SetStateAction<any[]>>
  registerModuleFlush: (moduleId: string, flush: (() => Promise<void>) | null) => void
  stageModuleEdits: (moduleId: string, overrides: Record<string, any> | null, edited: Record<string, any>) => void
  markModuleDirty: (mode: 'source' | 'review' | 'ai-review', moduleId: string) => void
  postId: string
}) {
  const isOpen = modulesAccordionOpen.has(m.id)
  const isLocked = m.locked

  return (
    <SortableItem key={m.id} id={m.id} disabled={isLocked}>
      {(listeners: any) => (
        <li className="bg-backdrop-low border border-line-low rounded-lg">
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <DragHandle
                aria-label="Drag"
                disabled={isLocked}
                {...(isLocked ? {} : listeners)}
              />
              <button
                type="button"
                className="min-w-0 text-left"
                onClick={() => {
                  // If collapsing, flush first so we don't lose in-progress edits on unmount.
                  if (isOpen) {
                    const flush = moduleFlushFns.current[m.id]
                    if (flush) {
                      void flush().finally(() => {
                        setModulesAccordionOpen((prev) => {
                          const next = new Set(prev)
                          next.delete(m.id)
                          return next
                        })
                      })
                      return
                    }
                  }
                  setModulesAccordionOpen((prev) => {
                    const next = new Set(prev)
                    if (next.has(m.id)) next.delete(m.id)
                    else next.add(m.id)
                    return next
                  })
                }}
              >
                <div className="text-sm font-medium text-neutral-high truncate">
                  {m.scope === 'global'
                    ? globalSlugToLabel.get(String((m as any).globalSlug || '')) ||
                    (m as any).globalLabel ||
                    (m as any).globalSlug ||
                    moduleRegistry[m.type]?.name ||
                    m.type
                    : moduleRegistry[m.type]?.name || m.type}
                </div>
                <div className="text-xs text-neutral-low">
                  Order: {m.orderIndex}{' '}
                  <span className="ml-2">
                    {isOpen && !isDraggingModules ? '▾' : '▸'}
                  </span>
                </div>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {moduleRegistry[m.type]?.renderingMode === 'react' && (
                <span
                  className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high"
                  title="React module (client-side interactivity)"
                  aria-label="React module"
                >
                  <FontAwesomeIcon icon={faReact} className="mr-1 text-sky-400" />
                  React
                </span>
              )}
              {m.scope === 'global' && (
                <span
                  className="inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2 py-1 text-xs text-neutral-high"
                  title="Global module"
                  aria-label="Global module"
                >
                  <FontAwesomeIcon icon={faGlobe} className="w-3.5 h-3.5" />
                </span>
              )}
              <button
                className="text-xs px-2 py-1 rounded border border-[#ef4444] text-[#ef4444] hover:bg-[rgba(239,68,68,0.1)] disabled:opacity-50"
                disabled={isLocked}
                onClick={async () => {
                  if (isLocked) {
                    toast.error('Locked modules cannot be removed')
                    return
                  }
                  // Mark for removal in appropriate mode; actual apply on save
                  if (viewMode === 'review') {
                    setPendingReviewRemoved((prev) => {
                      const next = new Set(prev)
                      next.add(m.id)
                      return next
                    })
                  } else {
                    setPendingRemoved((prev) => {
                      const next = new Set(prev)
                      next.add(m.id)
                      return next
                    })
                    // For source mode, optimistically remove from UI
                    setModules((prev) => prev.filter((pm) => pm.id !== m.id))
                  }
                  toast.success('Module marked for removal (apply by saving)')
                }}
                type="button"
              >
                Remove
              </button>
            </div>
          </div>

          {isOpen && !isDraggingModules && (
            <div className="border-t border-line-low px-4 py-4">
              {!moduleSchemasReady ? (
                <div className="py-4 text-sm text-neutral-low">
                  Loading module fields…
                </div>
              ) : (
                <InlineModuleEditor
                  module={m}
                  postId={postId}
                  viewMode={viewMode}
                  fieldAgents={moduleFieldAgents}
                  registerFlush={registerModuleFlush}
                  onStage={stageModuleEdits}
                  onMarkDirty={markModuleDirty}
                />
              )}
            </div>
          )}
        </li>
      )}
    </SortableItem>
  )
}, (prev, next) => {
  return (
    prev.m === next.m &&
    prev.viewMode === next.viewMode &&
    prev.isDraggingModules === next.isDraggingModules &&
    prev.modulesAccordionOpen.has(prev.m.id) === next.modulesAccordionOpen.has(next.m.id) &&
    prev.moduleSchemasReady === next.moduleSchemasReady &&
    prev.moduleFieldAgents === next.moduleFieldAgents &&
    prev.globalSlugToLabel === next.globalSlugToLabel &&
    prev.moduleRegistry === next.moduleRegistry &&
    prev.postId === next.postId
  )
})

export default function Editor({
  post,
  modules: initialModules,
  translations,
  reviewDraft,
  aiReviewDraft,
  customFields: initialCustomFields,
  uiConfig,
  taxonomies = [],
  selectedTaxonomyTermIds = [],
  fieldTypes = [],
}: EditorProps) {
  const hasFieldPermission = useHasPermission('agents.field')
  const { data, setData, put, processing, errors } = useForm({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || '',
    status: post.status,
    parentId: (post as any).parentId || '',
    orderIndex: (post as any).orderIndex ?? 0,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
    featuredImageId: post.featuredImageId || '',
    customFields: Array.isArray(initialCustomFields)
      ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
      : [],
    taxonomyTermIds: selectedTaxonomyTermIds,
  })
  const initialDataRef = useRef({
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt || '',
    status: post.status,
    parentId: (post as any).parentId || '',
    orderIndex: (post as any).orderIndex ?? 0,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
    featuredImageId: post.featuredImageId || '',
    customFields: Array.isArray(initialCustomFields)
      ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
      : [],
    taxonomyTermIds: selectedTaxonomyTermIds,
  })
  const reviewInitialRef = useRef<null | typeof initialDataRef.current>(
    reviewDraft
      ? {
        title: String(reviewDraft.title ?? post.title),
        slug: String(reviewDraft.slug ?? post.slug),
        excerpt: String(reviewDraft.excerpt ?? (post.excerpt || '')),
        status: String(reviewDraft.status ?? post.status),
        parentId: String((reviewDraft.parentId ?? (post as any).parentId ?? '') || ''),
        orderIndex: Number(reviewDraft.orderIndex ?? (post as any).orderIndex ?? 0),
        metaTitle: String(reviewDraft.metaTitle ?? (post.metaTitle || '')),
        metaDescription: String(reviewDraft.metaDescription ?? (post.metaDescription || '')),
        canonicalUrl: String(reviewDraft.canonicalUrl ?? (post.canonicalUrl || '')),
        robotsJson:
          typeof reviewDraft.robotsJson === 'string'
            ? reviewDraft.robotsJson
            : reviewDraft.robotsJson
              ? JSON.stringify(reviewDraft.robotsJson, null, 2)
              : '',
        jsonldOverrides:
          typeof reviewDraft.jsonldOverrides === 'string'
            ? reviewDraft.jsonldOverrides
            : reviewDraft.jsonldOverrides
              ? JSON.stringify(reviewDraft.jsonldOverrides, null, 2)
              : '',
        featuredImageId: String(reviewDraft.featuredImageId ?? (post.featuredImageId || '')),
        customFields: Array.isArray(reviewDraft.customFields)
          ? reviewDraft.customFields
          : Array.isArray(initialCustomFields)
            ? initialCustomFields.map((f) => ({
              fieldId: f.id,
              slug: f.slug,
              value: f.value ?? null,
            }))
            : [],
        taxonomyTermIds: selectedTaxonomyTermIds,
      }
      : null
  )
  const aiReviewInitialRef = useRef<null | typeof initialDataRef.current>(
    aiReviewDraft
      ? {
        title: String(aiReviewDraft.title ?? post.title),
        slug: String(aiReviewDraft.slug ?? post.slug),
        excerpt: String(aiReviewDraft.excerpt ?? (post.excerpt || '')),
        status: String(aiReviewDraft.status ?? post.status),
        parentId: String((aiReviewDraft.parentId ?? (post as any).parentId ?? '') || ''),
        orderIndex: Number(aiReviewDraft.orderIndex ?? (post as any).orderIndex ?? 0),
        metaTitle: String(aiReviewDraft.metaTitle ?? (post.metaTitle || '')),
        metaDescription: String(aiReviewDraft.metaDescription ?? (post.metaDescription || '')),
        canonicalUrl: String(aiReviewDraft.canonicalUrl ?? (post.canonicalUrl || '')),
        robotsJson:
          typeof aiReviewDraft.robotsJson === 'string'
            ? aiReviewDraft.robotsJson
            : aiReviewDraft.robotsJson
              ? JSON.stringify(aiReviewDraft.robotsJson, null, 2)
              : '',
        jsonldOverrides:
          typeof aiReviewDraft.jsonldOverrides === 'string'
            ? aiReviewDraft.jsonldOverrides
            : aiReviewDraft.jsonldOverrides
              ? JSON.stringify(aiReviewDraft.jsonldOverrides, null, 2)
              : '',
        featuredImageId: String(aiReviewDraft.featuredImageId ?? (post.featuredImageId || '')),
        customFields: Array.isArray(aiReviewDraft.customFields)
          ? aiReviewDraft.customFields
          : Array.isArray(initialCustomFields)
            ? initialCustomFields.map((f) => ({
              fieldId: f.id,
              slug: f.slug,
              value: f.value ?? null,
            }))
            : [],
        taxonomyTermIds: selectedTaxonomyTermIds,
      }
      : null
  )
  type ViewMode = 'source' | 'review' | 'ai-review'
  const [pendingModules, setPendingModules] = useState<
    Record<string, { overrides: Record<string, any> | null; edited: Record<string, any> }>
  >({})
  // Track modules that have been edited locally but not yet flushed/staged into pendingModules.
  // This enables the page-level Save button immediately after editing a module field.
  const [unstagedDirtyModulesByMode, setUnstagedDirtyModulesByMode] = useState<
    Record<ViewMode, Record<string, true>>
  >({ source: {}, review: {}, 'ai-review': {} })
  const restoreScrollFocusRef = useRef<{
    scrollY: number
    activeName: string | null
    activeRootId: string | null
    selectionStart: number | null
    selectionEnd: number | null
  } | null>(null)

  useLayoutEffect(() => {
    const restore = restoreScrollFocusRef.current
    if (!restore) return
    restoreScrollFocusRef.current = null
    try {
      const escapeAttr = (s: string) =>
        String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: restore.scrollY })
      }
      if (restore.activeName) {
        const selector = restore.activeRootId
          ? `[data-root-id="${escapeAttr(restore.activeRootId)}"][name="${escapeAttr(restore.activeName)}"]`
          : `[name="${escapeAttr(restore.activeName)}"]`
        const el = document.querySelector(selector) as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null
        if (el) {
          requestAnimationFrame(() => {
            try {
              // Avoid scrolling while restoring focus (supported by modern browsers)
              ; (el as any).focus?.({ preventScroll: true })
              if (
                (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) &&
                restore.selectionStart != null &&
                restore.selectionEnd != null
              ) {
                el.setSelectionRange(restore.selectionStart, restore.selectionEnd)
              }
            } catch {
              /* ignore */
            }
          })
        }
      }
    } catch {
      // ignore
    }
  })

  const markModuleDirty = useCallback((mode: ViewMode, moduleId: string) => {
    // Preserve scroll + focus on the first module edit in a clean state.
    // Some re-renders (e.g. enabling Save / updating Actions) can cause the browser to jump scroll or lose focus.
    try {
      const active = document.activeElement as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null
      const activeName = active?.getAttribute?.('name') || null
      const activeRootId = active?.getAttribute?.('data-root-id') || null
      const selectionStart =
        active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
          ? active.selectionStart
          : null
      const selectionEnd =
        active && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)
          ? active.selectionEnd
          : null
      restoreScrollFocusRef.current = {
        scrollY: typeof window !== 'undefined' ? window.scrollY : 0,
        activeName,
        activeRootId,
        selectionStart,
        selectionEnd,
      }
    } catch {
      // ignore
    }
    setUnstagedDirtyModulesByMode((prev) => {
      const bucket = prev[mode] || {}
      if (bucket[moduleId]) return prev
      return { ...prev, [mode]: { ...bucket, [moduleId]: true } }
    })
  }, [])
  const registerModuleFlush = useCallback(
    (moduleId: string, flush: (() => Promise<void>) | null) => {
      moduleFlushFns.current[moduleId] = flush
    },
    []
  )
  // Track pending module edits per active version, so switching versions doesn't overwrite drafts.
  const pendingModulesByModeRef = useRef<
    Record<ViewMode, Record<string, { overrides: Record<string, any> | null; edited: Record<string, any> }>>
  >({ source: {}, review: {}, 'ai-review': {} })
  const [pendingRemoved, setPendingRemoved] = useState<Set<string>>(new Set())
  const [pendingReviewRemoved, setPendingReviewRemoved] = useState<Set<string>>(new Set())
  const [pendingAiReviewRemoved, setPendingAiReviewRemoved] = useState<Set<string>>(new Set())
  // Track new modules that haven't been persisted yet (temporary client-side IDs)
  const [pendingNewModules, setPendingNewModules] = useState<
    Array<{
      tempId: string
      type: string
      scope: 'local' | 'global'
      globalSlug?: string | null
      orderIndex: number
    }>
  >([])
  // Track structural changes that need to be published
  const [hasStructuralChanges, setHasStructuralChanges] = useState(false)
  const [taxonomyTrees, setTaxonomyTrees] = useState(taxonomies)
  const [newTermNames, setNewTermNames] = useState<Record<string, string>>({})
  const [selectedTaxonomyTerms, setSelectedTaxonomyTerms] = useState<Set<string>>(
    new Set(selectedTaxonomyTermIds)
  )
  const taxonomyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const fieldComponents = useMemo(() => {
    const modules = import.meta.glob('../fields/*.tsx', { eager: true }) as Record<
      string,
      { default: any }
    >
    const map: Record<string, any> = {}
    Object.entries(modules).forEach(([path, mod]) => {
      const name = path
        .split('/')
        .pop()
        ?.replace(/\.\w+$/, '')
      if (name && mod?.default) {
        map[name] = mod.default
      }
    })
    return map
  }, [])

  const fieldRenderers = useMemo(() => {
    const byType = new Map<string, string>()
    fieldTypes.forEach((f) => {
      const compName = f.adminComponent
        ?.split('/')
        .pop()
        ?.replace(/\.\w+$/, '')
      if (f.type && compName) byType.set(f.type, compName)
    })
    return byType
  }, [fieldTypes])

  const pascalFromType = (t: string) =>
    t
      .split(/[-_]/g)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('')

  useEffect(() => {
    setTaxonomyTrees(taxonomies)
    setSelectedTaxonomyTerms(new Set(selectedTaxonomyTermIds))
    setData('taxonomyTermIds' as any, selectedTaxonomyTermIds)
  }, [taxonomies, selectedTaxonomyTermIds])

  const taxonomyOptions = useMemo(
    () =>
      Array.isArray(taxonomyTrees)
        ? taxonomyTrees.map((t) => ({
          slug: t.slug,
          name: t.name,
          hierarchical: !!(t as any).hierarchical,
          freeTagging: !!(t as any).freeTagging,
          maxSelections:
            (t as any).maxSelections === null || (t as any).maxSelections === undefined
              ? null
              : Number((t as any).maxSelections),
          options: flattenTerms(t.terms || []),
        }))
        : [],
    [taxonomyTrees]
  )

  const toggleTaxonomyTerm = (termId: string, checked: boolean) => {
    setSelectedTaxonomyTerms((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(termId)
      } else {
        next.delete(termId)
      }
      return next
    })
  }

  useEffect(() => {
    setData('taxonomyTermIds' as any, Array.from(selectedTaxonomyTerms))
  }, [selectedTaxonomyTerms])

  async function refreshTaxonomy(slug: string) {
    try {
      const res = await fetch(`/api/taxonomies/${encodeURIComponent(slug)}/terms`, {
        credentials: 'same-origin',
      })
      const json = await res.json().catch(() => ({}))
      const terms = Array.isArray(json?.data) ? json.data : []
      setTaxonomyTrees((prev) => prev.map((t) => (t.slug === slug ? { ...t, terms } : t)))
    } catch {
      /* ignore */
    }
  }

  async function createInlineTerm(slug: string, keepFocus?: boolean) {
    const name = (newTermNames[slug] || '').trim()
    if (!name) {
      toast.error('Enter a category name')
      return
    }
    try {
      const res = await fetch(`/api/taxonomies/${encodeURIComponent(slug)}/terms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(xsrfHeader() ? xsrfHeader() : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ name, parentId: null }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error || 'Failed to create category')
        return
      }
      toast.success('Category created')
      setNewTermNames((m) => ({ ...m, [slug]: '' }))
      await refreshTaxonomy(slug)
      if (keepFocus && taxonomyInputRefs.current[slug]) {
        taxonomyInputRefs.current[slug]?.focus()
      }
    } catch {
      toast.error('Failed to create category')
    }
  }
  const pickForm = (d: typeof data) => ({
    title: d.title,
    slug: d.slug,
    excerpt: d.excerpt,
    status: d.status,
    parentId: String((d as any).parentId || '').trim() || null,
    orderIndex: d.orderIndex,
    metaTitle: String(d.metaTitle || '').trim() || null,
    metaDescription: String(d.metaDescription || '').trim() || null,
    canonicalUrl: String(d.canonicalUrl || '').trim() || null,
    robotsJson: d.robotsJson,
    jsonldOverrides: d.jsonldOverrides,
    featuredImageId: String((d as any).featuredImageId || '').trim() || null,
    customFields: Array.isArray((d as any).customFields)
      ? (d as any).customFields.map((e: any) => ({
        fieldId: e.fieldId,
        slug: e.slug,
        value: e.value,
      }))
      : [],
    taxonomyTermIds: Array.isArray((d as any).taxonomyTermIds) ? (d as any).taxonomyTermIds : [],
  })
  const modulesEnabled = uiConfig?.modulesEnabled !== false

  // CSRF/XSRF token for fetch requests
  const page = usePage()
  const csrfFromProps: string | undefined = (page.props as any)?.csrf
  // Always read latest token to avoid stale value after a request rotates it
  const xsrfHeader = () => {
    const headers: Record<string, string> = {}
    /**
     * Shield CSRF supports:
     * - `x-csrf-token` header (plain token)
     * - `x-xsrf-token` header (encrypted cookie value from `XSRF-TOKEN`)
     *
     * Our previous implementation incorrectly fell back to sending the plain token
     * as `x-xsrf-token`, which Shield will try to decrypt and fail, resulting in a
     * redirect back (appears as opaqueredirect in fetch).
     */
    try {
      const encryptedCookieVal = getXsrf()
      // Prefer the XSRF cookie value when available, since it rotates per-request and
      // Shield will decrypt+verify it. If we send a stale X-CSRF-TOKEN alongside it,
      // Shield will read x-csrf-token first and reject before checking x-xsrf-token.
      if (encryptedCookieVal) {
        headers['X-XSRF-TOKEN'] = encryptedCookieVal
        return headers
      }
    } catch {
      // ignore
    }
    // Fallback for cases where the cookie isn't present (first load / blocked cookies)
    if (csrfFromProps) headers['X-CSRF-TOKEN'] = csrfFromProps
    return headers
  }
  const role: string | undefined =
    (page.props as any)?.currentUser?.role ?? (page.props as any)?.auth?.user?.role
  const isAdmin = role === 'admin'
  const canSaveForReview = useHasPermission('posts.review.save')
  const canApproveReview = useHasPermission('posts.review.approve')
  const canApproveAiReview = useHasPermission('posts.ai-review.approve')
  const canPublish = useHasPermission('posts.publish')
  const [isImportModeOpen, setIsImportModeOpen] = useState(false)
  const [pendingImportJson, setPendingImportJson] = useState<any | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  function slugify(input: string): string {
    return String(input || '')
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }
  const [slugAuto, setSlugAuto] = useState<boolean>(() => {
    const s = String((post as any).slug || '').trim()
    const t = String((post as any).title || '').trim()
    if (!s) return true
    if (/^untitled(-[a-z0-9]+)*(-\d+)?$/i.test(s)) return true
    return slugify(t) === s
  })

  // Modules state (sortable)
  const [modules, setModules] = useState<EditorProps['modules']>(
    modulesEnabled ? initialModules || [] : []
  )

  const hasSourceBaseline = useMemo(() => {
    // "Source" exists if:
    // 1. There is at least one module not introduced via Review/AI Review, OR
    // 2. The post has approved content (post itself exists with approved fields)
    // This ensures Source tab shows even when all modules have aiReviewProps but post has source content
    const hasSourceModules = (modules || []).some(
      (m) => !m.reviewAdded && !(m as any).aiReviewAdded
    )
    // Post has source content if it exists (has id, title, etc.) - this is always true for existing posts
    const hasSourcePost = !!post?.id
    return hasSourceModules || hasSourcePost
  }, [modules, post])

  const hasReviewBaseline = useMemo(() => {
    // Check post-level review draft
    if (reviewDraft) return true
    // Also check if any modules have review-related data
    return (modules || []).some(
      (m) =>
        (m.reviewProps && Object.keys(m.reviewProps).length > 0) ||
        (m.reviewOverrides && Object.keys(m.reviewOverrides).length > 0) ||
        m.reviewAdded === true
    )
  }, [reviewDraft, modules])

  const hasAiReviewBaseline = useMemo(() => {
    // Check post-level AI review draft
    if (aiReviewDraft) return true
    // Also check if any modules have AI review-related data
    return (modules || []).some(
      (m) =>
        ((m as any).aiReviewProps && Object.keys((m as any).aiReviewProps).length > 0) ||
        ((m as any).aiReviewOverrides && Object.keys((m as any).aiReviewOverrides).length > 0) ||
        (m as any).aiReviewAdded === true
    )
  }, [aiReviewDraft, modules])

  const initialViewMode: 'source' | 'review' | 'ai-review' = useMemo(() => {
    // Check URL parameter first to preserve view mode across reloads
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const viewParam = urlParams.get('view')
      if (viewParam === 'source' || viewParam === 'review' || viewParam === 'ai-review') {
        return viewParam as 'source' | 'review' | 'ai-review'
      }
    }
    // Fallback to baseline-based logic
    if (hasReviewBaseline) return 'review'
    if (!hasSourceBaseline && hasAiReviewBaseline) return 'ai-review'
    return 'source'
  }, [hasReviewBaseline, hasSourceBaseline, hasAiReviewBaseline])

  const setViewModeWithReload = (mode: 'source' | 'review' | 'ai-review') => {
    // Stage any current inline edits before switching tabs
    flushAllModuleEdits()

    // Use router.visit to reload the page with the new view mode.
    // This ensures the backend's "Atomic Draft" module resolution (in PostsViewController)
    // runs for the correct mode, providing the full saved state of modules instantly.
    router.visit(window.location.pathname + `?view=${mode}`, {
      preserveScroll: true,
      only: ['post', 'modules', 'reviewDraft', 'aiReviewDraft'],
    })
  }

  const [viewMode, _setViewMode] = useState<'source' | 'review' | 'ai-review'>(initialViewMode)
  const setViewMode = setViewModeWithReload

  useEffect(() => {
    _setViewMode(initialViewMode)
  }, [initialViewMode])
  const [saveTarget, setSaveTarget] = useState<'source' | 'review'>(() =>
    initialViewMode === 'review' ? 'review' : 'source'
  )
  const [decision, setDecision] = useState<
    | ''
    | 'approve-review-to-source'
    | 'approve-ai-review-to-review'
    | 'reject-review'
    | 'reject-ai-review'
  >('')
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [pendingSaveTarget, setPendingSaveTarget] = useState<null | 'source' | 'review'>(null)
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false)
  const [rejectConfirmOpen, setRejectConfirmOpen] = useState(false)

  useEffect(() => {
    // Keep default save target intuitive as the user switches Active Versions
    if (viewMode === 'source') {
      setSaveTarget('source')
    }
  }, [viewMode])

  // Default decision selection (Approve/Reject combined)
  useEffect(() => {
    const opts: Array<
      | 'approve-review-to-source'
      | 'approve-ai-review-to-review'
      | 'reject-review'
      | 'reject-ai-review'
    > = []

    // Approve options
    if (hasReviewBaseline && canApproveReview) opts.push('approve-review-to-source')
    if (hasAiReviewBaseline && canApproveAiReview) opts.push('approve-ai-review-to-review')

    // Reject options
    if (hasReviewBaseline && canApproveReview) opts.push('reject-review')
    if (hasAiReviewBaseline && canApproveAiReview) opts.push('reject-ai-review')

    const preferred =
      viewMode === 'ai-review' && opts.includes('approve-ai-review-to-review')
        ? 'approve-ai-review-to-review'
        : viewMode === 'review' && opts.includes('approve-review-to-source')
          ? 'approve-review-to-source'
          : opts.includes('approve-review-to-source')
            ? 'approve-review-to-source'
            : opts[0] || ''

    if (!decision || !opts.includes(decision as any)) {
      setDecision(preferred as any)
    }
    if (opts.length === 0 && decision) {
      setDecision('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, hasReviewBaseline, hasAiReviewBaseline, canApproveReview, canApproveAiReview])

  async function executeSave(target: 'source' | 'review' | 'ai-review') {
    // Critical: ensure inline module editors have staged their latest values before we commit/publish.
    await flushAllModuleEdits()

    const buildDraftSnapshot = (snapshotTarget: 'review' | 'ai-review') => {
      // Use the raw modules array to ensure we capture all modules, even those not visible in current view.
      return modules.map((m) => {
        const pending = pendingModulesByModeRef.current[viewMode][m.id]
        const isLocal = m.scope === 'post' || m.scope === 'local'

        // Start with the baseline for the target mode
        let finalProps = isLocal ? (m.reviewProps ?? m.props ?? {}) : {}
        let finalOverrides = !isLocal ? (m.reviewOverrides ?? m.overrides ?? null) : null

        if (snapshotTarget === 'ai-review') {
          finalProps = isLocal ? (m.aiReviewProps ?? m.reviewProps ?? m.props ?? {}) : {}
          finalOverrides = !isLocal ? (m.aiReviewOverrides ?? m.reviewOverrides ?? m.overrides ?? null) : null
        }

        // If we have unsaved edits from the current session (regardless of mode), 
        // they MUST be injected into the snapshot to ensure "Save edits to X" captures them.
        if (pending) {
          if (isLocal) {
            finalProps = pending.edited
          } else {
            finalOverrides = pending.overrides
          }
        }

        return {
          ...m,
          props: finalProps,
          overrides: finalOverrides,
        }
      })
    }

    if (target === 'review') {
      const reviewSnapshot = buildDraftSnapshot('review')
      const created = await createPendingNewModules('review')
      await commitPendingModules('review', created, viewMode)
      await saveForReview(reviewSnapshot)
      return
    }

    if (target === 'ai-review') {
      const aiReviewSnapshot = buildDraftSnapshot('ai-review')
      const created = await createPendingNewModules('ai-review')
      await commitPendingModules('ai-review', created, viewMode)
      await saveForAiReview(aiReviewSnapshot)
      return
    }

    // Save to Source (existing flow)
    try {
      const created = await createPendingNewModules('publish')
      await commitPendingModules('publish', created, viewMode)
      if (hasStructuralChanges) {
        const persistedModules = modules.filter((m) => !m.id.startsWith('temp-'))
        await persistOrder(persistedModules)
      }
      // Clean nullable fields before sending - convert empty strings to null
      const canonicalRaw = data.canonicalUrl?.trim() || null
      const canonicalUrl =
        canonicalRaw && canonicalRaw.startsWith('/') && typeof window !== 'undefined'
          ? `${window.location.origin}${canonicalRaw}`
          : canonicalRaw

      const cleanedData = {
        title: data.title,
        slug: data.slug,
        excerpt: data.excerpt?.trim() || null,
        status: data.status,
        parentId: data.parentId?.trim() || null,
        orderIndex: data.orderIndex,
        metaTitle: data.metaTitle?.trim() || null,
        metaDescription: data.metaDescription?.trim() || null,
        canonicalUrl,
        robotsJson: data.robotsJson?.trim() || null,
        jsonldOverrides: data.jsonldOverrides?.trim() || null,
        featuredImageId: data.featuredImageId?.trim() || null,
        customFields: data.customFields,
        taxonomyTermIds: data.taxonomyTermIds,
      }

      // Use fetch directly to have full control over the request.
      // NOTE: We force an absolute URL + manual redirect handling because a redirect (often due to CSRF/auth)
      // can cause the browser to follow to `/admin/posts/:id/edit` and then "PUT" that URL (404).
      const apiUrl =
        typeof window !== 'undefined'
          ? new URL(`/api/posts/${post.id}`, window.location.origin).toString()
          : `/api/posts/${post.id}`

      const res = await fetch(apiUrl, {
        method: 'PUT',
        redirect: 'manual',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          ...xsrfHeader(),
        },
        credentials: 'same-origin',
        body: JSON.stringify(cleanedData),
      })

      if (res.ok) {
        toast.success('Saved to Source')
        initialDataRef.current = pickForm(data)
        setHasStructuralChanges(false)
        // Reload to get fresh data from server, preserving the current view mode
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.set('view', 'source')
        window.location.href = currentUrl.toString()
      } else {
        // If the response is a redirect, fetch will return an opaqueredirect when redirect='manual'.
        // This often indicates an auth/CSRF issue.
        if ((res as any).type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
          console.error('Save got redirected', { status: res.status, type: (res as any).type })
          toast.error('Failed to save (redirect). Check CSRF/auth.')
          return
        }

        const contentType = res.headers.get('content-type') || ''
        const bodyText = await res.text().catch(() => '')
        const errorJson = contentType.includes('application/json')
          ? (() => {
            try {
              return JSON.parse(bodyText)
            } catch {
              return null
            }
          })()
          : null

        console.error('Save failed:', {
          status: res.status,
          contentType,
          body: errorJson ?? bodyText,
        })

        const msg =
          (errorJson as any)?.message ||
          ((errorJson as any)?.errors?.[0]?.message as string | undefined) ||
          'Failed to save'
        toast.error(msg)
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save')
    }
  }

  async function executeApprove(mode: 'approve' | 'approve-ai-review') {
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...xsrfHeader(),
      },
      credentials: 'same-origin',
      body: JSON.stringify({ mode }),
    })
    if (res.ok) {
      toast.success(
        mode === 'approve-ai-review' ? 'AI Review promoted to Review' : 'Review promoted to Source'
      )
      window.location.reload()
      return
    }
    const err = await res.json().catch(() => null)
    console.error('Approve failed:', res.status, err)
    toast.error(err?.errors ? 'Failed (validation)' : 'Failed')
  }
  const isDirty = useMemo(() => {
    try {
      const baseline =
        viewMode === 'review' && reviewInitialRef.current
          ? reviewInitialRef.current
          : viewMode === 'ai-review' && aiReviewInitialRef.current
            ? aiReviewInitialRef.current
            : initialDataRef.current
      // Normalize BOTH sides via pickForm so '' vs null coercions don't create false "dirty" states.
      const fieldsChanged =
        JSON.stringify(pickForm(data)) !== JSON.stringify(pickForm(baseline as any))
      // Only count pending module edits for the current view mode (we keep drafts for other modes too).
      const modulesPending = modulesEnabled
        ? Object.keys(pendingModules).some((k) => k.startsWith(`${viewMode}:`))
        : false
      const removalsPendingSource = modulesEnabled && viewMode === 'source' ? pendingRemoved.size > 0 : false
      const removalsPendingReview = modulesEnabled && viewMode === 'review' ? pendingReviewRemoved.size > 0 : false
      const removalsPendingAiReview =
        modulesEnabled && viewMode === 'ai-review' ? pendingAiReviewRemoved.size > 0 : false
      const unstagedModulesDirty = modulesEnabled
        ? Object.keys(unstagedDirtyModulesByMode[viewMode] || {}).length > 0
        : false
      const newModulesPending = modulesEnabled ? pendingNewModules.length > 0 : false
      const structuralChanges = modulesEnabled ? hasStructuralChanges : false
      return (
        fieldsChanged ||
        modulesPending ||
        unstagedModulesDirty ||
        removalsPendingSource ||
        removalsPendingReview ||
        removalsPendingAiReview ||
        newModulesPending ||
        structuralChanges
      )
    } catch {
      return true
    }
  }, [
    data,
    viewMode,
    pendingModules,
    unstagedDirtyModulesByMode,
    pendingRemoved,
    pendingReviewRemoved,
    pendingAiReviewRemoved,
    pendingNewModules,
    hasStructuralChanges,
    modulesEnabled,
  ])
  const [pathPattern, setPathPattern] = useState<string | null>(null)
  const [supportedLocales, setSupportedLocales] = useState<string[]>([])
  const [selectedLocale, setSelectedLocale] = useState<string>(post.locale)
  const [moduleRegistry, setModuleRegistry] = useState<
    Record<string, { name: string; description?: string; renderingMode?: 'static' | 'react' }>
  >({})
  const [moduleSchemasReady, setModuleSchemasReady] = useState<boolean>(false)
  const [globalSlugToLabel, setGlobalSlugToLabel] = useState<Map<string, string>>(new Map())

  // Keep local state in sync with server props after Inertia navigations
  // Useful after adding modules or reloading the page
  useEffect(() => {
    setModules(modulesEnabled ? initialModules || [] : [])
  }, [initialModules, modulesEnabled])

  // Load module registry for display names
  useEffect(() => {
    if (!modulesEnabled) return
    let cancelled = false
      ; (async () => {
        try {
          const res = await fetch(
            `/api/modules/registry?post_type=${encodeURIComponent(post.type)}`,
            {
              headers: { Accept: 'application/json' },
              credentials: 'same-origin',
            }
          )
          const json = await res.json().catch(() => null)
          const list: Array<{
            type: string
            name?: string
            description?: string
            renderingMode?: 'static' | 'react'
          }> = Array.isArray(json?.data) ? json.data : []
          if (!cancelled) {
            const map: Record<
              string,
              { name: string; description?: string; renderingMode?: 'static' | 'react' }
            > = {}
            list.forEach((m) => {
              map[m.type] = {
                name: m.name || m.type,
                description: m.description,
                renderingMode: m.renderingMode,
              }
            })
            setModuleRegistry(map)
          }
          // Load globals for slug->label mapping
          try {
            const gRes = await fetch('/api/modules/global', { credentials: 'same-origin' })
            const gJson = await gRes.json().catch(() => ({}))
            const gList: Array<{ globalSlug: string; label?: string | null }> = Array.isArray(
              gJson?.data
            )
              ? gJson.data
              : []
            const gMap = new Map<string, string>()
            gList.forEach((g) => {
              if (g.globalSlug) gMap.set(g.globalSlug, (g as any).label || g.globalSlug)
            })
            if (!cancelled) setGlobalSlugToLabel(gMap)
          } catch {
            /* ignore */
          }
        } catch {
          if (!cancelled) setModuleRegistry({})
        }
      })()
    return () => {
      cancelled = true
    }
  }, [post.type, modulesEnabled])

  const moduleTypeKey = useMemo(() => {
    if (!modulesEnabled) return ''
    const types = Array.from(new Set((modules || []).map((m) => m.type))).sort()
    return types.join('|')
  }, [modules, modulesEnabled])

  // Prefetch all module schemas before rendering inline module editors.
  // This prevents a schema-loading rerender from stealing focus/scroll on the first edit.
  useEffect(() => {
    if (!modulesEnabled) {
      setModuleSchemasReady(true)
      return
    }
    let alive = true
    setModuleSchemasReady(false)
      ; (async () => {
        try {
          const types = Array.from(new Set((modules || []).map((m) => m.type)))
          await prefetchModuleSchemas(types)
        } finally {
          if (alive) setModuleSchemasReady(true)
        }
      })()
    return () => {
      alive = false
    }
  }, [moduleTypeKey, modulesEnabled])

  // Load URL pattern for this post type/locale to preview final path
  useEffect(() => {
    if (uiConfig?.hasPermalinks === false) {
      setPathPattern(null)
      return
    }
    let mounted = true
      ; (async () => {
        try {
          const res = await fetch('/api/url-patterns', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{
            postType: string
            locale: string
            pattern: string
            isDefault: boolean
          }> = Array.isArray(json?.data) ? json.data : []
          const rec =
            list.find((p) => p.postType === post.type && p.locale === post.locale && p.isDefault) ||
            list.find((p) => p.postType === post.type && p.locale === post.locale) ||
            null
          if (!mounted) return
          setPathPattern(rec?.pattern || '/{locale}/posts/{slug}')
        } catch {
          if (!mounted) return
          setPathPattern('/{locale}/posts/{slug}')
        }
      })()
    return () => {
      mounted = false
    }
  }, [post.type, post.locale])

  // Load supported locales from API (enabled locales)
  useEffect(() => {
    let mounted = true
      ; (async () => {
        try {
          const res = await fetch('/api/locales', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{ code: string; isEnabled: boolean }> = Array.isArray(json?.data)
            ? json.data
            : []
          const enabled = list.filter((l) => l.isEnabled).map((l) => l.code)
          if (!mounted) return
          setSupportedLocales(enabled.length ? enabled : ['en'])
        } catch {
          if (!mounted) return
          setSupportedLocales(['en'])
        }
      })()
    return () => {
      mounted = false
    }
  }, [])

  // Update reviewInitialRef when reviewDraft changes
  useEffect(() => {
    if (reviewDraft) {
      reviewInitialRef.current = {
        title: String(reviewDraft.title ?? post.title),
        slug: String(reviewDraft.slug ?? post.slug),
        excerpt: String(reviewDraft.excerpt ?? (post.excerpt || '')),
        status: String(reviewDraft.status ?? post.status),
        parentId: String((reviewDraft.parentId ?? (post as any).parentId ?? '') || ''),
        orderIndex: Number(reviewDraft.orderIndex ?? (post as any).orderIndex ?? 0),
        metaTitle: String(reviewDraft.metaTitle ?? (post.metaTitle || '')),
        metaDescription: String(reviewDraft.metaDescription ?? (post.metaDescription || '')),
        canonicalUrl: String(reviewDraft.canonicalUrl ?? (post.canonicalUrl || '')),
        robotsJson:
          typeof reviewDraft.robotsJson === 'string'
            ? reviewDraft.robotsJson
            : reviewDraft.robotsJson
              ? JSON.stringify(reviewDraft.robotsJson, null, 2)
              : '',
        jsonldOverrides:
          typeof reviewDraft.jsonldOverrides === 'string'
            ? reviewDraft.jsonldOverrides
            : reviewDraft.jsonldOverrides
              ? JSON.stringify(reviewDraft.jsonldOverrides, null, 2)
              : '',
        featuredImageId: String(reviewDraft.featuredImageId ?? (post.featuredImageId || '')),
        customFields: Array.isArray(reviewDraft.customFields)
          ? reviewDraft.customFields
          : Array.isArray(initialCustomFields)
            ? initialCustomFields.map((f) => ({
              fieldId: f.id,
              slug: f.slug,
              value: f.value ?? null,
            }))
            : [],
        taxonomyTermIds: selectedTaxonomyTermIds,
      }
      // If we're currently in Review mode, update the form data immediately
      if (viewMode === 'review') {
        setData((prev) => ({ ...prev, ...reviewInitialRef.current }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewDraft, initialCustomFields, post])

  // Switch between Published view, Review view, and AI Review view
  // Update aiReviewInitialRef when aiReviewDraft changes (e.g., after agent run)
  useEffect(() => {
    if (aiReviewDraft) {
      aiReviewInitialRef.current = {
        title: String(aiReviewDraft.title ?? post.title),
        slug: String(aiReviewDraft.slug ?? post.slug),
        excerpt: String(aiReviewDraft.excerpt ?? (post.excerpt || '')),
        status: String(aiReviewDraft.status ?? post.status),
        parentId: String((aiReviewDraft.parentId ?? (post as any).parentId ?? '') || ''),
        orderIndex: Number(aiReviewDraft.orderIndex ?? (post as any).orderIndex ?? 0),
        metaTitle: String(aiReviewDraft.metaTitle ?? (post.metaTitle || '')),
        metaDescription: String(aiReviewDraft.metaDescription ?? (post.metaDescription || '')),
        canonicalUrl: String(aiReviewDraft.canonicalUrl ?? (post.canonicalUrl || '')),
        robotsJson:
          typeof aiReviewDraft.robotsJson === 'string'
            ? aiReviewDraft.robotsJson
            : aiReviewDraft.robotsJson
              ? JSON.stringify(aiReviewDraft.robotsJson, null, 2)
              : '',
        jsonldOverrides:
          typeof aiReviewDraft.jsonldOverrides === 'string'
            ? aiReviewDraft.jsonldOverrides
            : aiReviewDraft.jsonldOverrides
              ? JSON.stringify(aiReviewDraft.jsonldOverrides, null, 2)
              : '',
        featuredImageId: String(aiReviewDraft.featuredImageId ?? (post.featuredImageId || '')),
        customFields: Array.isArray(aiReviewDraft.customFields)
          ? aiReviewDraft.customFields
          : Array.isArray(initialCustomFields)
            ? initialCustomFields.map((f) => ({
              fieldId: f.id,
              slug: f.slug,
              value: f.value ?? null,
            }))
            : [],
        taxonomyTermIds: selectedTaxonomyTermIds,
      }
      // If we're currently in AI Review mode, update the form data immediately
      if (viewMode === 'ai-review') {
        setData((prev) => ({ ...prev, ...aiReviewInitialRef.current }))
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiReviewDraft, initialCustomFields, post])

  useEffect(() => {
    if (viewMode === 'review' && reviewInitialRef.current) {
      // Load review draft into form
      setData({ ...data, ...reviewInitialRef.current })
    } else if (viewMode === 'ai-review' && aiReviewInitialRef.current) {
      // Load AI review draft into form
      setData({ ...data, ...aiReviewInitialRef.current })
    } else if (viewMode === 'source') {
      // Restore source values
      setData({ ...data, ...initialDataRef.current })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode])

  async function saveForReview(modulesOverride?: any[]) {
    const payload = {
      ...pickForm(data),
      mode: 'review',
      customFields: Array.isArray((data as any).customFields) ? (data as any).customFields : [],
      reviewModuleRemovals: Array.from(pendingReviewRemoved),
      // Include full module state in the draft snapshot for "dependable" JSON-based storage
      modules: modulesOverride || modules.map((m) => {
        const isLocal = m.scope === 'post' || m.scope === 'local'
        return {
          ...m,
          props: isLocal ? (m.reviewProps ?? m.props ?? {}) : {},
          overrides: !isLocal ? (m.reviewOverrides ?? m.overrides ?? null) : null,
        }
      }),
    }
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...xsrfHeader(),
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Saved for review')
      reviewInitialRef.current = pickForm(data)
      setPendingReviewRemoved(new Set())

      // Redirect to Review tab if we're not already there
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'review')
      router.visit(url.toString(), {
        preserveScroll: true,
        only: ['reviewDraft', 'post', 'modules'],
      })
    } else {
      toast.error('Failed to save for review')
    }
  }

  async function saveForAiReview(modulesOverride?: any[]) {
    const payload = {
      ...pickForm(data),
      mode: 'ai-review',
      customFields: Array.isArray((data as any).customFields) ? (data as any).customFields : [],
      aiReviewModuleRemovals: Array.from(pendingAiReviewRemoved),
      // Include full module state in the draft snapshot for "dependable" JSON-based storage
      modules: modulesOverride || modules.map((m) => {
        const isLocal = m.scope === 'post' || m.scope === 'local'
        return {
          ...m,
          props: isLocal ? (m.aiReviewProps ?? m.reviewProps ?? m.props ?? {}) : {},
          overrides: !isLocal ? (m.aiReviewOverrides ?? m.reviewOverrides ?? m.overrides ?? null) : null,
        }
      }),
    }
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PUT',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...xsrfHeader(),
      },
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast.success('Saved for AI review')
      aiReviewInitialRef.current = pickForm(data)
      setPendingAiReviewRemoved(new Set())

      // Redirect to AI Review tab if we're not already there
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'ai-review')
      router.visit(url.toString(), {
        preserveScroll: true,
        only: ['aiReviewDraft', 'post', 'modules'],
      })
    } else {
      toast.error('Failed to save for AI review')
    }
  }

  function buildPreviewPath(currentSlug: string): string | null {
    if (!pathPattern) return null

    // For hierarchical patterns with {path}, use the publicPath from backend
    // because we need parent slugs which we don't have in the frontend
    if (pathPattern.includes('{path}')) {
      // If slug hasn't changed, use the publicPath directly
      if (currentSlug === post.slug) {
        return post.publicPath
      }
      // If slug changed, show the pattern with {path} token
      // (actual path will be calculated on save)
      return pathPattern.replace(/\{locale\}/g, post.locale)
    }

    // For simple patterns with {slug}, build the preview
    const d = new Date(post.createdAt)
    const yyyy = String(d.getUTCFullYear())
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    let out = pathPattern
    const encSlug = encodeURIComponent(currentSlug || '')
    out = out.replace(/\{slug\}/g, encSlug).replace(/:slug\b/g, encSlug)
    out = out.replace(/\{locale\}/g, post.locale).replace(/:locale\b/g, post.locale)
    out = out
      .replace(/\{yyyy\}/g, yyyy)
      .replace(/\{mm\}/g, mm)
      .replace(/\{dd\}/g, dd)
    if (!out.startsWith('/')) out = '/' + out
    return out
  }

  // Overrides panel state
  const [modulesAccordionOpen, setModulesAccordionOpen] = useState<Set<string>>(new Set())
  const modulesAccordionOpenBeforeDrag = useRef<Set<string> | null>(null)
  const [isDraggingModules, setIsDraggingModules] = useState(false)
  const [moduleFieldAgents, setModuleFieldAgents] = useState<Agent[]>([])
  const moduleFlushFns = useRef<Record<string, (() => Promise<void>) | null>>({})

  async function flushAllModuleEdits() {
    const fns = Object.values(moduleFlushFns.current).filter(Boolean) as Array<() => Promise<void>>
    if (fns.length === 0) return
    // Best-effort flush; don't block publish on a single module flush error
    await Promise.allSettled(fns.map((fn) => fn()))
  }
  // Removed explicit savingOverrides state; handled via pendingModules flow
  const [revisions, setRevisions] = useState<
    Array<{
      id: string
      mode: 'approved' | 'review' | 'ai-review'
      createdAt: string
      user?: { id?: number; email?: string }
    }>
  >([])
  const [loadingRevisions, setLoadingRevisions] = useState(false)
  // Agents
  const [agents, setAgents] = useState<
    Array<{
      id: string
      name: string
      description?: string
      openEndedContext?: {
        enabled: boolean
        label?: string
        placeholder?: string
        maxChars?: number
      }
    }>
  >([])
  const [selectedAgent, setSelectedAgent] = useState<string>('')
  const [runningAgent, setRunningAgent] = useState<boolean>(false)
  const [agentPromptOpen, setAgentPromptOpen] = useState(false)
  const [agentOpenEndedContext, setAgentOpenEndedContext] = useState('')
  const [agentResponse, setAgentResponse] = useState<{
    rawResponse?: string
    summary?: string | null
    applied?: string[]
    message?: string
  } | null>(null)
  const [agentHistory, setAgentHistory] = useState<
    Array<{
      id: string
      request: string | null
      response: {
        rawResponse?: string
        summary?: string
        applied?: string[]
        [key: string]: any
      } | null
      createdAt: string
      user: { id: number; email: string; fullName: string | null } | null
    }>
  >([])
  const [loadingAgentHistory, setLoadingAgentHistory] = useState(false)
  const agentModalContentRef = useRef<HTMLDivElement | null>(null)
  // Author management (admin)
  const [users, setUsers] = useState<Array<{ id: number; email: string; fullName: string | null }>>(
    []
  )
  const [selectedAuthorId, setSelectedAuthorId] = useState<number | null>(post.author?.id ?? null)
  // Media picker for custom fields
  const [openMediaForField, setOpenMediaForField] = useState<string | null>(null)
  // Field-scoped agents for Featured Image
  const [featuredImageFieldAgents, setFeaturedImageFieldAgents] = useState<Agent[]>([])
  const [featuredImageAgentModalOpen, setFeaturedImageAgentModalOpen] = useState(false)
  const [selectedFeaturedImageAgent, setSelectedFeaturedImageAgent] = useState<Agent | null>(null)
  // Debug removed

  useEffect(() => {
    let alive = true
    async function loadRevisions() {
      try {
        setLoadingRevisions(true)
        const res = await fetch(`/api/posts/${post.id}/revisions?limit=10`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (!json?.data) return
        if (alive) setRevisions(json.data)
      } finally {
        if (alive) setLoadingRevisions(false)
      }
    }
    loadRevisions()
    return () => {
      alive = false
    }
  }, [post.id])

  // Load agents
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch('/api/agents', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{
            id: string
            name: string
            description?: string
            openEndedContext?: {
              enabled: boolean
              label?: string
              placeholder?: string
              maxChars?: number
            }
          }> = Array.isArray(json?.data) ? json.data : []
          if (alive) setAgents(list)
        } catch {
          if (alive) setAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [])

  // Load field-scoped agents for Featured Image (media field type)
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch(
            `/api/agents?scope=field&fieldType=media&fieldKey=post.featuredImageId`,
            { credentials: 'same-origin' }
          )
          const json = await res.json().catch(() => ({}))
          const agents: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setFeaturedImageFieldAgents(agents)
        } catch {
          if (alive) setFeaturedImageFieldAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [])

  // Load agent history when dialog opens and agent is selected
  useEffect(() => {
    if (!agentPromptOpen || !selectedAgent) {
      setAgentHistory([])
      return
    }
    let alive = true
    async function loadHistory() {
      try {
        setLoadingAgentHistory(true)
        const res = await fetch(`/api/posts/${post.id}/agents/${selectedAgent}/history`, {
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        })
        if (!res.ok) return
        const json = await res.json().catch(() => null)
        if (!json?.data) return
        if (alive) setAgentHistory(Array.isArray(json.data) ? json.data : [])
      } catch {
        // Ignore errors
      } finally {
        if (alive) setLoadingAgentHistory(false)
      }
    }
    loadHistory()
    return () => {
      alive = false
    }
  }, [agentPromptOpen, selectedAgent, post.id])

  // Scroll modal to bottom when it opens or history loads
  useEffect(() => {
    if (agentPromptOpen && agentModalContentRef.current) {
      // Small delay to ensure DOM is fully rendered
      setTimeout(() => {
        if (agentModalContentRef.current) {
          agentModalContentRef.current.scrollTop = agentModalContentRef.current.scrollHeight
        }
      }, 150)
    }
  }, [agentPromptOpen, loadingAgentHistory, agentHistory])

  // DnD sensors (pointer only to avoid key conflicts)
  const sensors = useSensors(useSensor(PointerSensor))


  const orderedIds = useMemo(
    () =>
      modules
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((m) => m.id),
    [modules]
  )

  async function persistOrder(next: EditorProps['modules']) {
    if (!modulesEnabled) return
    // Always update all modules' order indices to ensure they're saved correctly
    // Don't skip based on current orderIndex since it may have been updated in local state
    // Filter out temporary modules (pending creation)
    const updates = next
      .filter((m) => !m.id.startsWith('temp-'))
      .map((m, index) =>
        fetch(`/api/post-modules/${encodeURIComponent(m.id)}`, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...xsrfHeader(),
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            orderIndex: index,
            mode: viewMode === 'review' ? 'review' : 'publish',
          }),
        })
      )
    await Promise.allSettled(updates)
  }

  // Create pending new modules via API
  // IMPORTANT: if the user edited a temp module before saving/publishing, we must
  // remap those pending edits from tempId -> real postModuleId so they get persisted.
  async function createPendingNewModules(
    mode: 'publish' | 'review' | 'ai-review' = 'publish'
  ): Promise<Array<{ tempId: string; postModuleId: string; moduleInstanceId: string | null }>> {
    if (!modulesEnabled) return []
    if (pendingNewModules.length === 0) return []

    const creates = pendingNewModules.map(async (pm) => {
      const res = await fetch(`/api/posts/${post.id}/modules`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...xsrfHeader(),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          moduleType: pm.type,
          scope: pm.scope,
          globalSlug: pm.globalSlug,
          orderIndex: pm.orderIndex,
          locked: false,
          mode,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to create module: ${pm.type}`)
      }

      const json = await res.json().catch(() => ({} as any))
      const data = (json as any)?.data ?? json
      const postModuleId = String(data?.postModuleId || data?.id || '')
      const moduleInstanceId = data?.moduleInstanceId ? String(data.moduleInstanceId) : null
      if (!postModuleId) {
        throw new Error(`Failed to create module (missing id): ${pm.type}`)
      }
      return { tempId: pm.tempId, postModuleId, moduleInstanceId }
    })

    try {
      const created = await Promise.all(creates)

      // Replace temp IDs in the visible module list
      setModules((prev) =>
        prev.map((m) => {
          const match = created.find((c) => c.tempId === m.id)
          if (!match) return m
          return {
            ...m,
            id: match.postModuleId,
            // Keep for debugging / future use; harmless extra prop.
            ...(match.moduleInstanceId ? { moduleInstanceId: match.moduleInstanceId } : {}),
          } as any
        })
      )

      // Remap pending edits to the real IDs so commitPendingModules will persist them
      setPendingModules((prev) => {
        const next = { ...prev }
        for (const c of created) {
          if (next[c.tempId]) {
            next[c.postModuleId] = next[c.tempId]
            delete next[c.tempId]
          }
        }
        return next
      })

      // Remap any queued removals as well
      setPendingRemoved((prev) => {
        if (prev.size === 0) return prev
        const next = new Set<string>()
        for (const id of prev) {
          const match = created.find((c) => c.tempId === id)
          next.add(match ? match.postModuleId : id)
        }
        return next
      })

      setPendingNewModules([])
      return created
    } catch (error) {
      toast.error('Failed to save some new modules')
      throw error
    }
  }

  // Handle adding new modules locally (without API call)
  async function handleAddModule(payload: {
    type: string
    scope: 'post' | 'global'
    globalSlug?: string | null
  }) {
    if (!modulesEnabled) return
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    const nextOrderIndex = Math.max(-1, ...modules.map((m) => m.orderIndex)) + 1

    // Add to pending new modules
    setPendingNewModules((prev) => [
      ...prev,
      {
        tempId,
        type: payload.type,
        scope: payload.scope === 'post' ? 'local' : 'global',
        globalSlug: payload.globalSlug || null,
        orderIndex: nextOrderIndex,
      },
    ])

    // Add to modules display list with temporary data
    const newModule: EditorProps['modules'][0] = {
      id: tempId,
      type: payload.type,
      scope: payload.scope === 'post' ? 'local' : 'global',
      props: {},
      overrides: null,
      locked: false,
      orderIndex: nextOrderIndex,
    }

    setModules((prev) => [...prev, newModule])
    setHasStructuralChanges(true)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    // Restore accordions after dragging
    setIsDraggingModules(false)
    if (modulesAccordionOpenBeforeDrag.current) {
      setModulesAccordionOpen(new Set(modulesAccordionOpenBeforeDrag.current))
      modulesAccordionOpenBeforeDrag.current = null
    }
    if (!over || active.id === over.id) return
    const current = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)
    const dragged = current.find((m) => m.id === active.id)
    const overItem = current.find((m) => m.id === over.id)
    // Prevent any interaction involving locked modules
    if (dragged?.locked || overItem?.locked) return

    // Reorder only within unlocked modules while keeping locked modules fixed
    const lockedPositions = current.map((m, idx) => ({ m, idx })).filter(({ m }) => m.locked)
    const unlocked = current.filter((m) => !m.locked)
    const unlockedOld = unlocked.findIndex((m) => m.id === active.id)
    const unlockedNew = unlocked.findIndex((m) => m.id === over.id)
    if (unlockedOld === -1 || unlockedNew === -1) return
    const unlockedReordered = unlocked.slice()
    const [moved] = unlockedReordered.splice(unlockedOld, 1)
    unlockedReordered.splice(unlockedNew, 0, moved)

    // Rebuild list with locked items frozen in place
    const rebuilt: typeof modules = []
    let uPtr = 0
    for (let i = 0; i < current.length; i++) {
      const lockedAt = lockedPositions.find((p) => p.idx === i)
      if (lockedAt) {
        rebuilt.push(lockedAt.m)
      } else {
        rebuilt.push(unlockedReordered[uPtr]!)
        uPtr++
      }
    }
    const next = rebuilt.map((m, idx) => ({ ...m, orderIndex: idx }))
    setModules(next)
    setHasStructuralChanges(true)
  }

  async function onDragStart() {
    // If the user starts dragging immediately after editing, flush first so we don't lose edits when collapsing.
    await flushAllModuleEdits()
    // Temporarily collapse all accordions for easier reordering
    setIsDraggingModules(true)
    modulesAccordionOpenBeforeDrag.current = new Set(modulesAccordionOpen)
    setModulesAccordionOpen(new Set())
  }

  function onDragCancel() {
    setIsDraggingModules(false)
    if (modulesAccordionOpenBeforeDrag.current) {
      setModulesAccordionOpen(new Set(modulesAccordionOpenBeforeDrag.current))
      modulesAccordionOpenBeforeDrag.current = null
    }
  }

  const adjustModuleForView = useCallback(
    (m: EditorProps['modules'][number]) => {
      if (viewMode === 'review') {
        if (m.scope === 'post') {
          return {
            ...m,
            props: m.reviewProps ?? m.props ?? {},
            overrides: m.overrides,
          }
        }
        return {
          ...m,
          overrides: (m as any).reviewOverrides ?? m.overrides ?? null,
        }
      }
      if (viewMode === 'ai-review') {
        if (m.scope === 'post') {
          return {
            ...m,
            props: (m as any).aiReviewProps ?? m.props ?? {},
            overrides: m.overrides,
          }
        }
        return {
          ...m,
          overrides: (m as any).aiReviewOverrides ?? m.overrides ?? null,
        }
      }
      return m
    },
    [viewMode]
  )

  // If a post has no source baseline and only AI Review exists, keep the UI on AI Review.
  useEffect(() => {
    if (!hasSourceBaseline && hasAiReviewBaseline && viewMode === 'source') {
      setViewMode('ai-review')
    }
    if (!hasReviewBaseline && viewMode === 'review') {
      // Review draft removed/absent; fall back safely.
      setViewMode(hasAiReviewBaseline ? 'ai-review' : hasSourceBaseline ? 'source' : 'ai-review')
    }
  }, [hasSourceBaseline, hasAiReviewBaseline, hasReviewBaseline, viewMode])

  const sortedModules = useMemo(() => {
    const baseAll = modules.slice().sort((a, b) => a.orderIndex - b.orderIndex)

    if (viewMode === 'review') {
      const base = baseAll
        .filter((m) => !pendingReviewRemoved.has(m.id))
        .filter((m) => !m.reviewDeleted)
      return base.map(adjustModuleForView)
    }

    if (viewMode === 'ai-review') {
      // hide review-added modules in source view but show them in ai-review?
      const base = baseAll.filter((m) => !m.reviewDeleted)
      return base.map(adjustModuleForView)
    }

    // Source view: hide review-added and ai-review-added modules
    const base = baseAll.filter((m) => !m.reviewAdded && !(m as any).aiReviewAdded)
    return base.map(adjustModuleForView)
  }, [modules, viewMode, pendingReviewRemoved, adjustModuleForView])

  // Load field-scoped agents once for inline module editors (avoid N fetches per module)
  useEffect(() => {
    if (!hasFieldPermission) {
      setModuleFieldAgents([])
      return
    }
    let alive = true
      ; (async () => {
        try {
          const res = await fetch('/api/agents?scope=field', { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setModuleFieldAgents(list)
        } catch {
          if (alive) setModuleFieldAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [hasFieldPermission])

  // Default: all module accordions expanded (and keep new modules expanded)
  // Optimization: If there are many modules (> 15), start with them collapsed to prevent mount jank.
  const sortedModuleIds = useMemo(() => sortedModules.map((m) => m.id), [sortedModules])
  const initialExpandDone = useRef(false)

  useEffect(() => {
    setModulesAccordionOpen((prev) => {
      const next = new Set(prev)
      const isInitial = !initialExpandDone.current
      const shouldExpandAll = isInitial ? sortedModuleIds.length <= 15 : false

      // Add new module ids or initial expand
      for (const id of sortedModuleIds) {
        if (shouldExpandAll || !prev.has(id)) {
          // If we're initial and have > 15, we DON'T add to 'next'
          if (isInitial && sortedModuleIds.length > 15) {
            // keep collapsed
          } else {
            next.add(id)
          }
        }
      }

      // Remove ids that no longer exist
      for (const id of Array.from(next)) {
        if (!sortedModuleIds.includes(id)) next.delete(id)
      }

      initialExpandDone.current = true
      return next
    })
  }, [sortedModuleIds.join('|')])

  const stageModuleEdits = useCallback(
    (moduleId: string, overrides: Record<string, any> | null, edited: Record<string, any>) => {
      // If there are no effective changes, don't mark this module as pending.
      // This prevents "Save" being enabled when nothing actually changed.
      const isEmptyOverrides =
        overrides == null || (typeof overrides === 'object' && Object.keys(overrides).length === 0)
      if (isEmptyOverrides) {
        // If user changed something and then reverted back, clear any "unstaged dirty" marker for this module.
        setUnstagedDirtyModulesByMode((prev) => {
          const bucket = prev[viewMode] || {}
          if (!bucket[moduleId]) return prev
          const nextBucket = { ...bucket }
          delete nextBucket[moduleId]
          return { ...prev, [viewMode]: nextBucket }
        })
        // Clear union pending entry for this viewMode/moduleId if it exists
        const unionKey = `${viewMode}:${moduleId}`
        setPendingModules((prev) => {
          if (!prev[unionKey]) return prev
          const next = { ...prev }
          delete next[unionKey]
          return next
        })
        // Clear per-mode bucket entry if it exists
        const nextBucket = { ...(pendingModulesByModeRef.current[viewMode] || {}) }
        if (nextBucket[moduleId]) {
          delete nextBucket[moduleId]
          pendingModulesByModeRef.current[viewMode] = nextBucket
        }
        return
      }

      // This module is now staged, so it no longer counts as "unstaged dirty".
      setUnstagedDirtyModulesByMode((prev) => {
        const bucket = prev[viewMode]
        if (!bucket[moduleId]) return prev
        const nextBucket = { ...bucket }
        delete nextBucket[moduleId]
        return { ...prev, [viewMode]: nextBucket }
      })

      // Update per-mode ref immediately so save flows can commit even before React state flushes.
      pendingModulesByModeRef.current[viewMode] = {
        ...pendingModulesByModeRef.current[viewMode],
        [moduleId]: { overrides, edited },
      }
      // Also keep a union map for isDirty + UI (keyed by mode so multiple versions can coexist).
      const unionKey = `${viewMode}:${moduleId}`
      setPendingModules((prev) => ({ ...prev, [unionKey]: { overrides, edited } }))
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== moduleId) return m
          if (viewMode === 'review') {
            if (m.scope === 'post') {
              return { ...m, reviewProps: edited, overrides: null }
            } else {
              return { ...m, reviewOverrides: overrides }
            }
          } else if (viewMode === 'ai-review') {
            if (m.scope === 'post') {
              return { ...m, aiReviewProps: edited, overrides: null }
            } else {
              return { ...m, aiReviewOverrides: overrides }
            }
          } else {
            if (m.scope === 'post') {
              return { ...m, props: edited, overrides: null }
            } else {
              return { ...m, overrides }
            }
          }
        })
      )
    },
    [modules, viewMode]
  )

  const translationsSet = useMemo(
    () => new Set((translations || []).map((t) => t.locale)),
    [translations]
  )
  const availableLocales = useMemo(() => {
    const base = new Set<string>(supportedLocales.length ? supportedLocales : ['en'])
    translations?.forEach((t) => base.add(t.locale))
    return Array.from(base)
  }, [translations, supportedLocales])

  // saveOverrides removed; overrides are handled via ModuleEditorPanel onSave and pendingModules batching.

  async function commitPendingModules(
    mode: 'review' | 'publish' | 'ai-review',
    created?: Array<{ tempId: string; postModuleId: string }>
    ,
    fromMode: ViewMode = viewMode
  ) {
    if (!modulesEnabled) return
    const bucket = pendingModulesByModeRef.current[fromMode] || {}
    const entries = Object.entries(bucket)
    const idMap = new Map<string, string>(
      (created || []).map((c) => [String(c.tempId), String(c.postModuleId)])
    )
    const resolveId = (id: string) => (id.startsWith('temp-') ? idMap.get(id) || null : id)

    // Include temp IDs IF we have a mapping (in this same save call). This avoids a React
    // state timing issue where setPendingModules() hasn't applied before we issue the PUTs.
    const persistedEntries = entries
      .map(([id, payload]) => {
        const resolved = resolveId(id)
        return resolved ? ([resolved, payload] as const) : null
      })
      .filter(Boolean) as Array<
        readonly [string, { overrides: Record<string, any> | null; edited: Record<string, any> }]
      >

    const findModule = (id: string) => {
      const direct = modules.find((m) => m.id === id)
      if (direct) return direct
      const tempMatch = Array.from(idMap.entries()).find(([, real]) => real === id)
      if (tempMatch) {
        const [tempId] = tempMatch
        return modules.find((m) => m.id === tempId)
      }
      return undefined
    }
    // 1) Apply updates
    if (persistedEntries.length > 0) {
      const updates = persistedEntries.map(([id, payload]) => {
        const url = `/api/post-modules/${encodeURIComponent(id)}`
        // For local modules, send edited props as overrides (they get merged into ai_review_props/review_props)
        // For global modules, send overrides (they get saved to ai_review_overrides/review_overrides)
        const module = findModule(id)
        const isLocal = module?.scope === 'post' || module?.scope === 'local'
        const overridesToSend = isLocal ? payload.edited : payload.overrides
        return fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...xsrfHeader(),
          },
          credentials: 'same-origin',
          body: JSON.stringify({ overrides: overridesToSend, mode }),
        })
      })
      const results = await Promise.allSettled(updates)
      const anyFailed = results.some(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as Response).ok)
      )
      if (anyFailed) {
        toast.error('Failed to save module changes')
        throw new Error('Failed to save module changes')
      }
      // Clear any entries we successfully persisted (including temp keys that mapped to them)
      setPendingModules((prev) => {
        const next = { ...prev }
        for (const [origId] of entries) {
          const resolved = resolveId(origId)
          if (!resolved) continue
          // Union map uses mode-prefixed keys
          delete next[`${fromMode}:${origId}`]
          delete next[`${fromMode}:${resolved}`]
        }
        return next
      })
      // Also clear the per-mode bucket ref
      const nextBucket = { ...(pendingModulesByModeRef.current[fromMode] || {}) }
      for (const [origId] of entries) {
        const resolved = resolveId(origId)
        if (!resolved) continue
        delete nextBucket[origId]
        delete nextBucket[resolved]
      }
      pendingModulesByModeRef.current[fromMode] = nextBucket
    } else {
      // If no persisted entries, still clear temp entries since they'll be created fresh
      setPendingModules({})
      pendingModulesByModeRef.current = { source: {}, review: {}, 'ai-review': {} }
    }
    // 2) Apply removals
    if (pendingRemoved.size > 0) {
      const deletes = Array.from(pendingRemoved).map((id) =>
        fetch(`/api/post-modules/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: {
            ...xsrfHeader(),
          },
        })
      )
      await Promise.allSettled(deletes)
      setPendingRemoved(new Set())
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    put(`/api/posts/${post.id}`, {
      headers: xsrfHeader(),
      onSuccess: () => {
        toast.success('Post updated successfully')
      },
      onError: (errors) => {
        const firstError = Object.values(errors)[0]
        toast.error(firstError || 'Failed to update post')
      },
    })
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <AdminHeader title={`Edit ${post.type ? humanizeSlug(post.type) : 'Post'}`} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Content Card */}
            <div className="bg-backdrop-low rounded-lg p-6 border border-line-low">
              <div className="flex items-start justify-between gap-3 mb-4">
                <h2 className="text-lg font-semibold text-neutral-high">Content</h2>
                {uiConfig?.hasPermalinks !== false && (
                  <button
                    className="px-2 py-1 text-xs border border-border rounded hover:bg-backdrop-medium text-neutral-medium"
                    onClick={() => {
                      const base = (post as any).publicPath || `/posts/${post.slug}`
                      const target =
                        viewMode === 'review'
                          ? `${base}${base.includes('?') ? '&' : '?'}view=review`
                          : base
                      window.open(target, '_blank')
                    }}
                    type="button"
                    title="Open the current view in a new tab"
                  >
                    View on Site
                  </button>
                )}
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Title */}
                {(uiConfig?.hideCoreFields || []).includes('title') ? null : (
                  <div>
                    <label className="block text-sm font-medium text-neutral-medium mb-1">
                      Title *
                    </label>
                    <Input
                      type="text"
                      value={data.title}
                      onChange={(e) => {
                        const val = e.target.value
                        setData('title', val)
                        // Auto-suggest slug while slug is marked auto-generated
                        if (slugAuto) {
                          setData('slug', slugify(val))
                        }
                      }}
                      placeholder="Enter post title"
                    />
                    {errors.title && <p className="text-sm text-[#dc2626] mt-1">{errors.title}</p>}
                  </div>
                )}

                {/* Excerpt */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Excerpt
                  </label>
                  <Textarea
                    value={data.excerpt}
                    onChange={(e) => setData('excerpt', e.target.value)}
                    rows={3}
                    placeholder="Brief description (optional)"
                  />
                  {errors.excerpt && (
                    <p className="text-sm text-[#dc2626] mt-1">{errors.excerpt}</p>
                  )}
                </div>

                {/* Featured Image (core) */}
                {uiConfig?.featuredImage?.enabled && (
                  <div className="group">
                    <label className="block text-sm font-medium text-neutral-medium mb-1">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" aria-hidden="true" />
                          <span>{uiConfig.featuredImage.label || 'Featured Image'}</span>
                        </span>
                        {featuredImageFieldAgents.length > 0 && hasFieldPermission && (
                          <button
                            type="button"
                            onClick={() => {
                              if (featuredImageFieldAgents.length === 1) {
                                setSelectedFeaturedImageAgent(featuredImageFieldAgents[0])
                                setFeaturedImageAgentModalOpen(true)
                              } else {
                                // If multiple agents, could show a picker - for now just use first
                                setSelectedFeaturedImageAgent(featuredImageFieldAgents[0])
                                setFeaturedImageAgentModalOpen(true)
                              }
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-backdrop-medium rounded"
                            title={
                              featuredImageFieldAgents.length === 1
                                ? featuredImageFieldAgents[0].name
                                : 'AI Assistant'
                            }
                          >
                            <FontAwesomeIcon
                              icon={faWandMagicSparkles}
                              className="text-md text-neutral-high dark:text-neutral-high"
                            />
                          </button>
                        )}
                      </div>
                    </label>
                    <MediaThumb
                      mediaId={(data as any).featuredImageId || null}
                      onChange={() => setOpenMediaForField('featuredImage')}
                      onClear={() => setData('featuredImageId', '')}
                    />
                    <MediaPickerModal
                      open={openMediaForField === 'featuredImage'}
                      onOpenChange={(o) => setOpenMediaForField(o ? 'featuredImage' : null)}
                      initialSelectedId={(data as any).featuredImageId || undefined}
                      onSelect={(m) => {
                        setData('featuredImageId', m.id)
                        setOpenMediaForField(null)
                      }}
                    />
                    {selectedFeaturedImageAgent && (
                      <AgentModal
                        open={featuredImageAgentModalOpen}
                        onOpenChange={setFeaturedImageAgentModalOpen}
                        agent={selectedFeaturedImageAgent}
                        contextId={post.id}
                        context={{
                          scope: 'field',
                          fieldKey: 'post.featuredImageId',
                          fieldType: 'media',
                        }}
                        scope="field"
                        fieldKey="post.featuredImageId"
                        fieldType="media"
                        viewMode={viewMode}
                        onSuccess={() => {
                          setFeaturedImageAgentModalOpen(false)
                          setSelectedFeaturedImageAgent(null)
                          // Reload the page to show updated featured image
                          router.reload({ only: ['post'] })
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Categories (Taxonomies) */}
                {taxonomyOptions.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm font-semibold text-neutral-high">Categories</div>
                    {taxonomyOptions.map((tax) => {
                      const selectedCount = Array.from(selectedTaxonomyTerms).filter((id) =>
                        tax.options.some((o) => o.id === id)
                      ).length
                      const limit = tax.maxSelections === null ? Infinity : tax.maxSelections
                      return (
                        <div
                          key={tax.slug}
                          className="space-y-2 rounded border border-border p-3 bg-backdrop-low"
                        >
                          <div className="text-sm font-medium text-neutral-high">{tax.name}</div>
                          {tax.options.length === 0 ? (
                            <p className="text-xs text-neutral-low">
                              No terms available for {tax.name}
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {tax.options.map((opt, idx) => {
                                const checked = selectedTaxonomyTerms.has(opt.id)
                                const disableUnchecked = !checked && selectedCount >= limit
                                return (
                                  <label
                                    key={`${tax.slug}:${String(opt.id || idx)}`}
                                    className="flex items-center gap-2 text-sm text-neutral-high"
                                  >
                                    <Checkbox
                                      checked={checked}
                                      disabled={disableUnchecked}
                                      onCheckedChange={(val) => toggleTaxonomyTerm(opt.id, !!val)}
                                      aria-label={opt.label}
                                    />
                                    <span className={disableUnchecked ? 'text-neutral-low' : ''}>
                                      {opt.label}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                          {tax.freeTagging && (
                            <div className="flex items-center gap-2">
                              <Input
                                ref={(el) => {
                                  taxonomyInputRefs.current[tax.slug] = el
                                }}
                                value={newTermNames[tax.slug] || ''}
                                onChange={(e) =>
                                  setNewTermNames((m) => ({ ...m, [tax.slug]: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    createInlineTerm(tax.slug, true)
                                  }
                                }}
                                placeholder={`Add ${tax.name}`}
                                className="flex-1"
                              />
                              <button
                                type="button"
                                className="px-3 py-2 text-sm rounded bg-standout-medium text-on-standout disabled:opacity-50"
                                onClick={() => createInlineTerm(tax.slug, true)}
                                disabled={!newTermNames[tax.slug]?.trim()}
                              >
                                Add
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Parent (optional hierarchy) */}
                {(uiConfig?.hierarchyEnabled ?? true) && (
                  <ParentSelect
                    postId={post.id}
                    postType={post.type}
                    locale={post.locale}
                    value={data.parentId || ''}
                    onChange={(val) => setData('parentId', val)}
                  />
                )}
                {/* Order Index */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Order
                  </label>
                  <Input
                    type="number"
                    value={
                      typeof data.orderIndex === 'number'
                        ? data.orderIndex
                        : Number(data.orderIndex || 0)
                    }
                    onChange={(e) => setData('orderIndex', Number(e.target.value) || 0)}
                    min={0}
                    className="w-32"
                  />
                </div>

                {/* Save button moved to Actions */}
              </form>
              {/* Custom Fields (e.g., Profile fields) - inside Content, above Modules */}
              {Array.isArray(initialCustomFields) && initialCustomFields.length > 0 && (
                <div className="mt-6">
                  <div className="space-y-4">
                    {initialCustomFields.map((f) => {
                      const entry = (data as any).customFields?.find(
                        (e: any) => e.fieldId === f.id
                      ) || { value: null }
                      const setValue = (val: any) => {
                        const prev: any[] = Array.isArray((data as any).customFields)
                          ? (data as any).customFields
                          : []
                        const list = prev.slice()
                        const idx = list.findIndex((e) => e.fieldId === f.id)
                        const next = { fieldId: f.id, slug: f.slug, value: val }
                        if (idx >= 0) list[idx] = next
                        else list.push(next)
                        setData('customFields', list as any)
                      }
                      const rendererKey = (f as any).fieldType || (f as any).type
                      const compName =
                        fieldRenderers.get(rendererKey) ||
                        rendererKey
                          ?.split('/')
                          .pop()
                          ?.replace(/\.\w+$/, '') ||
                        `${pascalFromType(rendererKey)}Field`
                      const Renderer = compName
                        ? (fieldComponents as Record<string, any>)[compName]
                        : undefined
                      if (Renderer) {
                        const cfg = (f as any).config || {}
                        const isSelect = compName === 'SelectField'
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            {isSelect ? (
                              <Renderer
                                value={entry.value ?? null}
                                onChange={setValue}
                                options={Array.isArray(cfg.options) ? cfg.options : []}
                                multiple={!!cfg.multiple}
                              />
                            ) : (
                              <Renderer
                                value={entry.value ?? null}
                                onChange={setValue}
                                placeholder={cfg.placeholder}
                                maxLength={cfg.maxLength}
                              />
                            )}
                          </div>
                        )
                      }
                      if (f.fieldType === 'textarea') {
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <Textarea
                              value={entry.value ?? ''}
                              onChange={(e) => setValue(e.target.value)}
                              rows={4}
                              placeholder={f.label}
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'media') {
                        const currentId: string | null =
                          typeof entry.value === 'string'
                            ? entry.value || null
                            : entry.value?.id
                              ? String(entry.value.id)
                              : null
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <MediaThumb
                              mediaId={currentId}
                              onChange={() => setOpenMediaForField(f.id)}
                              onClear={() => setValue(null)}
                            />
                            <MediaPickerModal
                              open={openMediaForField === f.id}
                              onOpenChange={(o) => setOpenMediaForField(o ? f.id : null)}
                              initialSelectedId={currentId || undefined}
                              onSelect={(m) => {
                                setValue({ id: m.id, url: m.url })
                                setOpenMediaForField(null)
                              }}
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'post-reference') {
                        return (
                          <div key={f.id}>
                            <PostCustomPostReferenceField
                              label={f.label}
                              value={entry.value}
                              onChange={setValue}
                              config={f.config}
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'link') {
                        return (
                          <div key={f.id}>
                            <LinkField
                              label={f.label}
                              value={entry.value}
                              onChange={(val: LinkFieldValue) => setValue(val)}
                              currentLocale={post.locale}
                              helperText="Use an existing post when possible so links stay valid if URLs change."
                            />
                          </div>
                        )
                      }
                      if (f.fieldType === 'file') {
                        const current = entry.value || null
                        const currentLabel: string | null =
                          typeof current === 'object' && current !== null
                            ? current.originalFilename || current.filename || current.name || null
                            : typeof current === 'string'
                              ? current
                              : null
                        const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          try {
                            const form = new FormData()
                            form.append('file', file)
                            form.append('naming', 'original')
                            form.append('appendIdIfExists', 'true')
                            form.append('altText', f.label || file.name)
                            const res = await fetch('/api/media', {
                              method: 'POST',
                              headers: {
                                ...xsrfHeader(),
                              },
                              credentials: 'same-origin',
                              body: form,
                            })
                            if (!res.ok) {
                              const j = await res.json().catch(() => ({}))
                              toast.error(j?.error || 'File upload failed')
                              return
                            }
                            const j = await res.json().catch(() => ({}))
                            const id = j?.data?.id
                            const url = j?.data?.url
                            if (!id || !url) {
                              toast.error('File upload response was invalid')
                              return
                            }
                            setValue({ id, url, originalFilename: file.name })
                            toast.success('File uploaded')
                          } catch {
                            toast.error('File upload failed')
                          } finally {
                            e.target.value = ''
                          }
                        }
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <div className="space-y-2">
                              <Input
                                type="file"
                                onChange={handleFileChange}
                                className="h-9 text-sm"
                              />
                              {currentLabel && (
                                <div className="flex items-center justify-between text-[11px] text-neutral-low">
                                  <span className="truncate max-w-[220px]" title={currentLabel}>
                                    Attached: {currentLabel}
                                  </span>
                                  <button
                                    type="button"
                                    className="text-xs text-danger hover:underline"
                                    onClick={() => setValue(null)}
                                  >
                                    Clear
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      if (f.fieldType === 'icon') {
                        const current: string = typeof entry.value === 'string' ? entry.value : ''
                        return (
                          <div key={f.id}>
                            <label className="block text-sm font-medium text-neutral-medium mb-1">
                              {f.label}
                            </label>
                            <div className="space-y-1">
                              <Input
                                type="text"
                                value={current}
                                onChange={(e) => setValue(e.target.value)}
                                placeholder="fa-solid fa-briefcase"
                              />
                              <p className="text-[11px] text-neutral-low">
                                Enter a Font Awesome class string (for example{' '}
                                <code className="font-mono text-[11px]">fa-solid fa-briefcase</code>
                                ). This will be rendered wherever the field is used.
                              </p>
                              {current && (
                                <div className="flex items-center gap-2 text-[11px] text-neutral-medium">
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-backdrop-medium">
                                    <i className={current} aria-hidden="true" />
                                  </span>
                                  <span className="truncate max-w-[220px]" title={current}>
                                    {current}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      }
                      // Fallback simple input
                      return (
                        <div key={f.id}>
                          <label className="block text-sm font-medium text-neutral-medium mb-1">
                            {f.label}
                          </label>
                          <Input
                            value={entry.value ?? ''}
                            onChange={(e) => setValue(e.target.value)}
                            placeholder={f.label}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Modules integrated into Content (hidden when modules are disabled) */}
              {modulesEnabled && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-base font-semibold text-neutral-high">Modules</h3>
                      {modules.length > 0 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setModulesAccordionOpen(new Set(modules.map((m) => m.id)))}
                            className="text-[10px] uppercase tracking-wider text-neutral-low hover:text-primary transition-colors"
                          >
                            Expand All
                          </button>
                          <span className="text-neutral-low/30 text-[10px]">|</span>
                          <button
                            type="button"
                            onClick={() => setModulesAccordionOpen(new Set())}
                            className="text-[10px] uppercase tracking-wider text-neutral-low hover:text-primary transition-colors"
                          >
                            Collapse All
                          </button>
                        </div>
                      )}
                    </div>
                    <ModulePicker
                      postId={post.id}
                      postType={post.type}
                      mode={viewMode === 'review' ? 'review' : viewMode === 'ai-review' ? 'ai-review' : 'publish'}
                      onAdd={handleAddModule}
                    />
                  </div>
                  {modules.length === 0 ? (
                    <div className="text-center py-12 text-neutral-low">
                      <p>No modules yet. Use “Add Module” to insert one.</p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={onDragStart}
                      onDragCancel={onDragCancel}
                      onDragEnd={onDragEnd}
                    >
                      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                        <ul className="space-y-3">
                          {sortedModules.map((m) => (
                            <ModuleRow
                              key={m.id}
                              m={m}
                              viewMode={viewMode}
                              isDraggingModules={isDraggingModules}
                              modulesAccordionOpen={modulesAccordionOpen}
                              moduleSchemasReady={moduleSchemasReady}
                              moduleFieldAgents={moduleFieldAgents}
                              globalSlugToLabel={globalSlugToLabel}
                              moduleRegistry={moduleRegistry}
                              moduleFlushFns={moduleFlushFns}
                              setModulesAccordionOpen={setModulesAccordionOpen}
                              setPendingRemoved={setPendingRemoved}
                              setPendingReviewRemoved={setPendingReviewRemoved}
                              setModules={setModules}
                              registerModuleFlush={registerModuleFlush}
                              stageModuleEdits={stageModuleEdits}
                              markModuleDirty={markModuleDirty}
                              postId={post.id}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
              )}
            </div>

            {/* SEO Card */}
            <div className="bg-backdrop-low rounded-lg p-6 border border-line-low">
              <h2 className="text-lg font-semibold text-neutral-high mb-4">SEO</h2>

              <div className="space-y-4">
                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Slug *
                  </label>
                  <Input
                    type="text"
                    value={data.slug}
                    onChange={(e) => {
                      const v = String(e.target.value || '')
                        .toLowerCase()
                        .replace(/[^a-z0-9-]+/g, '-')
                      setData('slug', v)
                      // If user clears slug, re-enable auto; otherwise consider it manually controlled
                      setSlugAuto(v === '')
                    }}
                    onBlur={() => {
                      // Normalize fully on blur
                      const v = slugify(String((data as any).slug || ''))
                      setData('slug', v)
                    }}
                    className="font-mono text-sm"
                    placeholder="post-slug"
                  />
                  {errors.slug && <p className="text-sm text-[#dc2626] mt-1">{errors.slug}</p>}
                  {pathPattern && (
                    <p className="mt-1 text-xs text-neutral-low font-mono">
                      Preview: {buildPreviewPath(data.slug)}
                    </p>
                  )}
                </div>
                {/* Meta Title */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Meta Title
                  </label>
                  <Input
                    type="text"
                    value={data.metaTitle}
                    onChange={(e) => setData('metaTitle', e.target.value)}
                    placeholder="Custom meta title (optional)"
                  />
                  <p className="text-xs text-neutral-low mt-1">Leave blank to use post title</p>
                </div>

                {/* Meta Description */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Meta Description
                  </label>
                  <Textarea
                    value={data.metaDescription}
                    onChange={(e) => setData('metaDescription', e.target.value)}
                    rows={3}
                    placeholder="Custom meta description (optional)"
                  />
                  <p className="text-xs text-neutral-low mt-1">Recommended: 150-160 characters</p>
                </div>

                {/* Canonical URL */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Canonical URL
                  </label>
                  <Input
                    type="url"
                    value={data.canonicalUrl}
                    onChange={(e) => setData('canonicalUrl', e.target.value)}
                    placeholder="https://example.com/my-post"
                  />
                </div>

                {/* Robots JSON */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    Robots (JSON)
                  </label>
                  <Textarea
                    value={data.robotsJson}
                    onChange={(e) => setData('robotsJson', e.target.value)}
                    rows={4}
                    className="font-mono text-xs"
                    placeholder={JSON.stringify({ index: true, follow: true }, null, 2)}
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Leave empty for defaults. Must be valid JSON.
                  </p>
                </div>

                {/* JSON-LD Overrides */}
                <div>
                  <label className="block text-sm font-medium text-neutral-medium mb-1">
                    JSON-LD Overrides (JSON)
                  </label>
                  <Textarea
                    value={data.jsonldOverrides}
                    onChange={(e) => setData('jsonldOverrides', e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                    placeholder={JSON.stringify({ '@type': 'BlogPosting' }, null, 2)}
                  />
                  <p className="text-xs text-neutral-low mt-1">
                    Leave empty to auto-generate structured data.
                  </p>
                </div>
              </div>
            </div>

            {/* end left column */}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-6">
            {/* Actions */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <h3 className="text-sm font-semibold text-neutral-high mb-4">Actions</h3>
              <div className="space-y-6">
                {/* Active Version toggle */}
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded border border-border overflow-hidden">
                    {hasSourceBaseline && (
                      <button
                        type="button"
                        onClick={async () => {
                          // Preserve unsaved module edits for the current version before switching.
                          await flushAllModuleEdits()
                          setViewMode('source')
                          // Update URL to preserve view mode on reload
                          const url = new URL(window.location.href)
                          url.searchParams.set('view', 'source')
                          window.history.replaceState({}, '', url.toString())
                        }}
                        className={`px-2 py-1 text-xs ${viewMode === 'source' ? 'bg-standout-medium text-on-standout' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                      >
                        Source
                      </button>
                    )}
                    {hasReviewBaseline && (canSaveForReview || canApproveReview) && (
                      <button
                        type="button"
                        onClick={async () => {
                          await flushAllModuleEdits()
                          setViewMode('review')
                          // Update URL to preserve view mode on reload
                          const url = new URL(window.location.href)
                          url.searchParams.set('view', 'review')
                          window.history.replaceState({}, '', url.toString())
                        }}
                        className={`px-2 py-1 text-xs ${viewMode === 'review' ? 'bg-standout-medium text-on-standout' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                      >
                        Review
                      </button>
                    )}
                    {hasAiReviewBaseline && canApproveAiReview && (
                      <button
                        type="button"
                        onClick={async () => {
                          await flushAllModuleEdits()
                          setViewMode('ai-review')
                          // Update URL to preserve view mode on reload
                          const url = new URL(window.location.href)
                          url.searchParams.set('view', 'ai-review')
                          window.history.replaceState({}, '', url.toString())
                        }}
                        className={`px-2 py-1 text-xs ${viewMode === 'ai-review' ? 'bg-standout-medium text-on-standout' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                      >
                        AI Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Locale Switcher */}
                <div>
                  <label className="block text-xs font-medium text-neutral-medium mb-1">
                    Locale
                  </label>
                  <div className="flex items-center gap-2">
                    <Select
                      defaultValue={selectedLocale}
                      onValueChange={(nextLocale) => {
                        setSelectedLocale(nextLocale)
                        if (nextLocale === post.locale) return
                        const target = translations?.find((t) => t.locale === nextLocale)
                        if (target) {
                          window.location.href = `/admin/posts/${target.id}/edit`
                        }
                      }}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        {availableLocales.map((loc) => {
                          const exists = translationsSet.has(loc)
                          const label = exists
                            ? `${loc.toUpperCase()}`
                            : `${loc.toUpperCase()} (missing)`
                          return (
                            <SelectItem key={loc} value={loc} className="text-xs">
                              {label}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedLocale !== post.locale && !translationsSet.has(selectedLocale) && (
                    <button
                      type="button"
                      className="mt-2 text-xs px-2 py-1 rounded border border-border bg-backdrop-low text-neutral-high hover:bg-backdrop-medium"
                      onClick={async () => {
                        const toCreate = selectedLocale
                        const res = await fetch(`/api/posts/${post.id}/translations`, {
                          method: 'POST',
                          headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                            ...xsrfHeader(),
                          },
                          credentials: 'same-origin',
                          body: JSON.stringify({ locale: toCreate }),
                        })
                        if (res.redirected) {
                          window.location.href = res.url
                          return
                        }
                        if (res.ok) {
                          window.location.reload()
                        } else {
                          toast.error('Failed to create translation')
                        }
                      }}
                    >
                      Create Translation
                    </button>
                  )}
                </div>
                {/* Agent Runner */}
                <div>
                  <label className="block text-xs font-medium text-neutral-medium mb-1">
                    <div className="flex items-center gap-2">
                      <span>Agent</span>
                      <FontAwesomeIcon
                        icon={faWandMagicSparkles}
                        className="text-md text-neutral-high dark:text-neutral-high"
                      />
                    </div>
                  </label>
                  <div>
                    <Select value={selectedAgent} onValueChange={(val) => setSelectedAgent(val)}>
                      <SelectTrigger className="w-full h-8 text-xs">
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                      <SelectContent className="text-xs">
                        {agents.length === 0 ? (
                          <SelectItem value="__none__" disabled className="text-xs">
                            No agents configured
                          </SelectItem>
                        ) : (
                          agents.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-xs">
                              {a.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {selectedAgent && (
                      <>
                        <AlertDialog
                          open={agentPromptOpen}
                          onOpenChange={(open) => {
                            // Always allow opening (even if running - shouldn't happen but be safe)
                            if (open && !agentPromptOpen) {
                              setAgentPromptOpen(true)
                              return
                            }
                            // Don't allow closing if agent is running or has a response
                            if ((runningAgent || agentResponse) && !open) {
                              // Force dialog to stay open - prevent closing
                              return
                            }
                            // Only allow closing when not running and no response
                            if (!runningAgent && !agentResponse) {
                              setAgentPromptOpen(open)
                              if (!open) {
                                // Reset response when closing
                                setAgentResponse(null)
                                setAgentOpenEndedContext('')
                              }
                            }
                          }}
                        >
                          <AlertDialogContent
                            ref={agentModalContentRef}
                            className="max-w-2xl max-h-[80vh] overflow-y-auto"
                          >
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {agentResponse ? 'Agent Response' : 'Instructions'}
                              </AlertDialogTitle>
                              {agentResponse && (
                                <AlertDialogDescription>
                                  Review the AI response and changes that were applied:
                                </AlertDialogDescription>
                              )}
                            </AlertDialogHeader>

                            {runningAgent ? (
                              <div className="mt-3 space-y-4">
                                <div className="flex items-center gap-3">
                                  <Spinner className="size-5 text-primary" />
                                  <div className="text-sm font-medium">Running agent...</div>
                                </div>
                                <div className="text-xs text-neutral-medium">
                                  Please wait while the agent processes your request.
                                </div>
                              </div>
                            ) : !agentResponse ? (
                              <div className="mt-3 space-y-4">
                                {/* Agent History */}
                                {loadingAgentHistory ? (
                                  <div className="flex items-center gap-2 text-xs text-neutral-medium">
                                    <Spinner className="size-4" />
                                    <span>Loading history...</span>
                                  </div>
                                ) : agentHistory.length > 0 ? (
                                  <div className="space-y-3">
                                    {[...agentHistory].reverse().map((item) => (
                                      <div key={item.id} className="space-y-2">
                                        {/* User Request */}
                                        {item.request && (
                                          <div className="flex justify-end">
                                            <div className="max-w-[80%] space-y-1">
                                              {item.user && (
                                                <div className="text-xs text-neutral-medium text-right mb-1">
                                                  {item.user.fullName || item.user.email}
                                                </div>
                                              )}
                                              <div className="bg-primary text-on-primary p-3 rounded-lg rounded-tr-sm text-sm">
                                                {item.request}
                                              </div>
                                              <div className="text-xs text-neutral-low text-right">
                                                {new Date(item.createdAt).toLocaleString()}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        {/* AI Response */}
                                        {item.response && (
                                          <div className="flex justify-start">
                                            <div className="max-w-[80%] space-y-1">
                                              <div className="bg-backdrop-medium p-3 rounded-lg rounded-tl-sm border border-line-medium text-sm">
                                                {item.response.summary ||
                                                  (item.response.rawResponse
                                                    ? (() => {
                                                      try {
                                                        const jsonMatch =
                                                          item.response.rawResponse?.match(
                                                            /```(?:json)?\s*(\{[\s\S]*\})\s*```/
                                                          )
                                                        const jsonStr = jsonMatch
                                                          ? jsonMatch[1]
                                                          : item.response.rawResponse
                                                        const parsed = JSON.parse(jsonStr)
                                                        return (
                                                          parsed.summary || 'Changes applied.'
                                                        )
                                                      } catch {
                                                        return (
                                                          item.response.rawResponse ||
                                                          'Changes applied.'
                                                        )
                                                      }
                                                    })()
                                                    : 'Changes applied.')}
                                              </div>
                                              {item.response.applied &&
                                                item.response.applied.length > 0 && (
                                                  <div className="text-xs text-neutral-medium">
                                                    Applied: {item.response.applied.join(', ')}
                                                  </div>
                                                )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {/* Label and Description - only show when no response and history is loaded or empty */}
                                {!agentResponse && !loadingAgentHistory && (
                                  <div className="space-y-2 pt-4">
                                    {/* Label (e.g., "What would you like the AI to help with?") */}
                                    {(() => {
                                      const a = agents.find((x) => x.id === selectedAgent)
                                      const label = a?.openEndedContext?.label
                                      if (label) {
                                        return (
                                          <div className="text-md font-medium text-neutral-high">
                                            {label}
                                          </div>
                                        )
                                      }
                                      return null
                                    })()}
                                    {/* Description */}
                                    <div className="text-sm text-neutral-medium whitespace-pre-wrap">
                                      {(() => {
                                        const a = agents.find((x) => x.id === selectedAgent)
                                        if (a?.description) {
                                          return a.description
                                        }
                                        return 'Provide any extra context or requirements for this agent run.'
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {/* Current Input */}
                                <div className="space-y-2">
                                  <Textarea
                                    value={agentOpenEndedContext}
                                    onChange={(e) => setAgentOpenEndedContext(e.target.value)}
                                    placeholder={(() => {
                                      const a = agents.find((x) => x.id === selectedAgent)
                                      return (
                                        a?.openEndedContext?.placeholder ||
                                        'Example: "Rewrite this page for a more confident tone. Keep it under 500 words. Preserve the CTA."'
                                      )
                                    })()}
                                    className="min-h-[120px]"
                                  />
                                  {(() => {
                                    const a = agents.find((x) => x.id === selectedAgent)
                                    const max = a?.openEndedContext?.maxChars
                                    if (!max) return null
                                    return (
                                      <div className="text-xs text-neutral-medium">
                                        {agentOpenEndedContext.length}/{max}
                                      </div>
                                    )
                                  })()}
                                </div>
                              </div>
                            ) : (
                              <div className="mt-3 space-y-4">
                                {/* Show user's request */}
                                {agentOpenEndedContext && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-neutral-medium">Your request:</div>
                                    <div className="bg-backdrop-medium p-3 rounded border border-neutral-border text-sm">
                                      {agentOpenEndedContext}
                                    </div>
                                  </div>
                                )}

                                {/* Show AI's natural response */}
                                {agentResponse.summary && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-neutral-medium">AI Response:</div>
                                    <div className="bg-standout-light p-4 rounded-lg border border-standout-medium text-sm whitespace-pre-wrap wrap-break-word">
                                      {agentResponse.summary}
                                    </div>
                                  </div>
                                )}
                                {/* Fallback: Try to extract summary from raw response if not provided */}
                                {!agentResponse.summary && agentResponse.rawResponse && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-neutral-medium">AI Response:</div>
                                    <div className="bg-standout-light p-4 rounded-lg border border-standout-medium text-sm whitespace-pre-wrap wrap-break-word">
                                      {(() => {
                                        const raw = agentResponse.rawResponse
                                        // Try to parse as JSON and extract summary
                                        try {
                                          // First try to extract JSON from markdown code blocks
                                          const jsonMatch = raw.match(
                                            /```(?:json)?\s*(\{[\s\S]*\})\s*```/
                                          )
                                          const jsonStr = jsonMatch ? jsonMatch[1] : raw
                                          const parsed = JSON.parse(jsonStr)
                                          // If there's a summary field, use it
                                          if (
                                            parsed.summary &&
                                            typeof parsed.summary === 'string'
                                          ) {
                                            return parsed.summary
                                          }
                                          // If no summary, return a message indicating we couldn't extract it
                                          return 'Summary not available. Changes have been applied.'
                                        } catch {
                                          // If parsing fails, return raw (shouldn't happen normally)
                                          return raw
                                        }
                                      })()}
                                    </div>
                                  </div>
                                )}

                                {agentResponse.applied && agentResponse.applied.length > 0 && (
                                  <div className="space-y-1">
                                    <div className="text-xs text-neutral-medium">
                                      Changes applied:
                                    </div>
                                    <div className="bg-success-light p-3 rounded border border-success-medium">
                                      <ul className="list-disc list-inside space-y-1 text-sm">
                                        {agentResponse.applied.map((field, i) => (
                                          <li key={i}>{field}</li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}

                                {agentResponse.message && (
                                  <div className="text-sm text-success-medium font-medium">
                                    {agentResponse.message}
                                  </div>
                                )}
                              </div>
                            )}

                            <AlertDialogFooter>
                              {agentResponse ? (
                                <>
                                  <AlertDialogCancel
                                    type="button"
                                    onClick={() => {
                                      setAgentPromptOpen(false)
                                      setAgentResponse(null)
                                      setAgentOpenEndedContext('')
                                    }}
                                  >
                                    Close
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    type="button"
                                    onClick={() => {
                                      setAgentPromptOpen(false)
                                      setAgentResponse(null)
                                      setAgentOpenEndedContext('')
                                      // Switch to AI Review view to see the changes
                                      const agent = agents.find((x) => x.id === selectedAgent)
                                      const targetMode =
                                        (agent as any)?.type === 'internal' ? 'ai-review' : 'review'
                                      // Update URL to preserve view mode on reload
                                      const url = new URL(window.location.href)
                                      url.searchParams.set('view', targetMode)
                                      window.history.replaceState({}, '', url.toString())
                                      // Reload data to get the latest changes from the agent
                                      router.reload({
                                        only:
                                          targetMode === 'ai-review'
                                            ? ['aiReviewDraft', 'post', 'modules']
                                            : ['reviewDraft', 'post', 'modules'],
                                        onSuccess: () => {
                                          // After reload, switch to the target mode
                                          setViewMode(targetMode)
                                        },
                                      })
                                    }}
                                  >
                                    View Changes
                                  </AlertDialogAction>
                                </>
                              ) : (
                                <>
                                  <AlertDialogCancel
                                    type="button"
                                    onClick={() => {
                                      setAgentPromptOpen(false)
                                      setAgentResponse(null)
                                    }}
                                  >
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    type="button"
                                    disabled={runningAgent}
                                    onClick={async (e) => {
                                      // Prevent default form submission behavior and stop propagation
                                      e.preventDefault()
                                      e.stopPropagation()
                                      if (!selectedAgent) return
                                      // CRITICAL: Set running state BEFORE any async operations
                                      // This prevents the dialog from closing via onOpenChange
                                      setRunningAgent(true)
                                      setAgentResponse(null)
                                      // Force dialog to stay open
                                      setAgentPromptOpen(true)
                                      try {
                                        const csrf = (() => {
                                          if (typeof document === 'undefined') return undefined
                                          const m = document.cookie.match(
                                            /(?:^|; )XSRF-TOKEN=([^;]+)/
                                          )
                                          return m ? decodeURIComponent(m[1]) : undefined
                                        })()

                                        const openEnded = agentOpenEndedContext.trim()
                                        const res = await fetch(
                                          `/api/posts/${post.id}/agents/${encodeURIComponent(selectedAgent)}/run`,
                                          {
                                            method: 'POST',
                                            headers: {
                                              'Accept': 'application/json',
                                              'Content-Type': 'application/json',
                                              ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
                                            },
                                            credentials: 'same-origin',
                                            body: JSON.stringify({
                                              context: {
                                                locale: selectedLocale,
                                                viewMode: viewMode, // Pass current view mode to agent
                                              },
                                              openEndedContext: openEnded || undefined,
                                            }),
                                          }
                                        )
                                        const j = await res.json().catch(() => ({}))
                                        if (res.ok) {
                                          // Keep dialog open and show response
                                          setAgentResponse({
                                            rawResponse: j.rawResponse,
                                            summary: j.summary || null,
                                            applied: j.applied || [],
                                            message: j.message,
                                          })
                                          toast.success('Agent completed successfully')

                                          // Refresh agent history to show the new execution
                                          try {
                                            const historyRes = await fetch(
                                              `/api/posts/${post.id}/agents/${encodeURIComponent(selectedAgent)}/history`,
                                              {
                                                headers: { Accept: 'application/json' },
                                                credentials: 'same-origin',
                                              }
                                            )
                                            if (historyRes.ok) {
                                              const historyJson = await historyRes
                                                .json()
                                                .catch(() => null)
                                              if (historyJson?.data) {
                                                setAgentHistory(
                                                  Array.isArray(historyJson.data)
                                                    ? historyJson.data
                                                    : []
                                                )
                                              }
                                            }
                                          } catch {
                                            // Ignore history refresh errors
                                          }

                                          // Refresh page data to load updated aiReviewDraft and modules
                                          // Delay reload slightly to ensure dialog state is set first
                                          // Wrap in try-catch to prevent reload errors from affecting the UI
                                          setTimeout(() => {
                                            try {
                                              router.reload({
                                                only: ['aiReviewDraft', 'post', 'modules'],
                                              })
                                            } catch (reloadError) {
                                              console.warn(
                                                'Page reload failed (non-critical):',
                                                reloadError
                                              )
                                              // Reload failed but agent succeeded - user can manually refresh
                                            }
                                          }, 100)
                                        } else {
                                          toast.error(j?.error || 'Agent run failed')
                                          setAgentResponse({
                                            message: `Error: ${j?.error || 'Agent run failed'}`,
                                          })
                                        }
                                      } catch (error: any) {
                                        console.error('Agent execution error:', error)
                                        toast.error('Agent run failed')
                                        setAgentResponse({
                                          message: `Error: ${error?.message || 'Agent run failed'}`,
                                        })
                                      } finally {
                                        setRunningAgent(false)
                                      }
                                    }}
                                  >
                                    {runningAgent ? 'Running…' : 'Run Agent'}
                                  </AlertDialogAction>
                                </>
                              )}
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        <button
                          className="mt-2 w-full h-8 px-3 text-xs rounded-lg bg-standout-medium text-on-standout font-medium disabled:opacity-50"
                          disabled={runningAgent}
                          onClick={() => {
                            const a = agents.find((x) => x.id === selectedAgent)
                            const enabled = a?.openEndedContext?.enabled === true
                            if (enabled) {
                              setAgentPromptOpen(true)
                              return
                            }
                            // No prompt required: run immediately, but still show response in dialog
                            ; (async () => {
                              // Open dialog FIRST to ensure it's open before setting running state
                              setAgentPromptOpen(true)
                              // Use requestAnimationFrame to ensure dialog state is set before preventing close
                              await new Promise((resolve) => requestAnimationFrame(resolve))
                              setRunningAgent(true)
                              setAgentResponse(null)
                              try {
                                const csrf = (() => {
                                  if (typeof document === 'undefined') return undefined
                                  const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
                                  return m ? decodeURIComponent(m[1]) : undefined
                                })()
                                const res = await fetch(
                                  `/api/posts/${post.id}/agents/${encodeURIComponent(selectedAgent)}/run`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Accept': 'application/json',
                                      'Content-Type': 'application/json',
                                      ...(csrf ? { 'X-XSRF-TOKEN': csrf } : {}),
                                    },
                                    credentials: 'same-origin',
                                    body: JSON.stringify({ context: { locale: selectedLocale } }),
                                  }
                                )
                                const j = await res.json().catch(() => ({}))
                                if (res.ok) {
                                  // Show response in dialog
                                  setAgentResponse({
                                    rawResponse: j.rawResponse,
                                    applied: j.applied || [],
                                    message: j.message,
                                  })
                                  toast.success('Agent completed successfully')

                                  // Refresh agent history to show the new execution
                                  try {
                                    const historyRes = await fetch(
                                      `/api/posts/${post.id}/agents/${encodeURIComponent(selectedAgent)}/history`,
                                      {
                                        headers: { Accept: 'application/json' },
                                        credentials: 'same-origin',
                                      }
                                    )
                                    if (historyRes.ok) {
                                      const historyJson = await historyRes.json().catch(() => null)
                                      if (historyJson?.data) {
                                        setAgentHistory(
                                          Array.isArray(historyJson.data) ? historyJson.data : []
                                        )
                                      }
                                    }
                                  } catch {
                                    // Ignore history refresh errors
                                  }

                                  // Refresh page data to load updated aiReviewDraft
                                  setTimeout(() => {
                                    try {
                                      router.reload({ only: ['aiReviewDraft', 'post'] })
                                    } catch (reloadError) {
                                      console.warn(
                                        'Page reload failed (non-critical):',
                                        reloadError
                                      )
                                    }
                                  }, 100)
                                } else {
                                  toast.error(j?.error || 'Agent run failed')
                                  setAgentResponse({
                                    message: `Error: ${j?.error || 'Agent run failed'}`,
                                  })
                                }
                              } catch (error: any) {
                                console.error('Agent execution error:', error)
                                toast.error('Agent run failed')
                                setAgentResponse({
                                  message: `Error: ${error?.message || 'Agent run failed'}`,
                                })
                              } finally {
                                setRunningAgent(false)
                              }
                            })()
                          }}
                          type="button"
                        >
                          {runningAgent ? 'Running…' : 'Run Agent'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {/* Status (Source only) */}
                {viewMode === 'source' && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-medium mb-1">
                      Status
                    </label>
                    <div className="flex items-center gap-2">
                      <Select
                        defaultValue={data.status}
                        onValueChange={(val) => setData('status', val)}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          {canPublish && <SelectItem value="published">Published</SelectItem>}
                          <SelectItem value="private">Private</SelectItem>
                          <SelectItem value="protected">Protected</SelectItem>
                          {canPublish && <SelectItem value="archived">Archived</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    {errors.status && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.status}</p>
                    )}
                    {data.status === 'scheduled' && (
                      <div className="mt-3 space-y-2">
                        <label className="block text-xs font-medium text-neutral-medium">
                          Scheduled Date
                        </label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="px-3 py-2 text-sm border border-line-low rounded hover:bg-backdrop-medium text-neutral-high"
                            >
                              {(data as any).scheduledAt
                                ? new Date((data as any).scheduledAt).toLocaleDateString()
                                : 'Pick a date'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="p-0">
                            <Calendar
                              mode="single"
                              selected={
                                (data as any).scheduledAt
                                  ? new Date((data as any).scheduledAt)
                                  : undefined
                              }
                              onSelect={(d: Date | undefined) => {
                                if (!d) {
                                  setData('scheduledAt' as any, '')
                                  return
                                }
                                const local = new Date(
                                  d.getFullYear(),
                                  d.getMonth(),
                                  d.getDate(),
                                  0,
                                  0,
                                  0
                                )
                                setData('scheduledAt' as any, local.toISOString())
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                        <p className="text-xs text-neutral-low">
                          Scheduler will publish on the selected day.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {/* Save edits (Source can save to Source or Review) */}
                {viewMode === 'source' && (
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-neutral-medium">
                      Save edits to
                    </label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={saveTarget}
                        onValueChange={async (val) => {
                          // Changing the save target should not change the visible version,
                          // and must not discard in-progress module edits. Stash local edits first.
                          await flushAllModuleEdits()
                          setSaveTarget(val as any)
                        }}
                      >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          <SelectItem value="source" className="text-xs">
                            Source
                          </SelectItem>
                          {canSaveForReview && (
                            <SelectItem value="review" className="text-xs">
                              Review
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        className={`h-8 px-3 text-xs rounded-lg disabled:opacity-50 ${!isDirty || processing ? 'border border-border text-neutral-medium' : 'bg-standout-medium text-on-standout font-medium'}`}
                        disabled={
                          !isDirty || processing || (saveTarget === 'review' && !canSaveForReview)
                        }
                        onClick={async () => {
                          // Destructive confirmation when saving to Review that already exists.
                          if (saveTarget === 'review' && hasReviewBaseline) {
                            setPendingSaveTarget(saveTarget)
                            setSaveConfirmOpen(true)
                            return
                          }
                          await executeSave(saveTarget)
                        }}
                      >
                        {saveTarget === 'source'
                          ? data.status === 'published'
                            ? 'Publish'
                            : 'Save'
                          : 'Save'}
                      </button>
                    </div>
                    {saveTarget === 'review' && !canSaveForReview && (
                      <p className="text-xs text-neutral-low">
                        You don't have permission to save to Review.
                      </p>
                    )}
                  </div>
                )}

                {/* Save button for Review view mode */}
                {viewMode === 'review' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      className={`h-8 px-3 text-xs rounded-lg disabled:opacity-50 ${!isDirty || processing ? 'border border-border text-neutral-medium' : 'bg-standout-medium text-on-standout font-medium'}`}
                      disabled={!isDirty || processing || !canSaveForReview}
                      onClick={async () => {
                        await executeSave('review')
                      }}
                    >
                      Save
                    </button>
                    {!canSaveForReview && (
                      <p className="text-xs text-neutral-low">
                        You don't have permission to save to Review.
                      </p>
                    )}
                  </div>
                )}

                {/* Save button for AI Review view mode */}
                {viewMode === 'ai-review' && (
                  <div className="space-y-2">
                    <p className="text-xs text-neutral-low">AI Review is AI-generated.</p>
                    <button
                      type="button"
                      className={`h-8 px-3 text-xs rounded-lg disabled:opacity-50 ${!isDirty || processing ? 'border border-border text-neutral-medium' : 'bg-standout-medium text-on-standout font-medium'}`}
                      disabled={!isDirty || processing}
                      onClick={async () => {
                        await executeSave('ai-review')
                      }}
                    >
                      Save
                    </button>
                  </div>
                )}

                {/* Approve/Reject decision (RadioGroup) */}
                {viewMode !== 'source' &&
                  ((hasAiReviewBaseline && canApproveAiReview) ||
                    (hasReviewBaseline && canApproveReview)) && (
                    <div
                      className={`space-y-2 ${isDirty ? 'opacity-50' : ''}`}
                      aria-disabled={isDirty ? true : undefined}
                    >
                      <label className="block text-xs font-medium text-neutral-medium">
                        Decision
                      </label>
                      <RadioGroup
                        value={decision}
                        onValueChange={(val) => setDecision(val as any)}
                        className={`space-y-2 ${isDirty ? 'pointer-events-none' : ''}`}
                      >
                        {hasReviewBaseline && canApproveReview && (
                          <label className="flex items-center gap-2 text-xs text-neutral-high">
                            <RadioGroupItem value="approve-review-to-source" />
                            <span>Promote to Source</span>
                          </label>
                        )}
                        {hasAiReviewBaseline && canApproveAiReview && viewMode === 'ai-review' && (
                          <label className="flex items-center gap-2 text-xs text-neutral-high">
                            <RadioGroupItem value="approve-ai-review-to-review" />
                            <span>Promote to Review</span>
                          </label>
                        )}
                        {hasReviewBaseline && canApproveReview && viewMode === 'review' && (
                          <label className="flex items-center gap-2 text-xs text-neutral-high">
                            <RadioGroupItem value="reject-review" />
                            <span>Reject this version</span>
                          </label>
                        )}
                        {hasAiReviewBaseline && canApproveAiReview && viewMode === 'ai-review' && (
                          <label className="flex items-center gap-2 text-xs text-neutral-high">
                            <RadioGroupItem value="reject-ai-review" />
                            <span>Reject this version</span>
                          </label>
                        )}
                      </RadioGroup>

                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          className="h-8 px-3 text-xs border border-border rounded-lg hover:bg-backdrop-medium text-neutral-medium disabled:opacity-50"
                          disabled={isDirty || !decision || processing}
                          onClick={async () => {
                            if (!decision) return
                            if (decision.startsWith('reject-')) {
                              setRejectConfirmOpen(true)
                              return
                            }
                            setApproveConfirmOpen(true)
                          }}
                        >
                          {decision.startsWith('reject-') ? 'Reject' : 'Approve'}
                        </button>
                      </div>

                      <AlertDialog open={approveConfirmOpen} onOpenChange={setApproveConfirmOpen}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Approve changes?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {decision === 'approve-ai-review-to-review'
                                ? 'This will promote AI Review into Review (and clear AI Review staging).'
                                : 'This will promote Review into Source (and clear the Review draft).'}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                setApproveConfirmOpen(false)
                                const mode =
                                  decision === 'approve-ai-review-to-review'
                                    ? 'approve-ai-review'
                                    : 'approve'
                                await executeApprove(mode)
                              }}
                            >
                              Approve
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog open={rejectConfirmOpen} onOpenChange={setRejectConfirmOpen}>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reject this version?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will remove the selected draft/staging version. A revision will
                              be recorded so you can revert.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                if (!decision || !decision.startsWith('reject-')) return
                                const mode =
                                  decision === 'reject-ai-review'
                                    ? 'reject-ai-review'
                                    : 'reject-review'
                                const res = await fetch(`/api/posts/${post.id}`, {
                                  method: 'PUT',
                                  headers: {
                                    'Accept': 'application/json',
                                    'Content-Type': 'application/json',
                                    ...xsrfHeader(),
                                  },
                                  credentials: 'same-origin',
                                  body: JSON.stringify({ mode }),
                                })
                                if (res.ok) {
                                  toast.success(
                                    mode === 'reject-ai-review'
                                      ? 'AI Review discarded'
                                      : 'Review discarded'
                                  )
                                  setRejectConfirmOpen(false)
                                  window.location.reload()
                                } else {
                                  const err = await res.json().catch(() => null)
                                  console.error('Reject failed:', res.status, err)
                                  toast.error(err?.errors ? 'Failed (validation)' : 'Failed')
                                }
                              }}
                            >
                              Reject
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}

                {/* Save confirmation dialog for overwriting Review draft */}
                <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Overwrite Review draft?</AlertDialogTitle>
                      <AlertDialogDescription>
                        A Review draft already exists. Saving to Review will overwrite it.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel
                        onClick={() => {
                          setSaveConfirmOpen(false)
                          setPendingSaveTarget(null)
                        }}
                      >
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={async () => {
                          const target = pendingSaveTarget
                          setSaveConfirmOpen(false)
                          setPendingSaveTarget(null)
                          if (!target) return
                          await executeSave(target)
                        }}
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Unpublish action handled by changing status to draft and saving */}
              </div>
            </div>

            {/* Author (Admin) */}
            {isAdmin && (
              <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
                <h3 className="text-sm font-semibold text-neutral-high mb-4">Author</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <div className="text-neutral-low">Current</div>
                    <div className="font-medium text-neutral-high">
                      {post.author?.fullName || post.author?.email || '—'}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-medium mb-1">
                      Reassign to
                    </label>
                    <select
                      className="w-full border border-line-low bg-backdrop-input text-neutral-high rounded px-2 py-1"
                      value={selectedAuthorId ?? ''}
                      onChange={(e) =>
                        setSelectedAuthorId(e.target.value ? Number(e.target.value) : null)
                      }
                      onFocus={async () => {
                        if (users.length > 0) return
                        try {
                          const res = await fetch('/api/users', { credentials: 'same-origin' })
                          const j = await res.json().catch(() => ({}))
                          const list: Array<{
                            id: number
                            email: string
                            fullName?: string | null
                          }> = Array.isArray(j?.data) ? j.data : []
                          setUsers(
                            list.map((u) => ({
                              id: u.id,
                              email: u.email,
                              fullName: (u as any).fullName ?? null,
                            }))
                          )
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      <option value="">Select a user…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName || u.email} ({u.email})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-sm border border-border rounded hover:bg-backdrop-medium text-neutral-high disabled:opacity-50"
                      disabled={!selectedAuthorId || selectedAuthorId === (post.author?.id ?? null)}
                      onClick={async () => {
                        if (!selectedAuthorId) return
                        try {
                          const res = await fetch(`/api/posts/${post.id}/author`, {
                            method: 'PATCH',
                            headers: {
                              'Accept': 'application/json',
                              'Content-Type': 'application/json',
                              ...xsrfHeader(),
                            },
                            credentials: 'same-origin',
                            body: JSON.stringify({ authorId: selectedAuthorId }),
                          })
                          const j = await res.json().catch(() => ({}))
                          if (!res.ok) {
                            toast.error(j?.error || 'Failed to update author')
                            return
                          }
                          toast.success('Author updated')
                          window.location.reload()
                        } catch {
                          toast.error('Failed to update author')
                        }
                      }}
                    >
                      Update Author
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Revisions */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-neutral-high">Revisions</h3>
                <button
                  type="button"
                  className="text-xs px-2 py-1 border border-border rounded hover:bg-backdrop-medium text-neutral-medium"
                  onClick={async () => {
                    // reload revisions
                    const res = await fetch(`/api/posts/${post.id}/revisions?limit=10`, {
                      headers: { Accept: 'application/json' },
                      credentials: 'same-origin',
                    })
                    if (res.ok) {
                      const json = await res.json().catch(() => null)
                      if (json?.data) setRevisions(json.data)
                    }
                  }}
                >
                  Refresh
                </button>
              </div>
              {loadingRevisions ? (
                <p className="text-sm text-neutral-low">Loading…</p>
              ) : revisions.length === 0 ? (
                <p className="text-sm text-neutral-low">No revisions yet.</p>
              ) : (
                <ul className="space-y-2">
                  {revisions.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <div className="flex flex-col">
                        <span className="text-neutral-high">
                          {new Date(r.createdAt).toLocaleString()}
                          <Badge
                            className="ml-2"
                            variant={
                              r.mode === 'review'
                                ? 'secondary'
                                : r.mode === 'ai-review'
                                  ? 'outline'
                                  : 'default'
                            }
                          >
                            {r.mode === 'review'
                              ? 'Review'
                              : r.mode === 'ai-review'
                                ? 'AI Review'
                                : 'Source'}
                          </Badge>
                        </span>
                        {r.user?.email ? (
                          <span className="text-xs text-neutral-low">{r.user.email}</span>
                        ) : null}
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            className="px-2 py-1 text-xs border border-border rounded hover:bg-backdrop-medium text-neutral-medium"
                            type="button"
                          >
                            Revert
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Revert to this revision?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will replace current content with the selected revision.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                const res = await fetch(
                                  `/api/posts/${post.id}/revisions/${encodeURIComponent(r.id)}/revert`,
                                  {
                                    method: 'POST',
                                    headers: {
                                      'Accept': 'application/json',
                                      'Content-Type': 'application/json',
                                      ...xsrfHeader(),
                                    },
                                    credentials: 'same-origin',
                                  }
                                )
                                if (res.ok) {
                                  toast.success('Reverted to selected revision')
                                  // Reload all post data including modules and drafts
                                  router.reload({
                                    only: ['post', 'modules', 'reviewDraft', 'aiReviewDraft'],
                                  })
                                } else {
                                  const j = await res.json().catch(() => null)
                                  toast.error(j?.error || 'Failed to revert')
                                }
                              }}
                            >
                              Confirm
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Import / Export (Admin only) */}
            {isAdmin && (
              <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
                <h3 className="text-sm font-semibold text-neutral-high mb-3">Import / Export</h3>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 text-sm border border-border rounded hover:bg-backdrop-medium text-neutral-high"
                    onClick={() => {
                      const url = `/api/posts/${post.id}/export?download=1`
                      window.open(url, '_blank')
                    }}
                  >
                    Export JSON
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      ref={importFileRef}
                      type="file"
                      accept="application/json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        try {
                          const text = await file.text()
                          const data = JSON.parse(text)
                          setPendingImportJson(data)
                          setIsImportModeOpen(true)
                        } catch {
                          toast.error('Invalid JSON file')
                        } finally {
                          if (importFileRef.current) importFileRef.current.value = ''
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="px-3 py-2 text-sm border border-border rounded hover:bg-backdrop-medium text-neutral-high"
                      onClick={() => importFileRef.current?.click()}
                    >
                      Import JSON
                    </button>
                  </div>
                  <p className="text-xs text-neutral-low">
                    Select a JSON file, then choose how to import.
                  </p>
                </div>
              </div>
            )}

            {/* Post Details */}
            <div className="bg-backdrop-low rounded-lg shadow p-6 border border-border">
              <h3 className="text-sm font-semibold text-neutral-high mb-4">Post Details</h3>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-neutral-low">Status</dt>
                  <dd className="font-medium text-neutral-high capitalize">{data.status}</dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Type</dt>
                  <dd className="font-medium text-neutral-high">{post.type}</dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Locale</dt>
                  <dd className="font-medium text-neutral-high">{post.locale}</dd>
                </div>
                <div>
                  <dt className="text-neutral-low">ID</dt>
                  <dd className="font-mono text-xs text-neutral-medium break-all">{post.id}</dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Created</dt>
                  <dd className="font-medium text-neutral-high">
                    {new Date(post.createdAt).toLocaleString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-low">Updated</dt>
                  <dd className="font-medium text-neutral-high">
                    {new Date(post.updatedAt).toLocaleString()}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </main>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <AdminFooter />
      </div>
      {/* Import Mode Modal (Admin) */}
      {isAdmin && isImportModeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setIsImportModeOpen(false)
              setPendingImportJson(null)
            }}
          />
          <div className="relative z-10 w-full max-w-md rounded-lg border border-line-low bg-backdrop-input p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-neutral-high">Import JSON</h3>
              <button
                className="text-neutral-medium hover:text-neutral-high"
                onClick={() => {
                  setIsImportModeOpen(false)
                  setPendingImportJson(null)
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-neutral-medium mb-4">
              How would you like to import this JSON into the current post?
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="w-full px-3 py-2 text-sm rounded border border-line-low bg-backdrop-input hover:bg-backdrop-medium text-neutral-high"
                onClick={async () => {
                  if (!pendingImportJson) return
                  const res = await fetch(`/api/posts/${post.id}/import`, {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      ...xsrfHeader(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ data: pendingImportJson, mode: 'review' }),
                  })
                  if (res.ok) {
                    toast.success('Imported into review draft')
                    setIsImportModeOpen(false)
                    setPendingImportJson(null)
                    window.location.reload()
                  } else {
                    const j = await res.json().catch(() => null)
                    toast.error(j?.error || 'Import failed')
                  }
                }}
              >
                Import into Review (non-destructive)
              </button>
              <button
                type="button"
                className="w-full px-3 py-2 text-sm rounded bg-standout-medium text-on-standout hover:opacity-90"
                onClick={async () => {
                  if (!pendingImportJson) return
                  const res = await fetch(`/api/posts/${post.id}/import`, {
                    method: 'POST',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json',
                      ...xsrfHeader(),
                    },
                    credentials: 'same-origin',
                    body: JSON.stringify({ data: pendingImportJson, mode: 'replace' }),
                  })
                  if (res.ok) {
                    toast.success('Imported and replaced live content')
                    setIsImportModeOpen(false)
                    setPendingImportJson(null)
                    window.location.reload()
                  } else {
                    const j = await res.json().catch(() => null)
                    toast.error(j?.error || 'Import failed')
                  }
                }}
              >
                Replace Live Content (destructive)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function PostCustomPostReferenceField({
  label,
  value,
  onChange,
  config,
}: {
  label: string
  value: any
  onChange: (val: any) => void
  config?: Record<string, any>
}) {
  const allowedTypes: string[] = Array.isArray((config as any)?.postTypes)
    ? (config as any).postTypes
    : []
  const allowMultiple = (config as any)?.allowMultiple !== false
  const initialVals: string[] = Array.isArray(value)
    ? value.map((v: any) => String(v))
    : value
      ? [String(value)]
      : []
  const [vals, setVals] = useState<string[]>(initialVals)
  const [options, setOptions] = useState<Array<{ label: string; value: string }>>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    onChange(allowMultiple ? vals : (vals[0] ?? null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals, allowMultiple])

  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const params = new URLSearchParams()
          params.set('status', 'published')
          params.set('limit', '100')
          params.set('sortBy', 'published_at')
          params.set('sortOrder', 'desc')
          if (allowedTypes.length > 0) {
            params.set('types', allowedTypes.join(','))
          }
          const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const j = await res.json().catch(() => ({}))
          const list: Array<{ id: string; title: string; slug?: string }> = Array.isArray(j?.data)
            ? j.data
            : []
          if (!alive) return
          setOptions(
            list.map((p) => ({ label: p.title || p.slug || String(p.id), value: String(p.id) }))
          )
        } catch {
          if (!alive) return
          setOptions([])
        }
      })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allowedTypes)])

  const filteredOptions =
    query.trim().length === 0
      ? options
      : options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
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
              placeholder="Search posts…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="max-h-64 overflow-auto space-y-2">
              {filteredOptions.length === 0 ? (
                <div className="text-xs text-neutral-low">No posts found.</div>
              ) : (
                filteredOptions.map((opt) => {
                  const checked = vals.includes(opt.value)
                  return (
                    <label key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        checked={checked}
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
                  )
                })
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
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

function MediaThumb({
  mediaId,
  onChange,
  onClear,
}: {
  mediaId: string | null
  onChange: () => void
  onClear: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [mediaData, setMediaData] = useState<{
    baseUrl: string
    variants: MediaVariant[]
    darkSourceUrl?: string
  } | null>(null)
  const isDark = useIsDarkMode()

  // Fetch media data when mediaId changes
  useEffect(() => {
    let alive = true
    async function load() {
      if (!mediaId) {
        if (alive) {
          setMediaData(null)
          setUrl(null)
        }
        return
      }
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        const data = j?.data
        if (!data) {
          if (alive) {
            setMediaData(null)
            setUrl(null)
          }
          return
        }
        const baseUrl: string | null = data.url || null
        if (!baseUrl) {
          if (alive) {
            setMediaData(null)
            setUrl(null)
          }
          return
        }
        const meta = (data as any).metadata || {}
        const variants: MediaVariant[] = Array.isArray(meta?.variants)
          ? (meta.variants as MediaVariant[])
          : []
        const darkSourceUrl =
          typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
        if (alive) {
          setMediaData({ baseUrl, variants, darkSourceUrl })
        }
      } catch (err) {
        console.error('MediaThumb: Failed to load media', err)
        if (alive) {
          setMediaData(null)
          setUrl(null)
        }
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [mediaId])

  // Resolve URL when media data or theme changes
  useEffect(() => {
    if (!mediaData) {
      setUrl(null)
      return
    }
    const adminThumb =
      (typeof process !== 'undefined' &&
        process.env &&
        (process.env as any).MEDIA_ADMIN_THUMBNAIL_VARIANT) ||
      'thumb'
    const resolved = pickMediaVariantUrl(mediaData.baseUrl, mediaData.variants, adminThumb, {
      darkSourceUrl: mediaData.darkSourceUrl,
    })
    setUrl(resolved)
  }, [mediaData, isDark])

  return (
    <div className="border border-line-low rounded p-2 bg-backdrop-low flex items-center gap-3">
      <div className="w-16 h-16 bg-backdrop-medium rounded overflow-hidden flex items-center justify-center">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" key={`${url}-${isDark}`} />
        ) : (
          <span className="text-xs text-neutral-medium">No image</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
          onClick={onChange}
        >
          {mediaId ? 'Change' : 'Choose'}
        </button>
        {mediaId && (
          <button
            type="button"
            className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
            onClick={onClear}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  )
}

function ParentSelect({
  postId,
  postType,
  locale,
  value,
  onChange,
}: {
  postId: string
  postType: string
  locale: string
  value: string
  onChange: (val: string) => void
}) {
  const [options, setOptions] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState<boolean>(false)
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          setLoading(true)
          const params = new URLSearchParams()
          params.set('types', postType)
          params.set('locale', locale)
          params.set('status', 'published')
          params.set('limit', '100')
          const res = await fetch(`/api/posts?${params.toString()}`, { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const list: Array<{ id: string; title: string }> = Array.isArray(json?.data)
            ? json.data
            : []
          if (!alive) return
          setOptions(list.filter((p) => p.id !== postId))
        } finally {
          if (alive) setLoading(false)
        }
      })()
    return () => {
      alive = false
    }
  }, [postId, postType, locale])
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-medium mb-1">Parent</label>
      <Select
        defaultValue={value && value !== '' ? value : '__none__'}
        onValueChange={(val) => onChange(val === '__none__' ? '' : val)}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? 'Loading…' : 'None'} />
        </SelectTrigger>
        <SelectContent className="max-h-64 overflow-auto">
          <SelectItem key="__none__" value="__none__">
            None
          </SelectItem>
          {options.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
