import { useEffect, useMemo, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faWrench, faXmark, faHighlighter } from '@fortawesome/free-solid-svg-icons'
import { router } from '@inertiajs/react'
type InlineBridge = {
  enabled: boolean
  canEdit: boolean
  mode: 'source' | 'review' | 'ai-review'
  toggle: () => void
  setMode: (m: 'source' | 'review' | 'ai-review') => void
  dirty: boolean
  saveAll: () => Promise<void>
  saveForReview: () => Promise<void>
  availableModes: { hasSource: boolean; hasReview: boolean; hasAiReview: boolean }
  showDiffs: boolean
  toggleShowDiffs: () => void
}

export function SiteAdminBar({ initialProps }: { initialProps?: any }) {
  const [inline, setInline] = useState<InlineBridge>({
    enabled: false,
    canEdit: false,
    mode: 'source',
    toggle: () => { },
    setMode: () => { },
    dirty: false,
    saveAll: async () => { },
    saveForReview: async () => { },
    availableModes: { hasSource: true, hasReview: false, hasAiReview: false },
    showDiffs: false,
    toggleShowDiffs: () => { },
  })
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // Extra sync on mount to catch anything missed during hydration
    setProps(getProps())
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
    if (typeof window === 'undefined') return initialProps || {}
    // Inertia injects page props here
    const fromInertia =
      ((window as any).Inertia &&
        (window as any).Inertia.page &&
        (window as any).Inertia.page.props) ||
      null
    if (fromInertia) return fromInertia

    // Try to get from router directly if window.Inertia isn't set yet
    if (router?.page?.props) return router.page.props

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
  const post = (props as any)?.post
  const isAuthenticated =
    !!currentUser && ['admin', 'editor', 'translator'].includes(String(currentUser.role || ''))
  const [open, setOpen] = useState(false)

  if (!isAuthenticated) return null

  return !mounted ? null : (
    <>
      {/* Unified bottom bar */}
      <div
        className="fixed z-50 flex items-center gap-2 pointer-events-auto"
        style={{ bottom: '16px', right: '16px' }}
      >
        <div className="inline-flex overflow-hidden rounded-md border border-line-medium bg-backdrop-high shadow">
          {inline.availableModes.hasSource && (
            <button
              type="button"
              className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.mode === 'source' ? 'bg-standout-medium text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
              onClick={() => inline.setMode('source')}
            >
              Source
            </button>
          )}
          {inline.availableModes.hasReview && (
            <button
              type="button"
              className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.mode === 'review' ? 'bg-standout-medium text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
              onClick={() => inline.setMode('review')}
            >
              Review
            </button>
          )}
          {inline.availableModes.hasAiReview && (
            <button
              type="button"
              className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.mode === 'ai-review' ? 'bg-standout-medium text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
              onClick={() => inline.setMode('ai-review')}
            >
              AI Review
            </button>
          )}
          <button
            type="button"
            className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.enabled ? 'bg-standout-medium text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
            onClick={inline.toggle}
          >
            {inline.enabled ? 'Edits On' : 'Edits Off'}
          </button>
          {inline.enabled && (inline.mode === 'review' || inline.mode === 'ai-review') && (
            <button
              type="button"
              className={`px-3 py-2 text-xs font-medium border-r border-line-medium ${inline.showDiffs ? 'bg-standout-medium text-on-standout' : 'text-neutral-high hover:bg-backdrop-medium'}`}
              onClick={() => inline.toggleShowDiffs()}
              title={`Highlight changes (${inline.mode === 'review' ? 'vs Source' : 'vs Review'})`}
              aria-label={`Highlight changes (${inline.mode === 'review' ? 'vs Source' : 'vs Review'})`}
            >
              <FontAwesomeIcon icon={faHighlighter} />
            </button>
          )}
          <button
            aria-label="Admin tools"
            onClick={() => setOpen((v) => !v)}
            className="px-3 py-2 text-xs font-medium text-neutral-high hover:bg-backdrop-medium"
          >
            <FontAwesomeIcon icon={faWrench} />
          </button>
        </div>
        {inline.dirty && inline.canEdit && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-3 py-2 text-xs font-medium rounded-md border border-line-medium bg-standout-medium text-on-standout"
              onClick={() => inline.saveAll()}
            >
              Save
            </button>
            {inline.mode === 'source' && !inline.availableModes.hasReview && (
              <button
                type="button"
                className="px-3 py-2 text-xs font-medium rounded-md border border-line-medium bg-backdrop-high text-neutral-high hover:bg-backdrop-medium"
                onClick={() => inline.saveForReview()}
              >
                Save for Review
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
                className="inline-flex items-center px-4 py-3 rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium min-h-[48px]"
              >
                Open
              </a>
            </div>
            {post?.id && (
              <div className="flex items-center justify-between">
                <span>Edit this page</span>
                <a
                  href={`/admin/posts/${post.id}/edit`}
                  className="inline-flex items-center px-4 py-3 rounded border border-line-low hover:bg-backdrop-medium text-neutral-medium min-h-[48px]"
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
