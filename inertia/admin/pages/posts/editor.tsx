/**
 * Admin Post Editor - refresh
 *
 * Main editing interface for posts with modules, translations, and metadata.
 */

import { useForm, usePage, router } from '@inertiajs/react'
import { useUnsavedChanges, bypassUnsavedChanges } from '~/hooks/useUnsavedChanges'
import { useConfirm } from '~/components/ConfirmDialogProvider'
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
import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { toast } from 'sonner'
import { humanizeSlug } from '~/utils/strings'
import type { CustomFieldType } from '~/types/custom_field'
import {
  ModuleEditorInline,
  prefetchModuleSchemas,
} from '../../components/modules/ModuleEditorPanel'
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
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Star } from 'lucide-react'
import { DragHandle } from '../../components/ui/DragHandle'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReact } from '@fortawesome/free-brands-svg-icons'
import {
  faGlobe,
  faWandMagicSparkles,
  faPencil,
  faTrash,
  faClone,
  faChevronDown,
  faSpinner,
  faLink,
  faBrain,
  faExpandAlt,
  faCompressAlt,
} from '@fortawesome/free-solid-svg-icons'
import { getXsrf } from '~/utils/xsrf'
import { LinkField, type LinkFieldValue } from '~/components/forms/LinkField'
import { useHasPermission } from '~/utils/permissions'
import { MediaThumb } from '../../components/media/MediaThumb'
import { AgentModal, type Agent } from '../../components/agents/AgentModal'
import { FeedbackPanel } from '~/components/FeedbackPanel'
import { FeedbackMarkers } from '~/components/FeedbackMarkers'
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

import { TokenField } from '../../components/ui/TokenField'

type TaxonomyTermNode = {
  id: string
  slug: string
  name: string
  children?: TaxonomyTermNode[]
}

// Helper for merging props
const deepMerge = (base: any, override: any) => {
  if (!override || typeof override !== 'object' || Array.isArray(override)) return override
  if (!base || typeof base !== 'object' || Array.isArray(base)) return override

  const out = { ...base }
  Object.keys(override).forEach((key) => {
    const bVal = base[key]
    const oVal = override[key]
    if (
      bVal &&
      typeof bVal === 'object' &&
      !Array.isArray(bVal) &&
      oVal &&
      typeof oVal === 'object' &&
      !Array.isArray(oVal)
    ) {
      out[key] = deepMerge(bVal, oVal)
    } else {
      out[key] = oVal
    }
  })
  return out
}

const InlineModuleEditor = function InlineModuleEditor({
  module,
  postId,
  viewMode,
  fieldAgents,
  registerFlush,
  onStage,
  onMarkDirty,
  customFields = [],
}: {
  module: {
    id: string
    moduleInstanceId: string
    type: string
    scope: string
    props: Record<string, any>
    reviewProps?: Record<string, any> | null
    aiReviewProps?: Record<string, any> | null
    overrides?: Record<string, any> | null
    reviewOverrides?: Record<string, any> | null
    aiReviewOverrides?: Record<string, any> | null
    locked: boolean
    orderIndex: number
    globalSlug?: string | null
    globalLabel?: string | null
    adminLabel?: string | null
  }
  postId: string
  viewMode: 'source' | 'review' | 'ai-review'
  fieldAgents: Agent[]
  registerFlush: (moduleId: string, flush: (() => Promise<void>) | null) => void
  onStage: (
    moduleId: string,
    overrides: Record<string, any> | null,
    edited: Record<string, any>,
    adminLabel?: string | null
  ) => void
  onMarkDirty: (mode: 'source' | 'review' | 'ai-review', moduleId: string) => void
  customFields?: Array<{ slug: string; label: string }>
}) {
  const onDirty = useCallback(
    () => onMarkDirty(viewMode, module.id),
    [onMarkDirty, viewMode, module.id]
  )
  const onSave = useCallback(
    (overrides: Record<string, any> | null, edited: Record<string, any>) =>
      onStage(module.id, overrides, edited),
    [onStage, module.id]
  )
  const onRegisterFlush = useCallback(
    (flush: (() => Promise<void>) | null) => registerFlush(module.id, flush),
    [registerFlush, module.id]
  )

  // Resolve the "effective" props and overrides for the current view mode
  // so the Inline Editor shows the correct staged version.
  const effectiveProps = useMemo(() => {
    let merged = module.props || {}
    // Hierarchy: Source -> Review -> AI Review
    if (module.reviewProps && (viewMode === 'review' || viewMode === 'ai-review')) {
      merged = deepMerge(merged, module.reviewProps)
    }
    if (module.aiReviewProps && viewMode === 'ai-review') {
      merged = deepMerge(merged, module.aiReviewProps)
    }
    return merged
  }, [viewMode, module.props, module.reviewProps, module.aiReviewProps])

  const effectiveOverrides = useMemo(() => {
    let merged = module.overrides || null
    // Hierarchy: Source -> Review -> AI Review
    if (module.reviewOverrides && (viewMode === 'review' || viewMode === 'ai-review')) {
      merged = deepMerge(merged || {}, module.reviewOverrides)
    }
    if (module.aiReviewOverrides && viewMode === 'ai-review') {
      merged = deepMerge(merged || {}, module.aiReviewOverrides)
    }
    return merged
  }, [viewMode, module.overrides, module.reviewOverrides, module.aiReviewOverrides])

  return (
    <ModuleEditorInline
      moduleItem={{
        id: module.id,
        moduleInstanceId: module.moduleInstanceId,
        type: module.type,
        scope: module.scope,
        props: effectiveProps,
        overrides: effectiveOverrides,
        locked: module.locked,
        orderIndex: module.orderIndex,
        globalSlug: (module as any).globalSlug || null,
        adminLabel: module.adminLabel || null,
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
      customFields={customFields}
    />
  )
}

import { CustomFieldRenderer } from '../../components/CustomFieldRenderer'
import type { CustomFieldDefinition } from '~/types/custom_field'

import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'

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
    abVariation?: string | null
    abGroupId?: string | null
    socialTitle?: string | null
    socialDescription?: string | null
    socialImageId?: string | null
    noindex?: boolean
    nofollow?: boolean
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
    globalSlug?: string | null
    globalLabel?: string | null
    adminLabel?: string | null
  }[]
  translations: { id: string; locale: string }[]
  abVariations?: { id: string; variation: string; status: string }[]
  reviewDraft?: any | null
  aiReviewDraft?: any | null
  customFields?: Array<
    CustomFieldDefinition & {
      id: string
      fieldType?: CustomFieldType
      value?: any
    }
  >
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
    abTesting?: {
      enabled: boolean
      strategy?: 'cookie' | 'query'
      variations?: Array<{ value: string; weight: number }>
    }
    urlPatterns?: Array<{ pattern: string; type: string }>
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !!disabled,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    opacity: isDragging ? 0 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} {...(disabled ? {} : attributes)}>
      {typeof children === 'function'
        ? children(disabled ? {} : listeners, disabled ? {} : attributes)
        : children}
    </div>
  )
}

