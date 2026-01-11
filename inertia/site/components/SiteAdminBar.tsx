import { useEffect, useState, useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faWrench,
  faXmark,
  faHighlighter,
  faGlobe,
  faMessage,
  faListUl,
  faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { router } from '@inertiajs/react'
import { buildAdminPath } from '~/utils/adminPath'
import { DevTools } from '../../admin/components/DevTools'
import { FeedbackPanel } from '~/components/FeedbackPanel'
import { FeedbackMarkers } from '~/components/FeedbackMarkers'
import { ModuleOutlinePanel } from '~/components/ModuleOutlinePanel'
import { GlobalAgentButton } from '../../admin/components/agents/GlobalAgentButton'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '~/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'

import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '~/components/ui/tooltip'
import { ConfirmDialogProvider } from '~/components/ConfirmDialogProvider'
import '../lib/admin-icons'

type InlineBridge = {
  enabled: boolean
  canEdit: boolean
  mode: 'source' | 'review' | 'ai-review'
  toggle: () => void
  setMode: (m: 'source' | 'review' | 'ai-review') => void
  isDirty: boolean
  saveAll: () => Promise<void>
  saveForReview: () => Promise<void>
  availableModes: { hasSource: boolean; hasReview: boolean; hasAiReview: boolean }
  showDiffs: boolean
  toggleShowDiffs: () => void
  abVariations: Array<{ id: string; variation: string; status: string }>
  modules: any[]
  isSaving: boolean
  getValue: (moduleId: string, path: string, fallback: any) => any
  reorderModules: (newModules: any[]) => void
  addModule: (payload: {
    type: string
    name?: string
    scope: 'post' | 'global'
    globalSlug?: string | null
  }) => void
  removeModule: (moduleId: string) => void
  updateModuleLabel: (moduleId: string, label: string | null) => void
  duplicateModule: (moduleId: string) => void
  post?: any
  translations?: any[]
}

export default function SiteAdminBar({ initialProps }: { initialProps?: any }) {
  // Use buildAdminPath directly because SiteAdminBar is rendered outside <App /> context in site/app.tsx
  const prefix = initialProps?.adminPathPrefix || 'admin'
  const adminPath = (path?: string) => buildAdminPath(prefix, path)

  const [inline, setInline] = useState<InlineBridge>({
    enabled: false,
    canEdit: false,
    mode: 'source',
    toggle: () => { },
    setMode: () => { },
    isDirty: false,
    saveAll: async () => { },
    saveForReview: async () => { },
    availableModes: { hasSource: true, hasReview: false, hasAiReview: false },
    showDiffs: false,
    toggleShowDiffs: () => { },
    abVariations: [],
    modules: [],
    isSaving: false,
    getValue: (_m, _p, f) => f,
    reorderModules: () => { },
    addModule: () => { },
    removeModule: () => { },
    updateModuleLabel: () => { },
    duplicateModule: () => { },
  })

  const handleSaveAll = useCallback(async () => {
    const bridge = (window as any).__inlineBridge
    if (bridge?.saveAll) {
      await bridge.saveAll()
    } else {
      await inline.saveAll()
    }
  }, [inline.saveAll])

  const handleSaveForReview = useCallback(async () => {
    const bridge = (window as any).__inlineBridge
    if (bridge?.saveForReview) {
      await bridge.saveForReview()
    } else {
      await inline.saveForReview()
    }
  }, [inline.saveForReview])

  const handleSetMode = useCallback((m: 'source' | 'review' | 'ai-review') => {
    const bridge = (window as any).__inlineBridge
    if (bridge?.setMode) {
      bridge.setMode(m)
    } else {
      inline.setMode(m)
    }
  }, [inline.setMode])

  const handleToggle = useCallback(() => {
    const bridge = (window as any).__inlineBridge
    if (bridge?.toggle) {
      bridge.toggle()
    } else {
      inline.toggle()
    }
  }, [inline.toggle])

  const handleToggleShowDiffs = useCallback(() => {
    const bridge = (window as any).__inlineBridge
    if (bridge?.toggleShowDiffs) {
      bridge.toggleShowDiffs()
    } else {
      inline.toggleShowDiffs()
    }
  }, [inline.toggleShowDiffs])
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // Extra sync on mount to catch anything missed during hydration
    setProps(getProps())
  }, [])
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail) {
        const detail = e.detail
        // Handle both old 'dirty' and new 'isDirty' naming
        const normalized = {
          ...detail,
          isDirty: detail.isDirty ?? detail.dirty ?? false
        }
        setInline(normalized as InlineBridge)
      }
    }
    if (typeof window !== 'undefined' && (window as any).__inlineBridge) {
      const bridge = (window as any).__inlineBridge
      setInline({
        ...bridge,
        isDirty: bridge.isDirty ?? bridge.dirty ?? false
      } as InlineBridge)
    }
    window.addEventListener('inline:state', handler as EventListener)
    return () => window.removeEventListener('inline:state', handler as EventListener)
  }, [])

  const isSaveEnabled = inline.isDirty
  const isSaving = inline.isSaving

  const getProps = () => {
    if (typeof window === 'undefined') return initialProps || {}
    // Inertia injects page props here
    const fromInertia =
      ((window as any).Inertia &&
        (window as any).Inertia.page &&
        (window as any).Inertia.page.props) ||
      null
    if (fromInertia) return fromInertia

    // Try to get from router directly if window.Inertia isn't set yet
    if ((router as any)?.page?.props) return (router as any).page.props

    const fromHistory = (window.history && (window.history.state as any)?.page?.props) || null
    return fromHistory || initialProps || {}
  }
  const [props, setProps] = useState<any>(getProps())
  useEffect(() => {
    let mounted = true
    const sync = () => {
      if (!mounted) return
      setProps(getProps())
    }
    // Best-effort: update on history changes and visibility changes
    window.addEventListener('popstate', sync)
    // Listen for Inertia navigations finishing
    document.addEventListener('inertia:finish', sync as EventListener)
    return () => {
      mounted = false
      window.removeEventListener('popstate', sync)
      document.removeEventListener('inertia:finish', sync as EventListener)
    }
  }, [])

  const currentUser = (props as any)?.currentUser
  const post = inline.post || (props as any)?.post
  const translations = inline.translations || (props as any)?.translations || []
  const devToolsData = (props as any)?.devTools

  const isAdmin = !!(currentUser && currentUser.role === 'admin')
  const permissions = (props as any)?.permissions || []
  const isAuthenticated =
    !!currentUser &&
    ['admin', 'editor_admin', 'editor', 'translator'].includes(String(currentUser.role || ''))
  const [open, setOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    selector: string
    xPercent?: number
    yPercent?: number
  } | null>(null)
  const [feedbacks, setFeedbacks] = useState<any[]>([])

  const fetchFeedbacks = useCallback(async () => {
    if (!post?.id) return
    try {
      const mode = inline.mode === 'source' ? 'approved' : inline.mode
      const res = await fetch(`/api/feedbacks?postId=${post.id}&mode=${mode}`, {
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json()
        setFeedbacks(data)
      }
    } catch (error) {
      console.error('Failed to fetch feedbacks', error)
    }
  }, [post?.id, inline.mode])

  useEffect(() => {
    if (isAuthenticated && post?.id) {
      fetchFeedbacks()
    }
    const handler = () => fetchFeedbacks()
    window.addEventListener('feedback:created', handler)
    return () => window.removeEventListener('feedback:created', handler)
  }, [isAuthenticated, fetchFeedbacks, inline.mode, post?.id])

  useEffect(() => {
    if (!isAuthenticated) return

    const handleContextMenu = (e: MouseEvent) => {
      // Don't show if clicking on admin UI elements
      const target = e.target as HTMLElement
      if (target.closest('.z-50') || target.closest('.admin-ui')) return

      e.preventDefault()

      const moduleEl = target.closest('[data-inline-module]') as HTMLElement
      const fieldEl = target.closest('[data-inline-path]') as HTMLElement

      let selector = ''
      let rect: DOMRect | null = null

      if (fieldEl) {
        const moduleId = moduleEl?.dataset.inlineModule
        const path = fieldEl.dataset.inlinePath

        // If the same element has both, don't use a space
        if (fieldEl === moduleEl) {
          selector = `[data-inline-module="${moduleId}"][data-inline-path="${path}"]`
        } else {
          selector = `[data-inline-module="${moduleId}"] [data-inline-path="${path}"]`
        }
        rect = fieldEl.getBoundingClientRect()
      } else if (moduleEl) {
        const moduleId = moduleEl.dataset.inlineModule
        selector = `[data-inline-module="${moduleId}"]`
        rect = moduleEl.getBoundingClientRect()
      } else {
        selector = target.tagName.toLowerCase()
        if (target.id) {
          selector += `#${CSS.escape(target.id)}`
        } else if (target.className && typeof target.className === 'string') {
          const classes = target.className
            .split(/\s+/)
            .filter((c) => c && !c.includes(':') && !c.includes('[') && !c.includes('/'))
            .map((c) => `.${CSS.escape(c)}`)
            .join('')
          selector += classes
        }
        rect = target.getBoundingClientRect()
      }

      const xPercent = rect ? ((e.clientX - rect.left) / rect.width) * 100 : 50
      const yPercent = rect ? ((e.clientY - rect.top) / rect.height) * 100 : 50

      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        selector,
        xPercent,
        yPercent,
      })
    }

    const handleClick = () => setContextMenu(null)

    document.addEventListener('contextmenu', handleContextMenu)
    document.addEventListener('click', handleClick)
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      document.removeEventListener('click', handleClick)
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!mounted) return
    const url = new URL(window.location.href)
    const feedbackId = url.searchParams.get('feedback_id')
    const inlineMode = url.searchParams.get('inline_mode')

    if (feedbackId) {
      setSelectedFeedbackId(feedbackId)
      setFeedbackOpen(true)

      // Clean up URL without reload
      url.searchParams.delete('feedback_id')
      if (inlineMode) url.searchParams.delete('inline_mode')
      window.history.replaceState({}, '', url.toString())
    }

    if (inlineMode && (inlineMode === 'review' || inlineMode === 'ai-review')) {
      inline.setMode(inlineMode)
    }
  }, [mounted, inline.setMode])

  // Auto-scroll to feedback on page when selected via URL or clicking dot
  useEffect(() => {
    if (!selectedFeedbackId || feedbacks.length === 0) return

    const f = feedbacks.find((fb) => fb.id === selectedFeedbackId)
    if (!f) return

    let context = f.context
    if (typeof context === 'string') {
      try {
        context = JSON.parse(context)
      } catch (e) { }
    }

    if (!context?.selector) return

    // Use a small delay and multiple attempts to ensure DOM is ready
    let attempts = 0
    const tryScroll = () => {
      const el = document.querySelector(context.selector)
      if (el) {
        const rect = el.getBoundingClientRect()
        const isInViewport = rect.top >= 0 && rect.bottom <= window.innerHeight

        if (!isInViewport) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }

        el.classList.add('ring-2', 'ring-standout-high', 'ring-offset-2')
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-standout-high', 'ring-offset-2')
        }, 3000)
      } else if (attempts < 5) {
        attempts++
        setTimeout(tryScroll, 200)
      }
    }

    tryScroll()
  }, [selectedFeedbackId, feedbacks])

  if (!mounted) return null

  return (
    <TooltipProvider>
      <ConfirmDialogProvider>
        <FeedbackMarkers
          feedbacks={feedbacks}
          onMarkerClick={(f) => {
            setSelectedFeedbackId(f.id)
            setFeedbackOpen(true)
          }}
          visible={true}
          activeId={selectedFeedbackId}
        />
        {/* Unified bottom bar */}
        <div
          className="fixed z-50 flex items-center gap-2 pointer-events-auto"
          style={{ bottom: '16px', right: '16px' }}
        >
          {/* ... existing content ... */}
          {/* Locale Dropdown */}
          {translations.length > 1 && (
            <Select
              value={post?.id}
              onValueChange={(targetId) => {
                if (targetId === post?.id) return
                const target = translations.find((t: any) => t.id === targetId)
                if (target?.path) {
                  router.visit(target.path)
                }
              }}
            >
              <SelectTrigger
                aria-label="Change language"
                className="h-9 w-20 gap-2 px-2 border-line-medium bg-backdrop-high shadow text-xs font-bold text-neutral-high min-w-[80px]"
              >
                <div className="flex items-center gap-1.5">
                  <FontAwesomeIcon icon={faGlobe} size="xs" className="text-neutral-medium size-3" />
                  <SelectValue placeholder={(post?.locale || 'en').toUpperCase()}>
                    {(post?.locale || 'en').toUpperCase()}
                  </SelectValue>
                </div>
              </SelectTrigger>
              <SelectContent align="end">
                {translations.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.locale.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Variations */}
          {inline.abVariations.length > 1 && (
            <div className="h-9 inline-flex overflow-hidden rounded-md border bg-backdrop-high shadow bg-backdrop-medium/20">
              {inline.abVariations.map((v) => (
                <Tooltip key={v.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`px-3 py-2 text-[10px] font-bold transition-all ${v.id === post?.id
                        ? 'bg-standout-high text-on-high shadow-inner'
                        : 'text-neutral-high hover:bg-backdrop-medium'
                        } ${v.id !== inline.abVariations[inline.abVariations.length - 1].id ? 'border-r border-line-medium' : ''}`}
                      onClick={() => {
                        if (v.id === post?.id) return
                        const url = new URL(window.location.href)
                        url.searchParams.set('variation_id', v.id)
                        router.visit(url.toString())
                      }}
                    >
                      Var {v.variation}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Switch to Variation {v.variation}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="inline-flex overflow-hidden rounded-md border border-line-medium bg-backdrop-high shadow">
              {inline.availableModes?.hasSource && (
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium border-r border-line-medium last:border-r-0 ${inline.mode === 'source' ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'}`}
                  onClick={() => handleSetMode('source')}
                >
                  Source
                </button>
              )}
              {inline.availableModes?.hasReview && (
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium border-r border-line-medium last:border-r-0 ${inline.mode === 'review' ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'}`}
                  onClick={() => handleSetMode('review')}
                >
                  Review
                </button>
              )}
              {inline.availableModes?.hasAiReview && (
                <button
                  type="button"
                  className={`px-3 py-2 text-xs font-medium border-r border-line-medium last:border-r-0 ${inline.mode === 'ai-review' ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'}`}
                  onClick={() => handleSetMode('ai-review')}
                >
                  AI Review
                </button>
              )}
            </div>

            <div className="inline-flex overflow-hidden rounded-md border border-line-medium bg-backdrop-high shadow">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex">
                    <button
                      type="button"
                      className={`px-3 py-2 text-xs font-medium border-r border-line-medium last:border-r-0 ${inline.enabled ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'} ${inline.enabled && isSaveEnabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      onClick={() => {
                        if (inline.enabled && isSaveEnabled) return
                        inline.toggle()
                      }}
                      aria-label={inline.enabled ? 'Disable Inline Editing' : 'Enable Inline Editing'}
                    >
                      <FontAwesomeIcon icon={faPencil} />
                    </button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {inline.enabled && isSaveEnabled
                      ? 'Save changes to disable editing'
                      : inline.enabled
                        ? 'Edits On'
                        : 'Edits Off'}
                  </p>
                </TooltipContent>
              </Tooltip>
              {inline.enabled && (inline.mode === 'review' || inline.mode === 'ai-review') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.showDiffs ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'}`}
                      onClick={() => inline.toggleShowDiffs()}
                      aria-label={`Highlight changes (${inline.mode === 'review' ? 'vs Source' : 'vs Review'})`}
                    >
                      <FontAwesomeIcon icon={faHighlighter} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Highlight changes ({inline.mode === 'review' ? 'vs Source' : 'vs Review'})</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {inline.enabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      aria-label="Outline"
                      onClick={() => setOutlineOpen(true)}
                      className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${outlineOpen ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'}`}
                    >
                      <FontAwesomeIcon icon={faListUl} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Page Outline</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label="Feedback"
                    onClick={() => setFeedbackOpen(true)}
                    className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${feedbackOpen ? 'bg-standout-high text-on-high' : 'text-neutral-high hover:bg-backdrop-medium'}`}
                  >
                    <FontAwesomeIcon icon={faMessage} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Page Feedback</p>
                </TooltipContent>
              </Tooltip>
              <button
                aria-label="Admin tools"
                onClick={() => setOpen((v) => !v)}
                className={`px-3 py-2 text-xs font-medium text-neutral-high hover:bg-backdrop-medium ${permissions.includes('agents.global') ? 'border-r border-line-medium' : ''}`}
              >
                <FontAwesomeIcon icon={faWrench} />
              </button>
              <GlobalAgentButton variant="ghost" permissions={permissions} />
            </div>
          </div>
          {inline.enabled && inline.canEdit && (isSaveEnabled || isSaving) && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSaving}
                className={`px-3 py-2 text-xs font-medium rounded-md border transition-all flex items-center gap-2 bg-standout-high text-on-high border-line-medium shadow-md hover:bg-standout-high/90 ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
                onClick={handleSaveAll}
              >
                {isSaving ? (
                  <>
                    <FontAwesomeIcon icon="spinner" className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
              {inline.mode === 'source' && !inline.availableModes?.hasReview && (
                <button
                  type="button"
                  disabled={isSaving}
                  className={`px-3 py-2 text-xs font-medium rounded-md border transition-all bg-backdrop-high text-neutral-high border-line-medium hover:bg-backdrop-medium shadow-md ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
                  onClick={handleSaveForReview}
                >
                  {isSaving ? 'Saving...' : 'Save for Review'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Panel */}
        {open && (
          <div
            style={{
              position: 'fixed',
              bottom: '72px',
              right: '16px',
              zIndex: 9999,
              minWidth: isAdmin ? '600px' : '280px',
              maxWidth: 'calc(100vw - 32px)',
            }}
            className="rounded-lg border border-line-low bg-backdrop-input text-neutral-high shadow-lg overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-line-low bg-backdrop-high">
              <div className="text-sm font-semibold">Admin</div>
              <button
                aria-label="Close"
                className="text-neutral-medium hover:text-neutral-high p-1"
                onClick={() => setOpen(false)}
              >
                <FontAwesomeIcon icon={faXmark} />
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              <div className="p-3 space-y-3 text-sm border-b border-line-low">
                <div className="flex items-center justify-between">
                  <span>Go to Dashboard</span>
                  <a
                    href={adminPath()}
                    className="inline-flex items-center px-4 py-2 rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                  >
                    Open
                  </a>
                </div>
                {post?.id && (
                  <div className="flex items-center justify-between">
                    <span>Edit this page</span>
                    <a
                      href={adminPath(`posts/${post.id}/edit`)}
                      className="inline-flex items-center px-4 py-2 rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                    >
                      Edit
                    </a>
                  </div>
                )}
              </div>

              {isAdmin && devToolsData && (
                <div className="bg-backdrop-high">
                  <DevTools data={devToolsData} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu && (
          <div
            className="fixed z-[100] bg-backdrop-high border border-line-medium shadow-xl rounded-lg overflow-hidden py-1 min-w-[160px]"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              onClick={() => {
                setFeedbackOpen(true)
                // Don't clear contextMenu here, clear it when the dialog closes
              }}
              className="w-full text-left px-4 py-2 text-[11px] font-bold hover:bg-backdrop-medium text-neutral-high flex items-center gap-2 uppercase tracking-wider"
            >
              <FontAwesomeIcon icon={faMessage} className="text-standout-high" />
              Add Feedback here
            </button>
          </div>
        )}

        {/* Feedback Sidebar/Panel */}
        <Sheet
          open={feedbackOpen}
          onOpenChange={(v) => {
            setFeedbackOpen(v)
            if (!v) {
              setContextMenu(null)
              setSelectedFeedbackId(null)
              fetchFeedbacks()
            }
          }}
          modal={false}
        >
          <SheetContent
            hideOverlay
            side="right"
            className="sm:max-w-[425px] h-full p-0 overflow-hidden flex flex-col border-l border-line-low shadow-2xl bg-backdrop-high/95 backdrop-blur-md pointer-events-auto"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Feedback</SheetTitle>
              <SheetDescription>View and manage page feedback</SheetDescription>
            </SheetHeader>
            <FeedbackPanel
              postId={post?.id}
              mode={inline.mode === 'source' ? 'approved' : inline.mode}
              initialContext={
                contextMenu
                  ? {
                    selector: contextMenu.selector,
                    xPercent: contextMenu.xPercent,
                    yPercent: contextMenu.yPercent,
                  }
                  : null
              }
              highlightId={selectedFeedbackId}
              onSelect={(id) => setSelectedFeedbackId(id)}
              onClose={() => {
                setFeedbackOpen(false)
                setContextMenu(null)
                setSelectedFeedbackId(null)
              }}
              onJumpToSpot={(ctx, fbId) => {
                let targetCtx = ctx
                if (typeof targetCtx === 'string') {
                  try {
                    targetCtx = JSON.parse(targetCtx)
                  } catch (e) { }
                }
                if (targetCtx.selector) {
                  const el = document.querySelector(targetCtx.selector)
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    el.classList.add('ring-2', 'ring-standout-high', 'ring-offset-2')
                    setTimeout(() => {
                      el.classList.remove('ring-2', 'ring-standout-high', 'ring-offset-2')
                    }, 3000)
                  }
                }
                if (fbId) setSelectedFeedbackId(fbId)
                // Don't close the sheet when jumping to spot, so the user can still see other feedback
              }}
            />
          </SheetContent>
        </Sheet>

        {/* Outline Sidebar/Panel */}
        <Sheet
          open={outlineOpen}
          onOpenChange={(v) => setOutlineOpen(v)}
          modal={false}
        >
          <SheetContent
            hideOverlay
            side="right"
            className="sm:max-w-[425px] h-full p-0 overflow-hidden flex flex-col border-l border-line-low shadow-2xl bg-backdrop-high/95 backdrop-blur-md pointer-events-auto"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Page Outline</SheetTitle>
              <SheetDescription>View and reorder page modules</SheetDescription>
            </SheetHeader>
            <ModuleOutlinePanel
              modules={inline.modules}
              getValue={inline.getValue}
              postType={post?.type}
              postId={post?.id}
              onReorder={(newModules) => inline.reorderModules(newModules)}
              onAddModule={(payload) => inline.addModule(payload)}
              onRemoveModule={(id) => inline.removeModule(id)}
              onUpdateLabel={(id, label) => inline.updateModuleLabel(id, label)}
              onDuplicateModule={(id) => inline.duplicateModule(id)}
              onClose={() => setOutlineOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </ConfirmDialogProvider>
    </TooltipProvider>
  )
}
