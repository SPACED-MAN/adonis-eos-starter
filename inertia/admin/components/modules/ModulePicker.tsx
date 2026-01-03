import { useEffect, useState, Suspense, Component, type ReactNode } from 'react'
import { router } from '@inertiajs/react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogDescription,
} from '~/components/ui/alert-dialog'
import { getXsrf } from '~/utils/xsrf'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faReact } from '@fortawesome/free-brands-svg-icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip'
import Modules from '../../../modules'

type ModuleConfig = {
  type: string
  name: string
  description?: string
  icon?: string
  category?: string
  renderingMode?: 'static' | 'react'
  defaultValues?: Record<string, any>
}

/**
 * Simple error boundary for module previews
 */
class ModuleErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('Module preview error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full bg-backdrop-low flex items-center justify-center text-[10px] text-neutral-low p-4 text-center">
          Preview unavailable for this module type
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Thumbnail preview of a module
 */
function ModuleThumbnail({
  type,
  defaultValues,
}: {
  type: string
  defaultValues?: Record<string, any>
}) {
  // Use robust lookup matching the post renderer
  const componentKey = Object.keys(Modules).find(
    (k) => k.toLowerCase() === type.replace(/[-_]/g, '')
  )
  const ModuleComponent = componentKey ? (Modules as any)[componentKey] : null

  if (!ModuleComponent) {
    return (
      <div className="w-full h-full bg-backdrop-low flex items-center justify-center text-[10px] text-neutral-low border border-line-low rounded overflow-hidden">
        No Preview
      </div>
    )
  }

  return (
    <div className="w-full h-full relative overflow-hidden bg-backdrop-low border border-line-low rounded shadow-sm">
      <div
        className="absolute top-0 left-0 w-[1024px] min-h-[576px] origin-top-left pointer-events-none border border-line-low"
        style={{ transform: 'scale(0.25)' }}
      >
        <ModuleErrorBoundary>
          <Suspense
            fallback={
              <div className="w-full h-full flex items-center justify-center text-neutral-low animate-pulse">
                Loading...
              </div>
            }
          >
            <ModuleComponent {...(defaultValues || {})} />
          </Suspense>
        </ModuleErrorBoundary>
      </div>
    </div>
  )
}

type GlobalItem = {
  id: string
  type: string
  globalSlug: string | null
  label?: string | null
  props?: Record<string, any>
}

type OnAddPayload = {
  type: string
  name?: string
  scope: 'post' | 'global'
  globalSlug?: string | null
}

export function ModulePicker({
  postId,
  postType,
  mode = 'publish',
  onAdd,
  buttonLabel = 'Add Module',
}: {
  postId?: string
  postType: string
  mode?: 'review' | 'publish' | 'ai-review'
  onAdd?: (p: OnAddPayload) => Promise<void> | void
  buttonLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [modules, setModules] = useState<ModuleConfig[]>([])
  const [globals, setGlobals] = useState<GlobalItem[]>([])
  const [tab, setTab] = useState<'library' | 'globals'>('library')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!open) {
      setSearchQuery('')
      return
    }
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        const [regRes, globRes] = await Promise.all([
          fetch(`/api/modules/registry?post_type=${encodeURIComponent(postType)}`, {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
          }),
          fetch('/api/modules/global', { credentials: 'same-origin' }),
        ])
        const regJson = await regRes.json().catch(() => ({}))
        const globJson = await globRes.json().catch(() => ({}))
        if (!cancelled) setModules(Array.isArray(regJson?.data) ? regJson.data : [])
        if (!cancelled) setGlobals(Array.isArray(globJson?.data) ? globJson.data : [])
      } catch {
        if (!cancelled) toast.error('Failed to load modules')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open, postType])

  async function addModule(type: string, name?: string) {
    // If custom handler (e.g., templates), call it with scope='post'
    if (onAdd) {
      try {
        setLoading(true)
        await Promise.resolve(onAdd({ type, name, scope: 'post' }))
        toast.success(`Added ${name || type}`)
        setOpen(false)
      } catch {
        toast.error('Failed to add module')
      } finally {
        setLoading(false)
      }
      return
    }
    // Default: add to a post via API (scope=local for posts API)
    if (!postId) {
      toast.error('Missing postId for adding module')
      return
    }
    const xsrf = getXsrf()
    router.post(
      `/api/posts/${postId}/modules`,
      {
        moduleType: type,
        scope: 'local',
        // Omit props so backend seeds defaultProps
        orderIndex: null,
        locked: false,
        mode,
      },
      {
        headers: xsrf ? { 'X-XSRF-TOKEN': xsrf } : undefined,
        onStart: () => setLoading(true),
        onFinish: () => setLoading(false),
        onSuccess: () => {
          toast.success(`Added ${type} module`)
          setOpen(false)
        },
        onError: () => {
          toast.error('Failed to add module')
        },
        preserveScroll: true,
      }
    )
  }

  async function addGlobal(moduleType: string, globalSlug: string | null, name?: string) {
    if (!moduleType || !globalSlug) {
      toast.error('Invalid global module')
      return
    }
    if (onAdd) {
      try {
        setLoading(true)
        await Promise.resolve(onAdd({ type: moduleType, name, scope: 'global', globalSlug }))
        toast.success(`Added global: ${name || globalSlug}`)
        setOpen(false)
      } catch {
        toast.error('Failed to add global module')
      } finally {
        setLoading(false)
      }
      return
    }
    if (!postId) {
      toast.error('Missing postId for adding module')
      return
    }
    const xsrf = getXsrf()
    router.post(
      `/api/posts/${postId}/modules`,
      {
        moduleType,
        scope: 'global',
        globalSlug,
        orderIndex: null,
        locked: false,
        mode,
      },
      {
        headers: xsrf ? { 'X-XSRF-TOKEN': xsrf } : undefined,
        onStart: () => setLoading(true),
        onFinish: () => setLoading(false),
        onSuccess: () => {
          toast.success(`Added global: ${globalSlug}`)
          setOpen(false)
        },
        onError: () => {
          toast.error('Failed to add global module')
        },
        preserveScroll: true,
      }
    )
  }

  const filteredModules = modules.filter((m) => {
    const query = searchQuery.toLowerCase()
    return (
      m.name?.toLowerCase().includes(query) ||
      m.type.toLowerCase().includes(query) ||
      m.description?.toLowerCase().includes(query)
    )
  })

  const filteredGlobals = globals.filter((g) => {
    const query = searchQuery.toLowerCase()
    return (
      g.label?.toLowerCase().includes(query) ||
      g.globalSlug?.toLowerCase().includes(query) ||
      g.type.toLowerCase().includes(query)
    )
  })

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-md bg-standout-high text-on-high text-sm px-3 py-2"
      >
        {buttonLabel}
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        {open && (
          <AlertDialogContent className="w-full max-w-3xl">
            <AlertDialogHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <AlertDialogTitle>Add Module</AlertDialogTitle>
                  <AlertDialogDescription>
                    Select a module from Library or choose an existing Global module to insert.
                  </AlertDialogDescription>
                </div>
                <div className="w-full sm:w-64 relative">
                  <input
                    autoFocus
                    type="text"
                    placeholder="Filter modules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-sm border border-line-low bg-backdrop-input text-neutral-high rounded-md focus:ring-2 focus:ring-standout-high/20 outline-none"
                  />
                  <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-low pointer-events-none">
                    <FontAwesomeIcon icon="search" size="xs" />
                  </div>
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-low hover:text-neutral-high p-1"
                    >
                      <span className="sr-only">Clear search</span>
                      <span aria-hidden="true">✕</span>
                    </button>
                  )}
                </div>
              </div>
            </AlertDialogHeader>
            <div className="mt-2">
              <div className="border-b border-line-low mb-2">
                <div className="flex items-center gap-2 px-1">
                  <button
                    type="button"
                    className={`px-2 py-1 text-xs rounded-t ${tab === 'library' ? 'bg-backdrop-medium' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                    onClick={() => setTab('library')}
                  >
                    Library
                  </button>
                  <button
                    type="button"
                    className={`px-2 py-1 text-xs rounded-t ${tab === 'globals' ? 'bg-backdrop-medium' : 'text-neutral-medium hover:bg-backdrop-medium'}`}
                    onClick={() => setTab('globals')}
                  >
                    Globals
                  </button>
                </div>
              </div>
              <div className="text-xs text-neutral-low mb-2 px-1">
                {loading
                  ? 'Loading…'
                  : tab === 'library'
                    ? 'Available module types'
                    : 'Reusable global modules'}
              </div>
              {tab === 'library' ? (
                <div className="divide-y divide-line max-h-[60vh] overflow-auto">
                  {filteredModules.length === 0 && !loading && (
                    <div className="px-4 py-6 text-neutral-low text-sm text-center italic">
                      {searchQuery ? `No modules matching "${searchQuery}"` : 'No modules available'}
                    </div>
                  )}
                  {filteredModules.map((m) => {
                    const isReact = m.renderingMode === 'react'
                    return (
                      <div
                        key={m.type}
                        className="px-3 py-4 hover:bg-backdrop-medium flex items-start gap-4"
                      >
                        <div className="shrink-0 w-64 h-36">
                          <ModuleThumbnail type={m.type} defaultValues={m.defaultValues} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-neutral-high flex items-center gap-2">
                            <span className="truncate">{m.name || m.type}</span>
                            {isReact && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span
                                    className="shrink-0 inline-flex items-center rounded border border-line-medium bg-backdrop-low px-1.5 py-0.5 text-[10px] text-neutral-high cursor-help"
                                    aria-label="React module"
                                  >
                                    <FontAwesomeIcon icon={faReact} className="mr-1 text-sky-400" />
                                    React
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>React module (client-side interactivity)</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          {m.description && (
                            <div className="text-xs text-neutral-low mt-1 line-clamp-2">
                              {m.description}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                             onClick={() => addModule(m.type, m.name)}
                          className="shrink-0 inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2.5 py-1.5 text-xs text-neutral-high hover:bg-backdrop-medium"
                          disabled={loading}
                        >
                          Add
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="divide-y divide-line max-h-[60vh] overflow-auto">
                  {filteredGlobals.length === 0 && !loading && (
                    <div className="px-4 py-6 text-neutral-low text-sm text-center italic">
                      {searchQuery
                        ? `No global modules matching "${searchQuery}"`
                        : 'No global modules yet'}
                    </div>
                  )}
                  {filteredGlobals.map((g) => (
                    <div
                      key={g.id}
                      className="px-3 py-4 hover:bg-backdrop-medium flex items-start gap-4"
                    >
                      <div className="shrink-0 w-64 h-36">
                        <ModuleThumbnail type={g.type} defaultValues={g.props} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-neutral-high truncate">
                          {g.label || g.globalSlug || '(untitled)'}
                        </div>
                        <div className="text-xs text-neutral-low">
                          {g.type} {g.globalSlug ? `· ${g.globalSlug}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                           onClick={() => addGlobal(g.type, g.globalSlug, g.label)}
                        className="shrink-0 inline-flex items-center rounded border border-line-medium bg-backdrop-low px-2.5 py-1.5 text-xs text-neutral-high hover:bg-backdrop-medium"
                        disabled={loading}
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        )}
      </AlertDialog>
    </div>
  )
}