function ModuleRowBase({
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
  onDuplicate,
  registerModuleFlush,
  stageModuleEdits,
  markModuleDirty,
  postId,
  customFields = [],
  isOverlay = false,
  lastUpdateKey = 0,
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
  onDuplicate: (m: any) => void
  registerModuleFlush: (moduleId: string, flush: (() => Promise<void>) | null) => void
  stageModuleEdits: (
    moduleId: string,
    overrides: Record<string, any> | null,
    edited: Record<string, any>,
    adminLabel?: string | null
  ) => void
  markModuleDirty: (mode: 'source' | 'review' | 'ai-review', moduleId: string) => void
  postId: string
  customFields?: Array<{ slug: string; label: string }>
  isOverlay?: boolean
  lastUpdateKey?: number
}) {
  const isOpen = modulesAccordionOpen.has(m.id) && !isOverlay
  const isLocked = m.locked
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [localLabel, setLocalLabel] = useState(m.adminLabel || '')

  useEffect(() => {
    setLocalLabel(m.adminLabel || '')
  }, [m.adminLabel])

  const isLocal = m.scope === 'post' || m.scope === 'local'
  const moduleName = !isLocal
    ? globalSlugToLabel.get(String((m as any).globalSlug || '')) ||
    (m as any).globalLabel ||
    (m as any).globalSlug ||
    moduleRegistry[m.type]?.name ||
    m.type
    : moduleRegistry[m.type]?.name || m.type

  const labelToDisplay = useMemo(() => {
    if (m.adminLabel) return m.adminLabel
    if (m.label) return m.label

    // Try to find a dynamic label from props for common fields
    const candidates = ['title', 'name', 'heading', 'label', 'heading_text']
    const props = m.props || {}
    const overrides = m.overrides || {}
    const merged = { ...props, ...overrides }

    for (const key of candidates) {
      const val = merged[key]
      if (typeof val === 'string' && val.trim() !== '') return val.trim()
      if (typeof val === 'number') return String(val)
    }

    return moduleName
  }, [m.adminLabel, m.label, m.props, m.overrides, moduleName])

  const saveLabel = async () => {
    const label = localLabel.trim() || null
    setIsEditingLabel(false)
    if (label === m.adminLabel) return

    // Stage label like any other field: it should NOT persist until the user hits Save/Publish/Approve.
    // Mirror it into `m.adminLabel` in local state so the editor header reflects the change immediately.
    setModules((prev) => prev.map((pm) => (pm.id === m.id ? { ...pm, adminLabel: label } : pm)))

    stageModuleEdits(m.id, m.overrides || null, m.props || {}, label)
    markModuleDirty(viewMode, m.id)
    toast.success('Module label staged (unsaved)')
  }

  return (
    <SortableItem key={m.id} id={m.id} disabled={isLocked}>
      {(listeners: any) => (
        <li
          className={`group bg-backdrop-low border ${isOverlay || isDraggingModules ? '' : 'transition-all duration-200'} ${isOpen ? 'border-line-medium shadow-sm rounded-xl mb-4' : 'border-line-low rounded-lg mb-2'}`}
        >
          <div
            className={`px-3 py-2 flex items-center justify-between gap-2 ${isOpen ? 'bg-backdrop-medium/5' : ''}`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <DragHandle
                aria-label="Drag"
                disabled={isLocked}
                {...(isLocked ? {} : listeners)}
                className="opacity-40 group-hover:opacity-100 transition-opacity"
              />
              <div className="text-[10px] font-bold text-neutral-low/30 tabular-nums min-w-[14px] text-center" title={`Order: ${m.orderIndex + 1}`}>
                {m.orderIndex + 1}
              </div>

              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 group/label min-w-0">
                  {isEditingLabel ? (
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <input
                        autoFocus
                        className="flex-1 px-2 py-1 text-sm font-bold bg-backdrop-low border border-standout-high rounded-lg outline-none focus:ring-2 focus:ring-standout-high/20"
                        value={localLabel}
                        onChange={(e) => setLocalLabel(e.target.value)}
                        onBlur={saveLabel}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveLabel()
                          if (e.key === 'Escape') {
                            setLocalLabel(m.adminLabel || '')
                            setIsEditingLabel(false)
                          }
                        }}
                        placeholder="Enter label..."
                      />
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-sm font-bold text-neutral-high truncate hover:text-standout-high transition-colors text-left"
                        onClick={() =>
                          setModulesAccordionOpen((prev) => {
                            const next = new Set(prev)
                            if (next.has(m.id)) next.delete(m.id)
                            else next.add(m.id)
                            return next
                          })
                        }
                      >
                        {labelToDisplay}
                      </button>

                      {(m.adminLabel || m.label) && (
                        <span className="text-xs text-neutral-medium italic shrink-0">
                          ({moduleName})
                        </span>
                      )}

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setIsEditingLabel(true)}
                            className="opacity-40 group-hover/label:opacity-100 p-1 rounded-md hover:bg-backdrop-medium text-neutral-low hover:text-neutral-high transition-all"
                          >
                            <FontAwesomeIcon icon={faPencil} size="xs" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit label</p>
                        </TooltipContent>
                      </Tooltip>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(() => {
                const mode = moduleRegistry[m.type]?.renderingMode
                const isReact =
                  mode === 'react' ||
                  (mode === 'hybrid' &&
                    (m.props?._useReact === true ||
                      m.reviewProps?._useReact === true ||
                      m.aiReviewProps?._useReact === true))

                if (isReact) {
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex items-center rounded-full border border-sky-500/20 bg-sky-500/5 px-2 py-0.5 text-[10px] font-bold text-sky-500 uppercase tracking-tight cursor-help">
                          <FontAwesomeIcon icon={faReact} className="mr-1" />
                          React
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {mode === 'hybrid'
                            ? 'React enabled via hybrid mode'
                            : 'React module (client-side interactivity)'}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  )
                }
                return null
              })()}
              {(m.scope === 'global' || m.scope === 'static') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[10px] font-bold text-amber-500 uppercase tracking-tight cursor-help">
                      <FontAwesomeIcon icon={faGlobe} className="mr-1" size="xs" />
                      {m.scope === 'static' ? 'Static' : 'Global'}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{m.scope.charAt(0).toUpperCase() + m.scope.slice(1)} module</p>
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-1.5 rounded-md text-neutral-low hover:text-standout-high hover:bg-backdrop-medium transition-all"
                    disabled={isLocked}
                    onClick={() => onDuplicate(m)}
                    type="button"
                  >
                    <FontAwesomeIcon icon={faClone} className="text-xs" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Duplicate module</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    className="p-1.5 rounded-md text-neutral-low hover:text-red-500 hover:bg-red-500/10 transition-all"
                    disabled={isLocked}
                    onClick={async () => {
                      if (isLocked) {
                        toast.error('Locked modules cannot be removed')
                        return
                      }
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
                        setModules((prev) => prev.filter((pm) => pm.id !== m.id))
                      }
                      toast.success('Module marked for removal')
                    }}
                    type="button"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Remove module</p>
                </TooltipContent>
              </Tooltip>

              <button
                type="button"
                className={`p-1.5 rounded-md transition-all ${isOpen ? 'bg-backdrop-medium text-neutral-high' : 'text-neutral-low hover:bg-backdrop-medium'}`}
                onClick={() => {
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
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} text-xs`}
                />
              </button>
            </div>
          </div>

          {isOpen && !isDraggingModules && (
            <div className="p-6 bg-backdrop-low rounded-b-xl border-t border-line-low">
              {!moduleSchemasReady ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-medium">
                  <FontAwesomeIcon icon={faSpinner} className="text-3xl animate-spin" />
                  <span className="text-sm font-medium">Loading module fields...</span>
                </div>
              ) : (
                <InlineModuleEditor
                  key={`${m.id}:${viewMode}:${lastUpdateKey}`}
                  module={m}
                  postId={postId}
                  viewMode={viewMode}
                  fieldAgents={moduleFieldAgents}
                  registerFlush={registerModuleFlush}
                  onStage={stageModuleEdits}
                  onMarkDirty={markModuleDirty}
                  customFields={customFields}
                />
              )}
            </div>
          )}
        </li>
      )}
    </SortableItem>
  )
}

const ModuleRow = ModuleRowBase

export default function Editor({
  post,
  modules: initialModules,
  translations,
  abVariations = [],
  reviewDraft,
  aiReviewDraft,
  customFields: initialCustomFields,
  uiConfig,
  taxonomies = [],
  selectedTaxonomyTermIds = [],
  fieldTypes = [],
}: EditorProps) {
  const { confirm } = useConfirm()
  const hasFieldPermission = useHasPermission('agents.field')
  const initialTaxonomyIds = useMemo(
    () =>
      Array.isArray(selectedTaxonomyTermIds) ? [...selectedTaxonomyTermIds].map(String).sort() : [],
    [selectedTaxonomyTermIds]
  )
  const initialCustomFieldsData = useMemo(
    () =>
      Array.isArray(initialCustomFields)
        ? initialCustomFields.map((f) => ({ fieldId: f.id, slug: f.slug, value: f.value ?? null }))
        : [],
    [initialCustomFields]
  )

  const { data, setData, put, processing, errors } = useForm({
    title: post.title || '',
    slug: post.slug || '',
    excerpt: post.excerpt || '',
    status: post.status || 'draft',
    parentId: (post as any).parentId || '',
    orderIndex: (post as any).orderIndex ?? 0,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    socialTitle: (post as any).socialTitle || '',
    socialDescription: (post as any).socialDescription || '',
    socialImageId: (post as any).socialImageId || '',
    noindex: Boolean((post as any).noindex),
    nofollow: Boolean((post as any).nofollow),
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
    featuredImageId: post.featuredImageId || '',
    customFields: initialCustomFieldsData,
    taxonomyTermIds: initialTaxonomyIds,
  } as any)
  const initialDataRef = useRef({
    title: post.title || '',
    slug: post.slug || '',
    excerpt: post.excerpt || '',
    status: post.status || 'draft',
    parentId: (post as any).parentId || '',
    orderIndex: (post as any).orderIndex ?? 0,
    metaTitle: post.metaTitle || '',
    metaDescription: post.metaDescription || '',
    canonicalUrl: post.canonicalUrl || '',
    socialTitle: (post as any).socialTitle || '',
    socialDescription: (post as any).socialDescription || '',
    socialImageId: (post as any).socialImageId || '',
    noindex: Boolean((post as any).noindex),
    nofollow: Boolean((post as any).nofollow),
    robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
    jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
    featuredImageId: post.featuredImageId || '',
    customFields: initialCustomFieldsData,
    taxonomyTermIds: initialTaxonomyIds,
  } as any)
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
        socialTitle: String(reviewDraft.socialTitle ?? (post.socialTitle || '')),
        socialDescription: String(
          reviewDraft.socialDescription ?? (post.socialDescription || '')
        ),
        socialImageId: String(reviewDraft.socialImageId ?? (post.socialImageId || '')),
        noindex: Boolean(reviewDraft.noindex ?? post.noindex),
        nofollow: Boolean(reviewDraft.nofollow ?? post.nofollow),
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
        socialTitle: String(aiReviewDraft.socialTitle ?? (post.socialTitle || '')),
        socialDescription: String(
          aiReviewDraft.socialDescription ?? (post.socialDescription || '')
        ),
        socialImageId: String(aiReviewDraft.socialImageId ?? (post.socialImageId || '')),
        noindex: Boolean(aiReviewDraft.noindex ?? post.noindex),
        nofollow: Boolean(aiReviewDraft.nofollow ?? post.nofollow),
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
  >({ 'source': {}, 'review': {}, 'ai-review': {} })
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
      const escapeAttr = (s: string) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
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
    Record<
      ViewMode,
      Record<
        string,
        {
          overrides: Record<string, any> | null
          edited: Record<string, any>
          adminLabel?: string | null
        }
      >
    >
  >({ 'source': {}, 'review': {}, 'ai-review': {} })
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
      adminLabel?: string | null
      props?: Record<string, any>
      overrides?: Record<string, any> | null
    }>
  >([])
  // Track structural changes that need to be published
  const [hasStructuralChanges, setHasStructuralChanges] = useState(false)
  const [taxonomyTrees, setTaxonomyTrees] = useState(taxonomies)
  const [newTermNames, setNewTermNames] = useState<Record<string, string>>({})
  const [selectedTaxonomyTerms, setSelectedTaxonomyTerms] = useState<Set<string>>(
    new Set(initialTaxonomyIds)
  )
  const taxonomyInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  useEffect(() => {
    setTaxonomyTrees(taxonomies)
    const sortedIds = Array.isArray(selectedTaxonomyTermIds)
      ? [...selectedTaxonomyTermIds].map(String).sort()
      : []
    setSelectedTaxonomyTerms(new Set(sortedIds))
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
  const pickForm = (d: any) => {
    if (!d) return {}
    return {
      type: post.type,
      locale: post.locale,
      title: d.title || '',
      slug: d.slug || '',
      excerpt: d.excerpt || '',
      status: d.status || '',
      parentId: String(d.parentId || '').trim() || '',
      orderIndex: Number(d.orderIndex || 0),
      metaTitle: String(d.metaTitle || '').trim() || '',
      metaDescription: String(d.metaDescription || '').trim() || '',
      canonicalUrl: String(d.canonicalUrl || '').trim() || '',
      socialTitle: String(d.socialTitle || '').trim() || '',
      socialDescription: String(d.socialDescription || '').trim() || '',
      socialImageId: String(d.socialImageId || '').trim() || '',
      noindex: Boolean(d.noindex),
      nofollow: Boolean(d.nofollow),
      // Normalize JSON strings by parsing and re-stringifying without whitespace
      robotsJson: (() => {
        const val = d.robotsJson || ''
        if (!val) return ''
        try {
          return JSON.stringify(JSON.parse(val))
        } catch {
          return val.trim()
        }
      })(),
      jsonldOverrides: (() => {
        const val = d.jsonldOverrides || ''
        if (!val) return ''
        try {
          return JSON.stringify(JSON.parse(val))
        } catch {
          return val.trim()
        }
      })(),
      featuredImageId: String(d.featuredImageId || '').trim() || '',
      customFields: Array.isArray(d.customFields)
        ? [...d.customFields]
          .sort((a, b) => (a.slug || '').localeCompare(b.slug || ''))
          .map((e: any) => ({
            fieldId: e.fieldId,
            slug: e.slug,
            value: e.value ?? null,
          }))
        : [],
      taxonomyTermIds: Array.isArray(d.taxonomyTermIds)
        ? [...d.taxonomyTermIds].map(String).sort()
        : [],
    }
  }
  const modulesEnabled = uiConfig?.modulesEnabled !== false
  const permalinksEnabled =
    uiConfig?.permalinksEnabled !== false && (uiConfig?.urlPatterns?.length || 0) > 0

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
  const canDelete = useHasPermission('posts.delete')
  const [isImportModeOpen, setIsImportModeOpen] = useState(false)
  const [pendingImportJson, setPendingImportJson] = useState<any | null>(null)
  const importFileRef = useRef<HTMLInputElement | null>(null)
  function slugify(input: string): string {
    return String(input || '')
      .toLowerCase()
      .trim()
      .replace(/['"]/g, '')
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dash
      .replace(/-+/g, '-') // Collapse multiple dashes
      .replace(/^-+|-+$/g, '') // Trim dashes from ends
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
  const [activeId, setActiveId] = useState<string | null>(null)

  const hasReviewBaseline = useMemo(() => {
    // A draft exists if it has actual content (beyond metadata)
    const hasModuleReview = (modules || []).some(
      (m) =>
        (m.reviewProps && Object.keys(m.reviewProps).length > 0) ||
        (m.reviewOverrides && Object.keys(m.reviewOverrides).length > 0) ||
        m.reviewAdded
    )
    if (!reviewDraft) return hasModuleReview
    const keys = Object.keys(reviewDraft).filter((k) => k !== 'savedAt' && k !== 'savedBy')
    return keys.length > 0 || hasModuleReview
  }, [reviewDraft, modules])

  const hasAiReviewBaseline = useMemo(() => {
    // A draft exists if it has actual content (beyond metadata)
    const hasModuleAiReview = (modules || []).some(
      (m) =>
        (m.aiReviewProps && Object.keys(m.aiReviewProps).length > 0) ||
        (m.aiReviewOverrides && Object.keys(m.aiReviewOverrides).length > 0) ||
        m.aiReviewAdded
    )
    if (!aiReviewDraft) return hasModuleAiReview
    const keys = Object.keys(aiReviewDraft).filter((k) => k !== 'savedAt' && k !== 'savedBy')
    return keys.length > 0 || hasModuleAiReview
  }, [aiReviewDraft, modules])

  const hasSourceBaseline = useMemo(() => {
    // "Source" exists if:
    // 1. There is at least one module not introduced via Review/AI Review, OR
    // 2. The post has approved content (post itself exists with approved fields)
    const hasSourceModules = (modules || []).some(
      (m) => !m.reviewAdded && !(m as any).aiReviewAdded
    )

    // Check if the main post record has meaningful approved content beyond just title/slug
    const hasApprovedFields = !!(
      (post.excerpt && post.excerpt.trim() !== '') ||
      (post.metaTitle && post.metaTitle.trim() !== '') ||
      (post.metaDescription && post.metaDescription.trim() !== '') ||
      post.featuredImageId ||
      (initialCustomFields &&
        initialCustomFields.some((f: any) => f.value !== null && f.value !== ''))
    )

    // Optimization: If a post was created via an agent into AI Review mode,
    // it starts with NO source modules and its post fields are just skeletons.
    // In this case, we hide the 'Source' tab to avoid confusion and land
    // the user directly on the meaningful content in 'AI Review'.
    if (
      modulesEnabled &&
      !hasSourceModules &&
      !hasApprovedFields &&
      (hasReviewBaseline || hasAiReviewBaseline) &&
      post.status === 'draft'
    ) {
      return false
    }

    // Post has source content if it exists (has id, title, etc.) - this is always true for existing posts
    const hasSourcePost = !!post?.id
    return hasSourceModules || hasSourcePost
  }, [modules, post, hasReviewBaseline, hasAiReviewBaseline, modulesEnabled, initialCustomFields])

  const initialViewMode: 'source' | 'review' | 'ai-review' = useMemo(() => {
    // Check URL parameter first to preserve view mode across reloads
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      const viewParam = urlParams.get('view')
      if (viewParam === 'source' || viewParam === 'review' || viewParam === 'ai-review') {
        return viewParam as 'source' | 'review' | 'ai-review'
      }
    }
    // Fallback to baseline-based logic: land on most "active" draft version if source is skeleton
    if (hasAiReviewBaseline && !hasSourceBaseline) return 'ai-review'
    if (hasReviewBaseline && !hasSourceBaseline) return 'review'
    if (hasReviewBaseline) return 'review'
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
  const [variationCreateConfirmOpen, setVariationCreateConfirmOpen] = useState(false)
  const [pendingVariationToCreate, setPendingVariationToCreate] = useState<{
    value: string
    label: string
  } | null>(null)
  const [variationDeleteConfirmOpen, setVariationDeleteConfirmOpen] = useState(false)
  const [postDeleteConfirmOpen, setPostDeleteConfirmOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastUpdateKey, setLastUpdateKey] = useState(0)
  const [isCreatingTranslation, setIsCreatingTranslation] = useState(false)
  const [isCreatingVariation, setIsCreatingVariation] = useState(false)
  const [pendingVariationToDelete, setPendingVariationToDelete] = useState<{
    id: string
    variation: string
  } | null>(null)

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
    if (isSaving) return
    setIsSaving(true)
    try {
      // Automatically clean slug to match strict validator: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
      const cleanedSlug = data.slug
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-+/g, '-')

      if (cleanedSlug !== data.slug) {
        setData('slug', cleanedSlug)
      }

      // Critical: ensure inline module editors have staged their latest values before we commit/publish.
      await flushAllModuleEdits()

      const buildDraftSnapshot = (snapshotTarget: 'review' | 'ai-review', modulesList?: any[]) => {
        // Use the provided list or raw modules array.
        const list = modulesList || modules
        return list.map((m) => {
          const pending = pendingModulesByModeRef.current[viewMode][m.id]
          const isLocal = m.scope === 'post' || m.scope === 'local'

          // Start with what the user is CURRENTLY seeing in the editor (the active version)
          let finalProps = isLocal ? m.props : {}
          let finalOverrides = !isLocal ? m.overrides : null

          if (viewMode === 'review') {
            finalProps = isLocal ? (m.reviewProps ?? m.props) : {}
            finalOverrides = !isLocal ? (m.reviewOverrides ?? m.overrides) : null
          } else if (viewMode === 'ai-review') {
            finalProps = isLocal ? (m.aiReviewProps ?? m.reviewProps ?? m.props) : {}
            finalOverrides = !isLocal
              ? (m.aiReviewOverrides ?? m.reviewOverrides ?? m.overrides)
              : null
          }

          // If we have unsaved edits from the current session, they MUST be injected
          if (pending) {
            if (isLocal) {
              finalProps = pending.edited
            } else {
              finalOverrides = pending.overrides
            }
          }

          const adminLabel = pending?.adminLabel ?? m.adminLabel ?? null

          return {
            ...m,
            props: finalProps,
            overrides: finalOverrides,
            adminLabel,
          }
        })
      }

      // Critical: build snapshots BEFORE clearing any pending refs or performing async commits.
      const idMap = new Map()
      const modulesWithRealIds = modules.map((m) => ({
        ...m,
        id: idMap.get(m.id) || m.id,
      }))

      // snapshotTarget depends on where we are saving to.
      // snapshotSourceMode is where the DATA is currently coming from (viewMode).
      const reviewSnapshot =
        target === 'review' ? buildDraftSnapshot('review', modulesWithRealIds) : null
      const aiReviewSnapshot =
        target === 'ai-review' ? buildDraftSnapshot('ai-review', modulesWithRealIds) : null

      if (target === 'review' && reviewSnapshot) {
        const created = await createPendingNewModules('review')
        // Only commit pending modules if we are not about to overwrite them with a full snapshot save
        // Actually, for KISS and robustness, we always commit them to ensure granular columns are up to date.
        await commitPendingModules('review', created, viewMode)

        // Re-inject the real IDs into the snapshot if any were created
        const pmIdMap = new Map(created.map((c) => [c.tempId, c.postModuleId]))
        const miIdMap = new Map(created.map((c) => [c.tempId, c.moduleInstanceId]))

        const finalSnapshot = reviewSnapshot.map((m) => {
          const realPmId = pmIdMap.get(m.id) || m.postModuleId || m.id
          const realMiId = miIdMap.get(m.id) || m.moduleInstanceId
          return {
            ...m,
            id: realPmId,
            postModuleId: realPmId,
            moduleInstanceId: realMiId,
          }
        })

        await saveForReview(finalSnapshot)
        return
      }

      if (target === 'ai-review' && aiReviewSnapshot) {
        const created = await createPendingNewModules('ai-review')
        await commitPendingModules('ai-review', created, viewMode)

        const pmIdMap = new Map(created.map((c) => [c.tempId, c.postModuleId]))
        const miIdMap = new Map(created.map((c) => [c.tempId, c.moduleInstanceId]))

        const finalSnapshot = aiReviewSnapshot.map((m) => {
          const realPmId = pmIdMap.get(m.id) || m.postModuleId || m.id
          const realMiId = miIdMap.get(m.id) || m.moduleInstanceId
          return {
            ...m,
            id: realPmId,
            postModuleId: realPmId,
            moduleInstanceId: realMiId,
          }
        })

        await saveForAiReview(finalSnapshot)
        return
      }

      // Save to Source (existing flow)
      const created = await createPendingNewModules('publish')
      await commitPendingModules('publish', created, viewMode)
      if (hasStructuralChanges) {
        // Build a fresh module list using the real IDs for newly created modules.
        // This ensures persistOrder(RealID) updates the DB with the correct orderIndex.
        const idMap = new Map(created.map((c) => [c.tempId, c.postModuleId]))
        const modulesWithRealIds = modules.map((m) => ({
          ...m,
          id: idMap.get(m.id) || m.id,
        }))

        const persistedModules = modulesWithRealIds.filter((m) => !m.id.startsWith('temp-'))
        await persistOrder(persistedModules, 'publish')
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
        bypassUnsavedChanges(true)
        router.visit(currentUrl.toString())
      } else {
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

        const msg =
          (errorJson as any)?.message ||
          ((errorJson as any)?.errors?.[0]?.message as string | undefined) ||
          'Failed to save'
        toast.error(msg)
      }
    } catch (error) {
      console.error('Save error:', error)
      toast.error('Failed to save')
    } finally {
      setIsSaving(false)
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
      const data = await res.json().catch(() => null)
      if (data?.promoted === false) {
        toast.info(data.message || 'No changes were found to promote.')
        // Force reload anyway to stay in sync with server state
        bypassUnsavedChanges(true)
        router.reload()
      } else {
        toast.success(
          data?.message ||
          (mode === 'approve-ai-review'
            ? 'AI Review promoted to Review'
            : 'Review promoted to Source')
        )
        bypassUnsavedChanges(true)
        router.reload()
      }
      return
    }
    const err = await res.json().catch(() => null)
    console.error('Approve failed:', res.status, err)
    toast.error(err?.error || err?.message || (err?.errors ? 'Failed (validation)' : 'Failed'))
  }

  async function executeDelete() {
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'DELETE',
      headers: {
        Accept: 'application/json',
        ...xsrfHeader(),
      },
      credentials: 'same-origin',
    })
    if (res.ok) {
      toast.success('Post deleted successfully')
      bypassUnsavedChanges(true)
      router.visit('/admin/posts')
      return
    }
    const err = await res.json().catch(() => null)
    console.error('Delete failed:', res.status, err)
    toast.error(err?.error || 'Failed to delete post')
  }

  const isDirty = useMemo(() => {
    try {
      const baseline =
        viewMode === 'review' && reviewInitialRef.current
          ? reviewInitialRef.current
          : viewMode === 'ai-review' && aiReviewInitialRef.current
            ? aiReviewInitialRef.current
            : initialDataRef.current

      const pickedData = pickForm(data)
      const pickedBaseline = pickForm(baseline as any)
      const fieldsChanged = JSON.stringify(pickedData) !== JSON.stringify(pickedBaseline)

      // Only count pending module edits for the current view mode (we keep drafts for other modes too).
      const modulesPending = modulesEnabled
        ? Object.keys(pendingModules).some((k) => k.startsWith(`${viewMode}:`))
        : false
      const removalsPendingSource =
        modulesEnabled && viewMode === 'source' ? pendingRemoved.size > 0 : false
      const removalsPendingReview =
        modulesEnabled && viewMode === 'review' ? pendingReviewRemoved.size > 0 : false
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
        structuralChanges ||
        isSaving
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

  useUnsavedChanges(isDirty)
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
    setLastUpdateKey((prev) => prev + 1)
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
              if (g.globalSlug) {
                gMap.set(g.globalSlug, (g as any).label || g.globalSlug)
              }
            })
            console.log('[PostEditor] Global labels loaded:', Array.from(gMap.entries()))
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

  // Sync initialDataRef and data when post prop changes (e.g. after agent run)
  useEffect(() => {
    const newData = {
      title: post.title || '',
      slug: post.slug || '',
      excerpt: post.excerpt || '',
      status: post.status || 'draft',
      parentId: (post as any).parentId || '',
      orderIndex: (post as any).orderIndex ?? 0,
      metaTitle: post.metaTitle || '',
      metaDescription: post.metaDescription || '',
      canonicalUrl: post.canonicalUrl || '',
      robotsJson: post.robotsJson ? JSON.stringify(post.robotsJson, null, 2) : '',
      jsonldOverrides: post.jsonldOverrides ? JSON.stringify(post.jsonldOverrides, null, 2) : '',
      featuredImageId: post.featuredImageId || '',
      customFields: initialCustomFieldsData,
      taxonomyTermIds: initialTaxonomyIds,
    }
    initialDataRef.current = newData
    if (viewMode === 'source') {
      setData((prev) => ({ ...prev, ...newData }))
    }
  }, [post, initialCustomFieldsData, initialTaxonomyIds, viewMode, setData])

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
      modules:
        modulesOverride ||
        modules.map((m) => {
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
      // Clear any "dirty" markers for this mode; after a successful save, the UI should be clean.
      setUnstagedDirtyModulesByMode((prev) => ({ ...prev, review: {} }))
      setHasStructuralChanges(false)

      // Redirect to Review tab if we're not already there
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'review')
      bypassUnsavedChanges(true)
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
      modules:
        modulesOverride ||
        modules.map((m) => {
          const isLocal = m.scope === 'post' || m.scope === 'local'
          return {
            ...m,
            props: isLocal ? (m.aiReviewProps ?? m.reviewProps ?? m.props ?? {}) : {},
            overrides: !isLocal
              ? (m.aiReviewOverrides ?? m.reviewOverrides ?? m.overrides ?? null)
              : null,
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
      // Clear any "dirty" markers for this mode; after a successful save, the UI should be clean.
      setUnstagedDirtyModulesByMode((prev) => ({ ...prev, 'ai-review': {} }))
      setHasStructuralChanges(false)

      // Redirect to AI Review tab if we're not already there
      const url = new URL(window.location.href)
      url.searchParams.set('view', 'ai-review')
      bypassUnsavedChanges(true)
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
  const [modulesAccordionOpen, setModulesAccordionOpen] = useState<Set<string>>(() => {
    return new Set((initialModules || []).map((m) => m.id))
  })
  // Track modules we've already seen so we only auto-expand truly new ones
  const knownModuleIds = useRef<Set<string>>(new Set((initialModules || []).map((m) => m.id)))
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
  const [feedbacks, setFeedbacks] = useState<any[]>([])
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null)
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
  const [abStats, setAbStats] = useState<Record<
    string,
    { views: number; submissions: number; conversionRate: number }
  > | null>(null)
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
  const [translationAgents, setTranslationAgents] = useState<Agent[]>([])
  const [publishAgents, setPublishAgents] = useState<Agent[]>([])
  const [reviewSaveAgents, setReviewSaveAgents] = useState<Agent[]>([])
  const [aiReviewSaveAgents, setAiReviewSaveAgents] = useState<Agent[]>([])
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

    async function fetchFeedbacks() {
      try {
        const res = await fetch(
          `/api/feedbacks?postId=${post.id}&mode=${viewMode === 'source' ? 'approved' : viewMode}`,
          {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          }
        )
        if (res.ok) {
          const json = await res.json().catch(() => [])
          if (alive) setFeedbacks(json)
        }
      } catch (err) {
        console.error('Failed to fetch feedbacks', err)
      }
    }
    fetchFeedbacks()

    const feedbackHandler = () => fetchFeedbacks()
    window.addEventListener('feedback:created', feedbackHandler)

    // Load AB Stats
    if (uiConfig.abTesting?.enabled) {
      fetch(`/api/posts/${post.id}/ab-stats`, { credentials: 'same-origin' })
        .then((res) => res.json())
        .then((json) => {
          if (json.data && alive) setAbStats(json.data)
        })
        .catch((err) => console.error('Failed to load AB stats:', err))
    }

    return () => {
      alive = false
      window.removeEventListener('feedback:created', feedbackHandler)
    }
  }, [post.id, viewMode, uiConfig.abTesting?.enabled])

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

  // Load agents for Create Translation scope
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch(`/api/agents?scope=post.create-translation`, {
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => ({}))
          const agents: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setTranslationAgents(agents)
        } catch {
          if (alive) setTranslationAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [])

  // Load agents for post.publish scope
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch(`/api/agents?scope=post.publish`, { credentials: 'same-origin' })
          const json = await res.json().catch(() => ({}))
          const agents: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setPublishAgents(agents)
        } catch {
          if (alive) setPublishAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [])

  // Load agents for post.review.save scope
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch(`/api/agents?scope=post.review.save`, {
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => ({}))
          const agents: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setReviewSaveAgents(agents)
        } catch {
          if (alive) setReviewSaveAgents([])
        }
      })()
    return () => {
      alive = false
    }
  }, [])

  // Load agents for post.ai-review.save scope
  useEffect(() => {
    let alive = true
      ; (async () => {
        try {
          const res = await fetch(`/api/agents?scope=post.ai-review.save`, {
            credentials: 'same-origin',
          })
          const json = await res.json().catch(() => ({}))
          const agents: Agent[] = Array.isArray(json?.data) ? json.data : []
          if (alive) setAiReviewSaveAgents(agents)
        } catch {
          if (alive) setAiReviewSaveAgents([])
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  const orderedIds = useMemo(
    () =>
      modules
        .slice()
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((m) => m.id),
    [modules]
  )

  async function persistOrder(
    next: EditorProps['modules'],
    mode: 'publish' | 'review' | 'ai-review' = 'publish'
  ) {
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
            mode,
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

    // Map 'publish' to 'source' for ref access
    const refMode: ViewMode = mode === 'publish' ? 'source' : mode

    const creates = pendingNewModules.map(async (pm) => {
      const pending = pendingModulesByModeRef.current[refMode]?.[pm.tempId]
      const finalLabel = pending?.adminLabel !== undefined ? pending.adminLabel : pm.adminLabel

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
          adminLabel: finalLabel,
          props: pm.props || {},
          overrides: pm.overrides || null,
          mode,
        }),
      })

      if (!res.ok) {
        throw new Error(`Failed to create module: ${pm.type}`)
      }

      const json = await res.json().catch(() => ({}) as any)
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
        adminLabel: null,
        props: {},
        overrides: null,
      },
    ])

    // Add to modules display list with temporary data
    const newModule: EditorProps['modules'][0] = {
      id: tempId,
      moduleInstanceId: tempId,
      type: payload.type,
      scope: payload.scope === 'post' ? 'local' : 'global',
      globalSlug: payload.globalSlug || null,
      globalLabel: payload.globalSlug ? globalSlugToLabel.get(payload.globalSlug) || null : null,
      props: {},
      overrides: null,
      locked: false,
      orderIndex: nextOrderIndex,
    }

    setModules((prev) => [...prev, newModule])
    setHasStructuralChanges(true)
  }

  async function handleDuplicateModule(m: EditorProps['modules'][0]) {
    if (!modulesEnabled) return

    // If there are pending edits, flush them first so the clone has the latest content
    const flush = moduleFlushFns.current[m.id]
    if (flush) await flush()

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Create a deep clone of the module data
    // We clone the raw module from the state to preserve unsaved edits (props, reviewProps, etc.)
    const clonedModule: EditorProps['modules'][0] = JSON.parse(JSON.stringify(m))

    // Assign new IDs
    clonedModule.id = tempId
    clonedModule.moduleInstanceId = tempId

    // Important: if we're cloning in Review or AI Review mode, the backend expects
    // the change to be staged appropriately.
    if (viewMode === 'review') {
      clonedModule.reviewAdded = true
    } else if (viewMode === 'ai-review') {
      ; (clonedModule as any).aiReviewAdded = true
    }

    // Add to pending new modules for structural save
    setPendingNewModules((prev) => [
      ...prev,
      {
        tempId,
        type: clonedModule.type,
        scope: clonedModule.scope === 'post' ? 'local' : (clonedModule.scope as 'local' | 'global'),
        globalSlug: clonedModule.globalSlug || null,
        orderIndex: clonedModule.orderIndex + 1, // Place it underneath
        adminLabel: clonedModule.adminLabel || null,
        props: clonedModule.props,
        overrides: clonedModule.overrides,
      },
    ])

    // Insert into modules list and update order indices
    setModules((prev) => {
      const index = prev.findIndex((pm) => pm.id === m.id)
      const next = [...prev]
      if (index === -1) {
        next.push(clonedModule)
      } else {
        next.splice(index + 1, 0, clonedModule)
      }

      // Re-normalize orderIndex for all modules to ensure consistency
      return next.map((pm, idx) => ({
        ...pm,
        scope: pm.scope === 'post' ? 'local' : pm.scope,
        orderIndex: idx,
      }))
    })

    setHasStructuralChanges(true)
    toast.success('Module duplicated')

    // Open the accordion for the new module
    setModulesAccordionOpen((prev) => {
      const next = new Set(prev)
      next.add(tempId)
      return next
    })
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    setIsDraggingModules(false)
    // NOTE: removed accordion restoration as requested; they stay collapsed after drag.
    modulesAccordionOpenBeforeDrag.current = null

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

  async function onDragStart(event: DragStartEvent) {
    const { active } = event
    setActiveId(String(active.id))

    // If the user starts dragging immediately after editing, flush first so we don't lose edits when collapsing.
    await flushAllModuleEdits()
    // Temporarily collapse all accordions for easier reordering
    setIsDraggingModules(true)
    modulesAccordionOpenBeforeDrag.current = new Set(modulesAccordionOpen)
    setModulesAccordionOpen(new Set())
  }

  function onDragCancel() {
    setIsDraggingModules(false)
    setActiveId(null)
    // NOTE: removed accordion restoration as requested; they stay collapsed.
    modulesAccordionOpenBeforeDrag.current = null
  }

  const adjustModuleForView = useCallback(
    (m: EditorProps['modules'][number]) => {
      let currentProps = m.props || {}
      let currentOverrides = m.overrides || null

      if (viewMode === 'review') {
        if (m.scope === 'post') {
          currentProps = m.reviewProps ?? m.props ?? {}
        } else {
          currentOverrides = (m as any).reviewOverrides ?? m.overrides ?? null
        }
      } else if (viewMode === 'ai-review') {
        if (m.scope === 'post') {
          currentProps = (m as any).aiReviewProps ?? m.props ?? {}
        } else {
          currentOverrides = (m as any).aiReviewOverrides ?? m.overrides ?? null
        }
      }

      const adminLabel = m.adminLabel ?? null

      return {
        ...m,
        props: currentProps,
        overrides: currentOverrides,
        adminLabel,
      }
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
    if (!hasAiReviewBaseline && viewMode === 'ai-review') {
      // AI Review draft removed/absent; fall back safely.
      setViewMode(hasReviewBaseline ? 'review' : hasSourceBaseline ? 'source' : 'review')
    }
  }, [hasSourceBaseline, hasAiReviewBaseline, hasReviewBaseline, viewMode])

  const activeModule = useMemo(() => {
    if (!activeId) return null
    return modules.find((m) => m.id === activeId)
  }, [activeId, modules])

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
        if (shouldExpandAll || !knownModuleIds.current.has(id)) {
          // If we're initial and have > 15, we DON'T add to 'next'
          if (isInitial && sortedModuleIds.length > 15) {
            // keep collapsed
          } else {
            next.add(id)
          }
          knownModuleIds.current.add(id)
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
    (
      moduleId: string,
      overrides: Record<string, any> | null,
      edited: Record<string, any>,
      adminLabel?: string | null
    ) => {
      const isEmptyOverrides =
        overrides == null || (typeof overrides === 'object' && Object.keys(overrides).length === 0)
      const isEmptyEdited =
        edited == null || (typeof edited === 'object' && Object.keys(edited).length === 0)

      const currentModule = modules.find((mod) => mod.id === moduleId)
      const finalAdminLabel = adminLabel !== undefined ? adminLabel : currentModule?.adminLabel
      const labelChanged = finalAdminLabel !== currentModule?.adminLabel

      // If both are empty AND label hasn't changed, don't mark this module as pending.
      if (isEmptyOverrides && isEmptyEdited && !labelChanged) {
        const existing = (pendingModulesByModeRef.current[viewMode] || {})[moduleId]
        if (existing) {
          // If we already had something staged, we keep it unless this is an explicit "clear"
        } else {
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
        [moduleId]: { overrides: overrides, edited: edited, adminLabel: finalAdminLabel },
      }
      // Also keep a union map for isDirty + UI (keyed by mode so multiple versions can coexist).
      const unionKey = `${viewMode}:${moduleId}`
      setPendingModules((prev) => ({
        ...prev,
        [unionKey]: { overrides: overrides, edited: edited, adminLabel: finalAdminLabel },
      }))
      setModules((prev) =>
        prev.map((m) => {
          if (m.id !== moduleId) return m
          const nextLabel = finalAdminLabel
          if (viewMode === 'review') {
            if (m.scope === 'post') {
              return { ...m, reviewProps: edited, overrides: null, adminLabel: nextLabel }
            } else {
              return { ...m, reviewOverrides: overrides, adminLabel: nextLabel }
            }
          } else if (viewMode === 'ai-review') {
            if (m.scope === 'post') {
              return { ...m, aiReviewProps: edited, overrides: null, adminLabel: nextLabel }
            } else {
              return { ...m, aiReviewOverrides: overrides, adminLabel: nextLabel }
            }
          } else {
            if (m.scope === 'post') {
              return { ...m, props: edited, overrides: null, adminLabel: nextLabel }
            } else {
              return { ...m, overrides: overrides, adminLabel: nextLabel }
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
    created?: Array<{ tempId: string; postModuleId: string }>,
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
        readonly [
          string,
          {
            overrides: Record<string, any> | null
            edited: Record<string, any>
            adminLabel?: string | null
          },
        ]
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
      const updates = persistedEntries.map(async ([id, payload]) => {
        const url = `/api/post-modules/${encodeURIComponent(id)}`
        // For local modules, send edited props as overrides (they get merged into ai_review_props/review_props)
        // For global modules, send overrides (they get saved to ai_review_overrides/review_overrides)
        const module = findModule(id)
        const isLocal = module?.scope === 'post' || module?.scope === 'local'
        const overridesToSend = isLocal ? payload.edited : payload.overrides
        const adminLabel = payload.adminLabel

        // Build request body - only include adminLabel if it's explicitly set (not undefined)
        const body: any = { overrides: overridesToSend, mode }
        if (adminLabel !== undefined) {
          body.adminLabel = adminLabel
        }

        return await fetch(url, {
          method: 'PUT',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            ...xsrfHeader(),
          },
          credentials: 'same-origin',
          body: JSON.stringify(body),
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
      pendingModulesByModeRef.current = { 'source': {}, 'review': {}, 'ai-review': {} }
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
    // Use executeSave instead of Inertia put to avoid "plain JSON response" errors
    // since the /api/posts route returns JSON.
    executeSave(viewMode === 'source' ? 'source' : (viewMode as any))
  }

  return (
    <div className="min-h-screen bg-backdrop-medium">
      <FeedbackMarkers
        feedbacks={feedbacks}
        activeId={selectedFeedbackId}
        onMarkerClick={(f) => {
          setSelectedFeedbackId(f.id)
          // Could scroll to feedback in sidebar
        }}
      />
      <AdminHeader
        title={`Edit ${post.type ? humanizeSlug(post.type) : 'Post'}${post.abVariation && abVariations.length > 1 ? ` (Var ${post.abVariation})` : ''}`}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Post Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Content Card */}
            <div className="bg-backdrop-low rounded-2xl p-8 border border-line-low shadow-sm">
              <div className="flex items-start justify-between gap-3 mb-8">
                <h2 className="text-xl font-bold text-neutral-high tracking-tight">Content</h2>
                {permalinksEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider border border-line-medium rounded-lg hover:bg-backdrop-medium text-neutral-medium transition-all"
                        onClick={() => {
                          const base = (post as any).publicPath || `/posts/${post.slug}`
                          const target =
                            viewMode !== 'source'
                              ? `${base}${base.includes('?') ? '&' : '?'}view=${viewMode}`
                              : base
                          window.open(target, '_blank')
                        }}
                        type="button"
                      >
                        View on Site
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Open the current view in a new tab</p>
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                {/* Title */}
                {(uiConfig?.hideCoreFields || []).includes('title') ? null : (
                  <div>
                    <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                      Title *
                    </label>
                    <Input
                      type="text"
                      className="text-lg font-semibold border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl"
                      value={data.title}
                      onChange={(e) => {
                        const val = e.target.value
                        setData('title', val)
                        // Auto-suggest slug while slug is marked auto-generated
                        if (slugAuto) {
                          const suggested = slugify(val)
                          setData('slug', suggested)
                        }
                      }}
                      placeholder="Enter post title"
                    />
                    {errors.title && (
                      <p className="text-sm text-red-500 mt-1.5 ml-1">{errors.title}</p>
                    )}
                  </div>
                )}

                {/* Excerpt */}
                <div>
                  <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                    Excerpt
                  </label>
                  <Textarea
                    className="border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl min-h-[100px]"
                    value={data.excerpt}
                    onChange={(e) => setData('excerpt', e.target.value)}
                    rows={3}
                    placeholder="Brief description (optional)"
                  />
                  {errors.excerpt && (
                    <p className="text-sm text-red-500 mt-1.5 ml-1">{errors.excerpt}</p>
                  )}
                </div>

                {/* Featured Image (core) */}
                {uiConfig?.featuredImage?.enabled && (
                  <div className="group max-w-70">
                    <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
                          <span>{uiConfig.featuredImage.label || 'Featured Media'}</span>
                        </span>
                        {featuredImageFieldAgents.length > 0 && hasFieldPermission && (
                          <div className="flex items-center">
                            {featuredImageFieldAgents.length === 1 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedFeaturedImageAgent(featuredImageFieldAgents[0])
                                      setFeaturedImageAgentModalOpen(true)
                                    }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-backdrop-medium rounded-lg"
                                  >
                                    <FontAwesomeIcon
                                      icon={faWandMagicSparkles}
                                      className="text-neutral-medium hover:text-standout-high transition-colors"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>AI Assistant: {featuredImageFieldAgents[0].name}</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <Popover>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <PopoverTrigger asChild>
                                      <button
                                        type="button"
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-backdrop-medium rounded-lg"
                                      >
                                        <FontAwesomeIcon
                                          icon={faWandMagicSparkles}
                                          className="text-neutral-medium hover:text-standout-high transition-colors"
                                        />
                                      </button>
                                    </PopoverTrigger>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>AI Assistants</p>
                                  </TooltipContent>
                                </Tooltip>
                                <PopoverContent
                                  align="end"
                                  className="w-56 p-2 bg-backdrop-high border-line-medium shadow-xl rounded-xl"
                                >
                                  <div className="px-2 py-1.5 border-b border-line-low mb-1">
                                    <h4 className="text-[10px] font-bold text-neutral-low uppercase tracking-widest">
                                      Select AI Agent
                                    </h4>
                                  </div>
                                  <div className="space-y-0.5">
                                    {featuredImageFieldAgents.map((agent) => (
                                      <button
                                        key={agent.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedFeaturedImageAgent(agent)
                                          setFeaturedImageAgentModalOpen(true)
                                        }}
                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-backdrop-medium text-left transition-colors"
                                      >
                                        <div className="w-6 h-6 rounded bg-standout-high/10 flex items-center justify-center text-standout-high">
                                          <FontAwesomeIcon
                                            icon={faWandMagicSparkles}
                                            className="text-[10px]"
                                          />
                                        </div>
                                        <span className="text-xs font-medium text-neutral-high">
                                          {agent.name}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )}
                          </div>
                        )}
                      </div>
                    </label>
                    <div className="p-1 border border-line-medium rounded-2xl bg-backdrop-medium/20">
                      <MediaThumb
                        mediaId={(data as any).featuredImageId || null}
                        layout="vertical"
                        size="w-full aspect-video"
                        onChange={() => setOpenMediaForField('featuredImage')}
                        onClear={() => setData('featuredImageId', '')}
                      />
                    </div>
                    {/* ... modal logic ... */}
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
                        onSuccess={(resp) => {
                          // Note: AgentModal now performs background router.reload
                          // We don't close it immediately so user can see summary
                          if (resp.generatedMediaId) {
                            // If an image was generated, we might want to do something else
                          }
                        }}
                      />
                    )}
                  </div>
                )}

                {/* Categories (Taxonomies) */}
                {taxonomyOptions.length > 0 && (
                  <div className="space-y-6">
                    <div className="text-[12px] font-bold text-neutral-medium uppercase tracking-wider mb-2 ml-1">
                      Categories
                    </div>
                    {taxonomyOptions.map((tax) => {
                      const selectedCount = Array.from(selectedTaxonomyTerms).filter((id) =>
                        tax.options.some((o) => o.id === id)
                      ).length
                      const limit = tax.maxSelections === null ? Infinity : tax.maxSelections
                      return (
                        <div
                          key={tax.slug}
                          className="space-y-4 rounded-xl border border-line-low p-5 bg-backdrop-medium/10 shadow-sm"
                        >
                          <div className="text-sm font-bold text-neutral-high flex items-center justify-between">
                            <span>{tax.name}</span>
                            {tax.maxSelections && (
                              <span className="text-[10px] text-neutral-low uppercase">
                                Limit: {tax.maxSelections}
                              </span>
                            )}
                          </div>
                          {tax.options.length === 0 ? (
                            <p className="text-xs text-neutral-low italic">
                              No terms available for {tax.name}
                            </p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {tax.options.map((opt, idx) => {
                                const checked = selectedTaxonomyTerms.has(opt.id)
                                const disableUnchecked = !checked && selectedCount >= limit
                                return (
                                  <label
                                    key={`${tax.slug}:${String(opt.id || idx)}`}
                                    className={`flex items-center gap-2 text-sm p-2 rounded-lg border transition-all cursor-pointer ${checked ? 'bg-standout-high/5 border-standout-high/20 text-neutral-high' : 'bg-backdrop-low border-line-low text-neutral-medium hover:border-line-medium'}`}
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
                            <div className="flex items-center gap-2 pt-2 border-t border-line-low/50 mt-2">
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
                                placeholder={`Add new ${tax.name.toLowerCase()}...`}
                                className="flex-1 h-9 text-sm rounded-lg border-line-medium"
                              />
                              <button
                                type="button"
                                className="h-9 px-4 text-xs font-bold uppercase tracking-wider rounded-lg bg-neutral-high text-backdrop-low hover:bg-neutral-low disabled:opacity-30 transition-all"
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
                <div className="mt-6 border-t border-line-low pt-6">
                  <CustomFieldRenderer
                    definitions={initialCustomFields.map((f) => ({
                      ...f,
                      type: f.type || f.fieldType || 'text',
                    }))}
                    values={(() => {
                      const vals: Record<string, any> = {}
                        ; (data.customFields as any[])?.forEach((v) => {
                          vals[v.slug] = v.value
                        })
                      return vals
                    })()}
                    onChange={(slug, val) => {
                      const prev = (data.customFields as any[]) || []
                      const def = initialCustomFields.find((f) => f.slug === slug)
                      if (!def) return

                      const list = prev.slice()
                      const idx = list.findIndex((e) => e.slug === slug)
                      const next = { fieldId: def.id, slug, value: val }
                      if (idx >= 0) list[idx] = next
                      else list.push(next)
                      setData('customFields', list as any)
                    }}
                    onDirty={() => {
                      // Custom fields are already part of `data`, so `setData` will update `isDirty`.
                    }}
                  />
                </div>
              )}

              {/* Modules integrated into Content (hidden when modules are disabled) */}
              {modulesEnabled && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <h3 className="text-[12px] font-bold text-neutral-medium uppercase tracking-wider">
                        Modules
                      </h3>
                      {modules.length > 0 && (
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() =>
                              setModulesAccordionOpen(new Set(modules.map((m) => m.id)))
                            }
                            className="text-[10px] uppercase font-bold text-neutral-low hover:text-standout-high transition-colors flex items-center gap-1"
                          >
                            <FontAwesomeIcon icon={faExpandAlt} className="text-[8px]" />
                            Expand All
                          </button>
                          <button
                            type="button"
                            onClick={() => setModulesAccordionOpen(new Set())}
                            className="text-[10px] uppercase font-bold text-neutral-low hover:text-standout-high transition-colors flex items-center gap-1"
                          >
                            <FontAwesomeIcon icon={faCompressAlt} className="text-[8px]" />
                            Collapse All
                          </button>
                        </div>
                      )}
                    </div>
                    <ModulePicker
                      postId={post.id}
                      postType={post.type}
                      mode={
                        viewMode === 'review'
                          ? 'review'
                          : viewMode === 'ai-review'
                            ? 'ai-review'
                            : 'publish'
                      }
                      onAdd={handleAddModule}
                    />
                  </div>
                  {modules.length === 0 ? (
                    <div className="text-center py-12 text-neutral-low">
                      <p>No modules yet. Use “Add Module” to insert one.</p>
                    </div>
                  ) : (
                    <>
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
                                onDuplicate={handleDuplicateModule}
                                registerModuleFlush={registerModuleFlush}
                                stageModuleEdits={stageModuleEdits}
                                markModuleDirty={markModuleDirty}
                                postId={post.id}
                                customFields={initialCustomFields || []}
                                lastUpdateKey={lastUpdateKey}
                              />
                            ))}
                          </ul>
                        </SortableContext>
                        <DragOverlay adjustScale={false} zIndex={1000}>
                          {activeModule ? (
                            <div className="w-full max-w-4xl shadow-2xl rounded-xl overflow-hidden ring-2 ring-standout-high/50 cursor-grabbing bg-backdrop-low">
                              <ModuleRow
                                m={activeModule}
                                viewMode={viewMode}
                                isDraggingModules={true}
                                modulesAccordionOpen={new Set()}
                                moduleSchemasReady={moduleSchemasReady}
                                moduleFieldAgents={moduleFieldAgents}
                                globalSlugToLabel={globalSlugToLabel}
                                moduleRegistry={moduleRegistry}
                                moduleFlushFns={moduleFlushFns}
                                setModulesAccordionOpen={setModulesAccordionOpen}
                                setPendingRemoved={setPendingRemoved}
                                setPendingReviewRemoved={setPendingReviewRemoved}
                                setModules={setModules}
                                onDuplicate={handleDuplicateModule}
                                registerModuleFlush={registerModuleFlush}
                                stageModuleEdits={stageModuleEdits}
                                markModuleDirty={markModuleDirty}
                                postId={post.id}
                                customFields={initialCustomFields || []}
                                isOverlay={true}
                                lastUpdateKey={lastUpdateKey}
                              />
                            </div>
                          ) : null}
                        </DragOverlay>
                      </DndContext>
                      {modules.length >= 3 && (
                        <div className="flex justify-end mt-4">
                          <ModulePicker
                            postId={post.id}
                            postType={post.type}
                            mode={
                              viewMode === 'review'
                                ? 'review'
                                : viewMode === 'ai-review'
                                  ? 'ai-review'
                                  : 'publish'
                            }
                            onAdd={handleAddModule}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* SEO Card */}
            {permalinksEnabled && (
              <div className="bg-backdrop-low rounded-2xl p-8 border border-line-low shadow-sm">
                <h2 className="text-xl font-bold text-neutral-high mb-8 tracking-tight">
                  SEO & Meta
                </h2>

                <div className="space-y-6">
                  {/* Slug */}
                  <div>
                    <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                      <div className="flex items-center justify-between">
                        <span>Slug *</span>
                        {post.abVariation && abVariations.length > 1 && (
                          <span className="text-[9px] text-standout-high normal-case font-normal">
                            Note: Variations share the primary post's public URL.
                          </span>
                        )}
                      </div>
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        className="font-mono text-sm border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl h-11"
                        value={data.slug}
                        onChange={(e) => {
                          const v = String(e.target.value || '')
                            .toLowerCase()
                            .replace(/[^a-z0-9]+/g, '-')
                            .replace(/-+/g, '-')
                          setData('slug', v)
                          // If user clears slug, re-enable auto; otherwise consider it manually controlled
                          setSlugAuto(v === '')
                        }}
                        onBlur={() => {
                          // Normalize fully on blur
                          const v = slugify(String(data.slug || ''))
                          setData('slug', v)
                        }}
                        placeholder="post-slug"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <FontAwesomeIcon
                          icon={faLink}
                          className={`text-lg ${slugAuto ? 'text-standout-high' : 'text-neutral-low opacity-20'}`}
                        />
                      </div>
                    </div>
                    {errors.slug && (
                      <p className="text-sm text-red-500 mt-1.5 ml-1">{errors.slug}</p>
                    )}
                    {pathPattern && (
                      <p className="mt-2 text-[10px] text-neutral-low font-mono bg-backdrop-medium/30 px-2 py-1 rounded border border-line-low/50 truncate">
                        Preview: {buildPreviewPath(data.slug)}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    {/* Meta Title */}
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                        Meta Title
                      </label>
                      <Input
                        type="text"
                        className="border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl h-11"
                        value={data.metaTitle}
                        onChange={(e) => setData('metaTitle', e.target.value)}
                        placeholder="Custom meta title (optional)"
                      />
                      <p className="text-[10px] text-neutral-low mt-1.5 ml-1 italic">
                        Leave blank to use post title
                      </p>
                    </div>

                    {/* Meta Description */}
                    <div>
                      <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                        Meta Description
                      </label>
                      <Textarea
                        className="border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl"
                        value={data.metaDescription}
                        onChange={(e) => setData('metaDescription', e.target.value)}
                        rows={3}
                        placeholder="Custom meta description (optional)"
                      />
                      <p className="text-[10px] text-neutral-low mt-1.5 ml-1 italic">
                        Recommended: 150-160 characters
                      </p>
                    </div>

                    {/* Robots Toggles */}
                    <div className="pt-4 border-t border-line-low">
                      <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mb-3 ml-1">
                        Search Engine Visibility
                      </label>
                      <div className="flex gap-6 ml-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="noindex"
                            checked={data.noindex}
                            onCheckedChange={(val) => setData('noindex', !!val)}
                          />
                          <label
                            htmlFor="noindex"
                            className="text-xs font-medium text-neutral-medium cursor-pointer"
                          >
                            No Index (Prevent from appearing in search results)
                          </label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="nofollow"
                            checked={data.nofollow}
                            onCheckedChange={(val) => setData('nofollow', !!val)}
                          />
                          <label
                            htmlFor="nofollow"
                            className="text-xs font-medium text-neutral-medium cursor-pointer"
                          >
                            No Follow (Prevent search engines from following links)
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Social Media Preview / Settings */}
                    <div className="pt-6 border-t border-line-low space-y-4">
                      <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mb-2 ml-1">
                        Social Media
                      </label>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1 mb-1.5">
                              Social Title
                            </label>
                            <Input
                              type="text"
                              className="border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl h-10 text-sm"
                              value={data.socialTitle}
                              onChange={(e) => setData('socialTitle', e.target.value)}
                              placeholder="Social sharing title (optional)"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1 mb-1.5">
                              Social Description
                            </label>
                            <Textarea
                              className="border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl text-sm"
                              value={data.socialDescription}
                              onChange={(e) => setData('socialDescription', e.target.value)}
                              rows={3}
                              placeholder="Social sharing description (optional)"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1 mb-1.5">
                            Social Sharing Image
                          </label>
                          <div className="space-y-3">
                            <div className="p-1 border border-line-medium rounded-2xl bg-backdrop-medium/20 relative group overflow-hidden">
                              <MediaThumb
                                mediaId={(data as any).socialImageId || null}
                                className="w-full border-none bg-transparent"
                                size="aspect-[1.91/1] w-full"
                                layout="vertical"
                                onChange={() => setOpenMediaForField('socialImage')}
                                onClear={() => setData('socialImageId', '')}
                                fallbackMediaId={(data as any).featuredImageId || null}
                              />
                            </div>
                            <MediaPickerModal
                              open={openMediaForField === 'socialImage'}
                              onOpenChange={(o) => setOpenMediaForField(o ? 'socialImage' : null)}
                              initialSelectedId={(data as any).socialImageId || undefined}
                              onSelect={(m) => {
                                setData('socialImageId', m.id)
                                setOpenMediaForField(null)
                              }}
                            />
                            <p className="text-[10px] text-neutral-low italic ml-1">
                              Recommended: 1200x630px. Defaults to Featured Image.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SEO Previews */}
                    <div className="pt-8 border-t border-line-low space-y-6">
                      <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mb-2 ml-1">
                        Previews
                      </label>

                      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                        {/* Search Engine Preview */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1">
                            Google Search
                          </span>
                          <div className="bg-white dark:bg-[#202124] p-6 rounded-xl border border-line-low shadow-sm max-w-lg transition-colors">
                            <div className="text-[14px] text-[#1a0dab] dark:text-[#8ab4f8] leading-tight truncate mb-1 hover:underline cursor-pointer">
                              {data.metaTitle || data.title || 'Post Title'}
                            </div>
                            <div className="text-[12px] text-[#006621] dark:text-[#bdc1c6] truncate mb-1">
                              {window.location.origin}
                              {data.canonicalUrl || `/${data.slug}`}
                            </div>
                            <div className="text-[13px] text-[#4d5156] dark:text-[#bdc1c6] line-clamp-2 leading-relaxed">
                              {data.metaDescription ||
                                data.excerpt ||
                                'Please provide a meta description or excerpt to see how this post will appear in search results.'}
                            </div>
                          </div>
                        </div>

                        {/* Social Media Preview (Facebook/LinkedIn style) */}
                        <div className="space-y-3">
                          <span className="text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1">
                            Facebook / LinkedIn
                          </span>
                          <div className="bg-[#f2f3f5] dark:bg-[#242526] rounded-xl border border-line-low shadow-sm overflow-hidden max-w-lg transition-colors">
                            <div className="aspect-[1.91/1] bg-backdrop-medium relative overflow-hidden">
                              <MediaThumb
                                mediaId={(data as any).socialImageId || null}
                                fallbackMediaId={(data as any).featuredImageId || null}
                                className="w-full h-full border-none p-0 bg-transparent rounded-none"
                                size="w-full h-full"
                                hideActions
                              />
                            </div>
                            <div className="p-3 bg-white dark:bg-[#242526] border-t border-line-low transition-colors">
                              <div className="text-[12px] text-neutral-low dark:text-[#b0b3b8] uppercase tracking-wider mb-1">
                                {window.location.hostname.toUpperCase()}
                              </div>
                              <div className="text-[16px] font-bold text-neutral-high dark:text-[#e4e6eb] line-clamp-2 leading-tight mb-1">
                                {data.socialTitle || data.metaTitle || data.title || 'Post Title'}
                              </div>
                              <div className="text-[14px] text-neutral-medium dark:text-[#b0b3b8] line-clamp-1 leading-normal">
                                {data.socialDescription ||
                                  data.metaDescription ||
                                  data.excerpt ||
                                  'Post description...'}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Advanced SEO Toggle */}
                  <details className="group/advanced border-t border-line-low pt-4 mt-6">
                    <summary className="flex items-center gap-2 text-[11px] font-bold text-neutral-low uppercase tracking-wider cursor-pointer hover:text-neutral-high transition-colors list-none">
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className="group-open/advanced:rotate-180 transition-transform"
                      />
                      Advanced SEO Settings
                    </summary>

                    <div className="mt-6 space-y-6">
                      {/* Canonical URL */}
                      <div>
                        <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                          Canonical URL
                        </label>
                        <Input
                          type="url"
                          className="border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl h-11 text-sm"
                          value={data.canonicalUrl}
                          onChange={(e) => setData('canonicalUrl', e.target.value)}
                          placeholder="https://example.com/my-post"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Robots JSON */}
                        <div>
                          <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                            Robots (JSON)
                          </label>
                          <Textarea
                            value={data.robotsJson}
                            onChange={(e) => setData('robotsJson', e.target.value)}
                            rows={4}
                            className="font-mono text-[11px] border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl bg-backdrop-medium/10"
                            placeholder={JSON.stringify({ index: true, follow: true }, null, 2)}
                          />
                        </div>

                        {/* JSON-LD Overrides */}
                        <div>
                          <label className="block text-[12px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1">
                            JSON-LD Overrides
                          </label>
                          <Textarea
                            value={data.jsonldOverrides}
                            onChange={(e) => setData('jsonldOverrides', e.target.value)}
                            rows={4}
                            className="font-mono text-[11px] border-line-medium focus:ring-standout-high/20 focus:border-standout-high rounded-xl bg-backdrop-medium/10"
                            placeholder={JSON.stringify({ '@type': 'BlogPosting' }, null, 2)}
                          />
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Sidebar */}
          <div className="space-y-8">
            {/* Actions */}
            <div className="bg-backdrop-low rounded-2xl shadow-sm p-6 border border-line-low">
              <h3 className="text-[12px] font-bold text-neutral-medium uppercase tracking-wider mb-6 ml-1">
                Actions
              </h3>

              <div className="space-y-8">
                {/* Locale Switcher */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1">
                    Locale
                  </label>
                  <div className="flex flex-col gap-2">
                    <Select
                      defaultValue={selectedLocale}
                      onValueChange={(nextLocale) => {
                        setSelectedLocale(nextLocale)
                        if (nextLocale === post.locale) return
                        const target = translations?.find((t) => t.locale === nextLocale)
                        if (target) {
                          bypassUnsavedChanges(true)
                          router.visit(`/admin/posts/${target.id}/edit`)
                        }
                      }}
                    >
                      <SelectTrigger className="w-full h-10 text-sm font-medium border-line-medium rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocales.map((loc) => {
                          const exists = translationsSet.has(loc)
                          const label = exists
                            ? `${loc.toUpperCase()}`
                            : `${loc.toUpperCase()} (missing)`
                          return (
                            <SelectItem key={loc} value={loc} className="text-sm">
                              {label}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>

                    {selectedLocale !== post.locale && !translationsSet.has(selectedLocale) && (
                      <button
                        type="button"
                        className="w-full py-2 text-xs font-bold uppercase tracking-wider rounded-xl border border-standout-high/30 text-standout-high hover:bg-standout-high/5 transition-all flex items-center justify-center gap-2"
                        onClick={async () => {
                          const toCreate = selectedLocale
                          setIsCreatingTranslation(true)
                          try {
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
                            const j = await res.json().catch(() => ({}))
                            if (!res.ok) {
                              throw new Error(j?.error || 'Failed to create translation')
                            }

                            toast.success(
                              translationAgents.length > 0
                                ? 'Translation created and content generated'
                                : 'Translation created successfully'
                            )

                            const newId = j?.data?.id
                            if (newId) {
                              // Navigate to the new translation
                              // We use view=ai-review because the agent likely put content there
                              setTimeout(() => {
                                bypassUnsavedChanges(true)
                                router.visit(`/admin/posts/${newId}/edit${translationAgents.length > 0 ? '?view=ai-review' : ''}`)
                              }, 500)
                            } else {
                              setTimeout(() => {
                                bypassUnsavedChanges(true)
                                router.reload()
                              }, 1000)
                            }
                          } catch (err: any) {
                            toast.error(err.message || 'Failed to create translation')
                          } finally {
                            setIsCreatingTranslation(false)
                          }
                        }}
                      >
                        {translationAgents.length > 0 && (
                          <FontAwesomeIcon icon={faBrain} className="text-[10px] animate-pulse" />
                        )}
                        Create Translation
                      </button>
                    )}
                  </div>
                </div>

                {/* A/B Variation toggle */}
                {uiConfig.abTesting?.enabled && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between ml-1">
                      <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest">
                        A/B Variation
                      </label>
                      {post.abVariation && abVariations.length > 1 && (
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Promote Variation?',
                              description: `Promote Variation ${post.abVariation} as the winner? This will replace the main post content with this variation and end the A/B test.`,
                              variant: 'destructive',
                            })
                            if (ok) {
                              try {
                                const res = await fetch(`/api/posts/${post.id}/promote-variation`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'X-XSRF-TOKEN': getXsrf() || '',
                                  },
                                })
                                const j = await res.json()
                                if (res.ok) {
                                  toast.success('Variation promoted successfully!')
                                  bypassUnsavedChanges(true)
                                  router.visit(`/admin/posts/${j.id}/edit`)
                                } else {
                                  toast.error(j.error || 'Failed to promote variation')
                                }
                              } catch {
                                toast.error('Failed to promote variation')
                              }
                            }
                          }}
                          className="text-[10px] font-bold text-standout-high uppercase hover:underline"
                        >
                          Promote as Winner
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 p-1 bg-backdrop-medium/30 rounded-xl border border-line-low">
                      {(() => {
                        // Ensure unique variations and sort them
                        const uniqueVarsMap = new Map<string, any>()

                          // Process the abVariations list
                          ; (abVariations || []).forEach((v) => {
                            const vLabel = String(v.variation || '')
                              .trim()
                              .toUpperCase()
                            const existing = uniqueVarsMap.get(vLabel)
                            // Keep existing, but if current post is in the list, it should win
                            if (!existing || v.id === post.id) {
                              uniqueVarsMap.set(vLabel, { ...v, variation: vLabel })
                            }
                          })

                        const finalVars = Array.from(uniqueVarsMap.values()).sort((a, b) =>
                          a.variation.localeCompare(b.variation)
                        )

                        return finalVars.map((v) => (
                          <div key={v.id} className="relative group/var flex-1 min-w-[65px]">
                            <button
                              type="button"
                              onClick={() => {
                                if (v.id === post.id) return
                                router.visit(`/admin/posts/${v.id}/edit`)
                              }}
                              className={`w-full py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center ${v.id === post.id
                                ? 'bg-backdrop-low text-neutral-high shadow-sm'
                                : 'text-neutral-low hover:text-neutral-medium hover:bg-backdrop-medium/20'
                                }`}
                            >
                              <span>Var {v.variation}</span>
                              {abStats?.[v.variation] && (
                                <div className="mt-0.5 text-[9px] opacity-60 font-normal">
                                  {abStats[v.variation].views} views ·{' '}
                                  {abStats[v.variation].conversionRate.toFixed(1)}%
                                </div>
                              )}
                            </button>
                            {abVariations.length > 1 && v.id !== post.id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setPendingVariationToDelete(v)
                                      setVariationDeleteConfirmOpen(true)
                                    }}
                                    className="absolute top-0 right-0 text-neutral-medium hover:text-red-500 bg-backdrop-low hover:bg-red-500/10 w-5 h-5 flex items-center justify-center border transition-all z-30 opacity-60 group-hover/var:opacity-100 cursor-pointer"
                                  >
                                    <FontAwesomeIcon
                                      icon={faTrash}
                                      className="w-2 h-2 pointer-events-none"
                                      size={'xs'}
                                    />
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Delete variation</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        ))
                      })()}

                      {/* Add next variation from config */}
                      {(() => {
                        const configVariations = uiConfig.abTesting?.variations || []
                        const existingVariations = new Set(
                          (abVariations || []).map((v) =>
                            String(v.variation || '')
                              .trim()
                              .toUpperCase()
                          )
                        )
                        // If no variations explicitly set yet, A is assumed existing
                        if (existingVariations.size === 0) existingVariations.add('A')

                        const nextVar = configVariations.find(
                          (v) =>
                            !existingVariations.has(
                              String(v.value || '')
                                .trim()
                                .toUpperCase()
                            )
                        )

                        if (nextVar) {
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingVariationToCreate(nextVar)
                                setVariationCreateConfirmOpen(true)
                              }}
                              className="flex-1 min-w-[60px] py-1.5 text-[11px] font-bold rounded-lg text-standout-high hover:bg-standout-high/5 transition-all"
                            >
                              + {nextVar.value}
                            </button>
                          )
                        }
                        return null
                      })()}
                    </div>
                  </div>
                )}

                {/* Active Version toggle */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1">
                    Active Version
                  </label>
                  <div className="flex p-1 bg-backdrop-medium/30 rounded-xl border border-line-low">
                    {hasSourceBaseline && (
                      <button
                        type="button"
                        onClick={async () => {
                          await flushAllModuleEdits()
                          setViewMode('source')
                          const url = new URL(window.location.href)
                          url.searchParams.set('view', 'source')
                          window.history.replaceState({}, '', url.toString())
                        }}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'source' ? 'bg-backdrop-low text-neutral-high shadow-sm' : 'text-neutral-low hover:text-neutral-medium'}`}
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
                          const url = new URL(window.location.href)
                          url.searchParams.set('view', 'review')
                          window.history.replaceState({}, '', url.toString())
                        }}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'review' ? 'bg-backdrop-low text-neutral-high shadow-sm' : 'text-neutral-low hover:text-neutral-medium'}`}
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
                          const url = new URL(window.location.href)
                          url.searchParams.set('view', 'ai-review')
                          window.history.replaceState({}, '', url.toString())
                        }}
                        className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${viewMode === 'ai-review' ? 'bg-backdrop-low text-neutral-high shadow-sm' : 'text-neutral-low hover:text-neutral-medium'}`}
                      >
                        AI Review
                      </button>
                    )}
                  </div>
                </div>

                {/* Agent Runner */}
                <div className="space-y-3">
                  <label className="block text-[10px] font-bold text-neutral-low uppercase tracking-widest ml-1">
                    AI Assistant
                  </label>
                  <div className="space-y-2">
                    <Select value={selectedAgent} onValueChange={(val) => setSelectedAgent(val)}>
                      <SelectTrigger className="w-full h-10 text-sm font-medium border-line-medium rounded-xl">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={faWandMagicSparkles}
                            className="w-4 h-4 text-standout-high"
                          />
                          <SelectValue placeholder="Select an agent..." />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {agents.length === 0 ? (
                          <SelectItem value="__none__" disabled className="text-sm">
                            No agents configured
                          </SelectItem>
                        ) : (
                          agents.map((a) => (
                            <SelectItem key={a.id} value={a.id} className="text-sm">
                              {a.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {selectedAgent && (
                      <button
                        type="button"
                        onClick={() => {
                          const a = agents.find((x) => x.id === selectedAgent)
                          const promptEnabled = a?.openEndedContext?.enabled === true
                          if (promptEnabled) {
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
                                toast.success('Assistant completed successfully')

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
                                    console.warn('Page reload failed (non-critical):', reloadError)
                                  }
                                }, 100)
                              } else {
                                toast.error(j?.error || 'Assistant run failed')
                                setAgentResponse({
                                  message: `Error: ${j?.error || 'Assistant run failed'}`,
                                })
                              }
                            } catch (error: any) {
                              console.error('Assistant execution error:', error)
                              toast.error('Assistant run failed')
                              setAgentResponse({
                                message: `Error: ${error?.message || 'Assistant run failed'}`,
                              })
                            } finally {
                              setRunningAgent(false)
                            }
                          })()
                        }}
                        className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl bg-neutral-high text-backdrop-low hover:bg-neutral-low transition-all shadow-sm"
                      >
                        Run Assistant
                      </button>
                    )}
                  </div>
                </div>

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
                                                    return parsed.summary || 'Changes applied.'
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
                                <div className="bg-standout-light p-4 rounded-lg border border-standout-high text-sm whitespace-pre-wrap wrap-break-word">
                                  {agentResponse.summary}
                                </div>
                              </div>
                            )}
                            {/* Fallback: Try to extract summary from raw response if not provided */}
                            {!agentResponse.summary && agentResponse.rawResponse && (
                              <div className="space-y-1">
                                <div className="text-xs text-neutral-medium">AI Response:</div>
                                <div className="bg-standout-light p-4 rounded-lg border border-standout-high text-sm whitespace-pre-wrap wrap-break-word">
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
                                      if (parsed.summary && typeof parsed.summary === 'string') {
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
                                <div className="text-xs text-neutral-medium">Changes applied:</div>
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
                                  const targetMode = 'ai-review'

                                  // Check for redirection if a new post/translation was created
                                  if (
                                    (agentResponse as any).redirectPostId &&
                                    (agentResponse as any).redirectPostId !== post.id
                                  ) {
                                    setAgentPromptOpen(false)
                                    setAgentResponse(null)
                                    setAgentOpenEndedContext('')
                                    // Use window.location for a hard redirect if router.visit feels stuck,
                                    // but router.visit is preferred for Inertia.
                                    router.visit(
                                      `/admin/posts/${(agentResponse as any).redirectPostId}/edit?view=${targetMode}`
                                    )
                                    return
                                  }

                                  // Update URL to preserve view mode on reload
                                  const url = new URL(window.location.href)
                                  url.searchParams.set('view', targetMode)
                                  window.history.replaceState({}, '', url.toString())
                                  // Reload data to get the latest changes from the agent
                                  router.reload({
                                    only: ['aiReviewDraft', 'post', 'modules', 'translations'],
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
                                      const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
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
                                      toast.success('Assistant completed successfully')

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
                                      toast.error(j?.error || 'Assistant run failed')
                                      setAgentResponse({
                                        message: `Error: ${j?.error || 'Assistant run failed'}`,
                                      })
                                    }
                                  } catch (error: any) {
                                    console.error('Assistant execution error:', error)
                                    toast.error('Assistant run failed')
                                    setAgentResponse({
                                      message: `Error: ${error?.message || 'Assistant run failed'}`,
                                    })
                                  } finally {
                                    setRunningAgent(false)
                                  }
                                }}
                              >
                                {runningAgent ? 'Running...' : 'Run Assistant'}
                              </AlertDialogAction>
                            </>
                          )}
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}

                {/* Translation Creation Loading Modal */}
                <AlertDialog open={isCreatingTranslation} onOpenChange={() => { }}>
                  <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {translationAgents.length > 0
                          ? 'Translating Content'
                          : 'Creating Translation'}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {translationAgents.length > 0
                          ? 'Please wait while our AI agent generates the translation for you.'
                          : 'Please wait while the new translation instance is being created.'}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-3 space-y-4">
                      <div className="flex items-center gap-3">
                        <Spinner className="size-5 text-primary" />
                        <div className="text-sm font-medium">
                          {translationAgents.length > 0 ? 'AI agent is working...' : 'Creating...'}
                        </div>
                      </div>
                      <div className="text-xs text-neutral-medium">
                        This may take a few moments depending on the amount of content.
                      </div>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>

                {/* Variation Creation Loading Modal */}
                <AlertDialog open={isCreatingVariation} onOpenChange={() => { }}>
                  <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Creating Variation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Please wait while the new variation is being created for all locales.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="mt-3 space-y-4">
                      <div className="flex items-center gap-3">
                        <Spinner className="size-5 text-primary" />
                        <div className="text-sm font-medium">Cloning structure...</div>
                      </div>
                      <div className="text-xs text-neutral-medium">
                        This clones all modules and custom fields across your translation family.
                      </div>
                    </div>
                  </AlertDialogContent>
                </AlertDialog>

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
                      {post.status === 'archived' && canDelete && (
                        <button
                          type="button"
                          className="h-9 px-3 text-xs bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
                          onClick={() => setPostDeleteConfirmOpen(true)}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                          Delete
                        </button>
                      )}
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
                        className={`h-8 px-3 text-xs rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5 ${!isDirty || processing || isSaving ? 'border border-border text-neutral-medium' : 'bg-standout-high text-on-high font-medium'}`}
                        disabled={
                          !isDirty ||
                          processing ||
                          isSaving ||
                          (saveTarget === 'review' && !canSaveForReview)
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
                        {saveTarget === 'source' &&
                          data.status === 'published' &&
                          publishAgents.length > 0 && (
                            <FontAwesomeIcon icon={faBrain} className="text-[10px] animate-pulse" />
                          )}
                        {saveTarget === 'review' && reviewSaveAgents.length > 0 && (
                          <FontAwesomeIcon icon={faBrain} className="text-[10px] animate-pulse" />
                        )}
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
                      className={`h-8 px-3 text-xs rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5 ${!isDirty || processing || isSaving ? 'border border-border text-neutral-medium' : 'bg-standout-high text-on-high font-medium'}`}
                      disabled={!isDirty || processing || isSaving || !canSaveForReview}
                      onClick={async () => {
                        await executeSave('review')
                      }}
                    >
                      {reviewSaveAgents.length > 0 && (
                        <FontAwesomeIcon icon={faBrain} className="text-[10px] animate-pulse" />
                      )}
                      {isSaving ? 'Saving...' : 'Save'}
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
                      className={`h-8 px-3 text-xs rounded-lg disabled:opacity-50 flex items-center justify-center gap-1.5 ${!isDirty || processing || isSaving ? 'border border-border text-neutral-medium' : 'bg-standout-high text-on-high font-medium'}`}
                      disabled={!isDirty || processing || isSaving}
                      onClick={async () => {
                        await executeSave('ai-review')
                      }}
                    >
                      {aiReviewSaveAgents.length > 0 && (
                        <FontAwesomeIcon icon={faBrain} className="text-[10px] animate-pulse" />
                      )}
                      {isSaving ? 'Saving...' : 'Save'}
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
                                  const data = await res.json().catch(() => null)
                                  toast.success(
                                    data?.message ||
                                    (mode === 'reject-ai-review'
                                      ? 'AI Review discarded'
                                      : 'Review discarded')
                                  )
                                  setRejectConfirmOpen(false)
                                  window.location.reload()
                                } else {
                                  const err = await res.json().catch(() => null)
                                  console.error('Reject failed:', res.status, err)
                                  toast.error(
                                    err?.error ||
                                    err?.message ||
                                    (err?.errors ? 'Failed (validation)' : 'Failed')
                                  )
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
              </div>
            </div>

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
                      <option value="">Select a user...</option>
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
                <p className="text-sm text-neutral-low">Loading...</p>
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

            {/* Feedback */}
            <div className="bg-backdrop-low rounded-lg shadow border border-border overflow-hidden">
              <FeedbackPanel
                postId={post.id}
                mode={viewMode === 'source' ? 'approved' : viewMode}
                highlightId={selectedFeedbackId}
                onSelect={(id) => setSelectedFeedbackId(id)}
                onJumpToSpot={(ctx, fbId) => {
                  if (ctx.selector) {
                    const url = new URL(post.publicPath, window.location.origin)
                    url.searchParams.set('feedback_id', fbId)
                    // If we're in a specific variation or mode, pass that along
                    if (post.abVariation) {
                      url.searchParams.set('variation_id', post.id)
                    }
                    if (viewMode !== 'source') {
                      url.searchParams.set('inline_mode', viewMode)
                    }
                    bypassUnsavedChanges(true)
                    router.visit(url.toString())
                  }
                }}
              />
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
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
                className="w-full px-3 py-2 text-sm rounded bg-standout-high text-on-high hover:opacity-90"
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

      {/* Variation Creation Confirm */}
      <AlertDialog open={variationCreateConfirmOpen} onOpenChange={setVariationCreateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Variation {pendingVariationToCreate?.value}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will clone the current variation's structure and modules into a new variation.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingVariationToCreate) return
                setVariationCreateConfirmOpen(false)
                setIsCreatingVariation(true)
                try {
                  const res = await fetch(`/api/posts/${post.id}/variations`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-XSRF-TOKEN': getXsrf() || '',
                    },
                    body: JSON.stringify({
                      variation: pendingVariationToCreate.value,
                    }),
                  })
                  const j = await res.json()
                  if (j.id) {
                    toast.success(
                      j.message ||
                      `Variation ${pendingVariationToCreate.value} created for all locales`
                    )
                    bypassUnsavedChanges(true)
                    router.visit(`/admin/posts/${j.id}/edit`)
                  } else {
                    toast.error(j.error || 'Failed to create variation')
                  }
                } catch {
                  toast.error('Failed to create variation')
                } finally {
                  setIsCreatingVariation(false)
                }
              }}
            >
              Create Variation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Variation Deletion Confirm */}
      <AlertDialog open={variationDeleteConfirmOpen} onOpenChange={setVariationDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete Variation {pendingVariationToDelete?.variation}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this variation? This action cannot be undone.
              {pendingVariationToDelete?.id === post.id &&
                ' You are currently editing this variation. You will be redirected if deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                if (!pendingVariationToDelete) return
                setVariationDeleteConfirmOpen(false)
                try {
                  const res = await fetch(`/api/posts/${pendingVariationToDelete.id}/variation`, {
                    method: 'DELETE',
                    headers: {
                      'Content-Type': 'application/json',
                      'X-XSRF-TOKEN': getXsrf() || '',
                    },
                  })
                  const j = await res.json()
                  if (res.ok) {
                    toast.success(j.message || 'Variation deleted')
                    bypassUnsavedChanges(true)
                    if (j.remainingPostId) {
                      router.visit(`/admin/posts/${j.remainingPostId}/edit`)
                    } else {
                      router.reload()
                    }
                  } else {
                    toast.error(j.error || 'Failed to delete variation')
                  }
                } catch {
                  toast.error('Failed to delete variation')
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={postDeleteConfirmOpen} onOpenChange={setPostDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                await executeDelete()
                setPostDeleteConfirmOpen(false)
              }}
            >
              Delete Post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
          <SelectValue placeholder={loading ? 'Loading...' : 'None'} />
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
