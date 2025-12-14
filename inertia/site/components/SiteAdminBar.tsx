import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWrench, faToggleOn, faToggleOff, faXmark } from '@fortawesome/free-solid-svg-icons'
import { router } from '@inertiajs/react'
type InlineBridge = {
  enabled: boolean
  canEdit: boolean
  mode: 'source' | 'review' | 'ai-review'
  toggle: () => void
  setMode: (m: 'source' | 'review' | 'ai-review') => void
  dirty: boolean
  saveAll: () => Promise<void>
}

export function SiteAdminBar() {
  const [inline, setInline] = useState<InlineBridge>({
    enabled: false,
    canEdit: false,
    mode: 'source',
    toggle: () => { },
    setMode: () => { },
    dirty: false,
    saveAll: async () => { },
  })
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  useEffect(() => {
    const handler = (e: any) => {
      if (e?.detail) setInline(e.detail as InlineBridge)
    }
    if (typeof window !== 'undefined' && (window as any).__inlineBridge) {
      setInline((window as any).__inlineBridge as InlineBridge)
    }
    window.addEventListener('inline:state', handler as EventListener)
    return () => window.removeEventListener('inline:state', handler as EventListener)
  }, [])

  const getProps = () => {
    if (typeof window === 'undefined') return {}
    // Inertia injects page props here
    const fromInertia =
      ((window as any).Inertia && (window as any).Inertia.page && (window as any).Inertia.page.props) || null
    if (fromInertia) return fromInertia
    const fromHistory = (window.history && (window.history.state as any)?.page?.props) || null
    return fromHistory || {}
  }
  const [props, setProps] = useState<any>(getProps())
  // Track URL search reactively so viewMode updates on Inertia navigations
  const [search, setSearch] = useState<string>(() => (typeof window !== 'undefined' ? window.location.search : ''))
  useEffect(() => {
    let mounted = true
    const sync = () => {
      if (!mounted) return
      setProps(getProps())
      if (typeof window !== 'undefined') {
        setSearch(window.location.search)
      }
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
  const isAuthenticated =
    !!currentUser && ['admin', 'editor', 'translator'].includes(String(currentUser.role || ''))
  const [open, setOpen] = useState(false)

  // Determine if this page has a review draft available (post prop provided by server on site pages)
  const post = (props as any)?.post
  const hasReview = Boolean(
    (props as any)?.hasReviewDraft ||
    (post && ((post as any).hasReviewDraft || (post as any).reviewDraft))
  )

  // Determine current view mode from URL
  const viewMode: 'source' | 'review' = useMemo(() => {
    if (typeof window === 'undefined') return 'source'
    const url = new URL(window.location.origin + window.location.pathname + (search || ''))
    const v = url.searchParams.get('view')
    return v === 'review' ? 'review' : 'source'
  }, [search])

  if (!isAuthenticated) return null

  function toggleView() {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (viewMode === 'review') {
      url.searchParams.delete('view')
    } else {
      url.searchParams.set('view', 'review')
    }
    // Optimistically update local state so the button reflects the change immediately
    setSearch(url.search)
    router.visit(url.toString(), { replace: true, preserveScroll: true, preserveState: true })
  }

  return !mounted ? null : (
    <>
      {/* Review toggle button (only when review draft exists) */}
      {hasReview && (
        <button
          aria-label="Toggle review preview"
          onClick={toggleView}
          style={{ position: 'fixed', bottom: '16px', right: '72px', zIndex: 9999 }}
          className={`rounded-full border px-3 py-3 shadow ${viewMode === 'review'
            ? 'bg-standout text-on-standout border-standout/60'
            : 'bg-backdrop-low text-neutral-high border-line-low hover:bg-backdrop-medium'
            }`}
          title={viewMode === 'review' ? 'Viewing Review (click to switch to Source)' : 'Viewing Source (click to switch to Review)'}
        >
          <FontAwesomeIcon icon={viewMode === 'review' ? faToggleOn : faToggleOff} />
        </button>
      )}
      {/* Unified bottom bar */}
      <div
        className="fixed z-50 flex items-center gap-2 pointer-events-auto"
        style={{ bottom: '16px', right: '16px' }}
      >
        <div className="inline-flex overflow-hidden rounded-md border border-line-medium bg-backdrop-high shadow">
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.mode === 'source' ? 'bg-standout text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
            onClick={() => inline.setMode('source')}
          >
            Source
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.mode === 'review' ? 'bg-standout text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
            onClick={() => inline.setMode('review')}
          >
            Review
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.mode === 'ai-review' ? 'bg-standout text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
            onClick={() => inline.setMode('ai-review')}
          >
            AI Review
          </button>
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.enabled ? 'bg-standout text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
            onClick={inline.toggle}
          >
            {inline.enabled ? 'Edits On' : 'Edits Off'}
          </button>
          <button
            aria-label="Admin tools"
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-2 text-xs font-medium text-neutral-high hover:bg-backdrop-medium"
          >
            <FontAwesomeIcon icon={faWrench} />
          </button>
        </div>
        {inline.dirty && inline.canEdit && (
          <button
            type="button"
            className="px-3 py-2 text-xs font-medium rounded-md border border-line-medium bg-standout text-on-standout"
            onClick={inline.saveAll}
          >
            Save
          </button>
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
            minWidth: '280px',
          }}
          className="rounded-lg border border-line-low bg-backdrop-input text-neutral-high shadow-lg"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-line-low">
            <div className="text-sm font-semibold">Admin</div>
            <button
              aria-label="Close"
              className="text-neutral-medium hover:text-neutral-high"
              onClick={() => setOpen(false)}
            >
              <FontAwesomeIcon icon={faXmark} />
            </button>
          </div>
          <div className="p-3 space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span>Go to Dashboard</span>
              <a
                href="/admin"
                className="px-2 py-1 rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
              >
                Open
              </a>
            </div>
            {post?.id && (
              <div className="flex items-center justify-between">
                <span>Edit this page</span>
                <a
                  href={`/admin/posts/${post.id}/edit`}
                  className="px-2 py-1 rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium"
                >
                  Edit
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}


