import { router } from '@inertiajs/react'

let currentPostId: string | null = null
let isAuthenticated = false
let isEnabled = true
let clickBuffer: any[] = []
let flushTimer: any = null

/**
 * Lightweight analytics tracker for the public site.
 * Uses Inertia events to track page views and document-level listeners for clicks.
 */
export function initAnalytics() {
  if (typeof window === 'undefined') return

  // Peek at initial state if available in window.__inertiaProps or similar
  // but Inertia usually provides this via router events.
  // For the very first load, we can try to get it from the DOM.
  try {
    const el = document.getElementById('app')
    if (el && el.dataset.page) {
      const page = JSON.parse(el.dataset.page)
      updateState(page)
    }
  } catch {
    // ignore
  }

  // 1. Listen for page changes (including initial load if not already handled)
  router.on('success', (event) => {
    const page = event.detail.page
    updateState(page)
    
    if (isEnabled && !isAuthenticated) {
      track({
        eventType: 'view',
        postId: currentPostId,
        viewportWidth: window.innerWidth,
        metadata: { path: window.location.pathname }
      })
    }
  })

  // 2. Initial state from current page if already loaded
  // Note: Inertia might have already set the state, or we get it from the first 'success' event.
  // We can also try to peek at the initial window state if needed.

  // 3. Click tracking
  document.addEventListener('click', (e) => {
    if (!isEnabled || isAuthenticated) return
    
    // Don't track if clicking on Admin UI elements
    const target = e.target as HTMLElement
    if (target.closest('.site-admin-bar') || target.closest('[data-admin-ui]')) {
      return
    }

    clickBuffer.push({
      eventType: 'click',
      postId: currentPostId,
      x: e.pageX,
      y: e.pageY,
      viewportWidth: window.innerWidth,
      metadata: {
        selector: getSelector(target),
        path: window.location.pathname
      }
    })

    if (clickBuffer.length >= 5) {
      flush()
    }
  })

  // 4. Lifecycle hooks
  window.addEventListener('beforeunload', () => flush())
  
  // Periodic flush
  if (!flushTimer) {
    flushTimer = setInterval(() => {
      if (isEnabled) flush()
    }, 10000)
  }
}

function updateState(page: any) {
  currentPostId = page.props?.post?.id || null
  const currentUser = page.props?.currentUser
  isAuthenticated = !!currentUser && ['admin', 'editor', 'translator'].includes(String(currentUser.role || ''))
  isEnabled = page.props?.features?.analytics !== false
}

function flush() {
  if (clickBuffer.length === 0) return
  const payload = [...clickBuffer]
  clickBuffer = []
  
  if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
    navigator.sendBeacon('/api/public/analytics/track', blob)
  } else {
    fetch('/api/public/analytics/track', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
      keepalive: true
    }).catch(() => {})
  }
}

function track(event: any) {
  fetch('/api/public/analytics/track', {
    method: 'POST',
    body: JSON.stringify(event),
    headers: { 'Content-Type': 'application/json' },
    keepalive: true
  }).catch(() => {})
}

function getSelector(el: HTMLElement): string {
  if (!el) return ''
  if (el.id) return `#${el.id}`
  try {
    if (el.className && typeof el.className === 'string') {
      const cls = el.className.split(' ').filter(Boolean).slice(0, 2).join('.')
      if (cls) return `${el.tagName.toLowerCase()}.${cls}`
    }
  } catch {
    // ignore
  }
  return el.tagName.toLowerCase()
}

