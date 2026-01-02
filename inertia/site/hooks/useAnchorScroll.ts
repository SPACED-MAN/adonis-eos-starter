import { useEffect } from 'react'

/**
 * Hook to handle anchor link clicks.
 * Custom animation removed to troubleshoot "short jump" issues.
 * Native browser behavior is now used.
 */
export function useAnchorScroll() {
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest('a')

      if (!link) return

      const href = link.getAttribute('href')
      if (!href || !href.startsWith('#')) return

      // Extract module ID if present
      const moduleId = link.getAttribute('data-module-id')
      let element: HTMLElement | null = null

      if (moduleId) {
        element = document.querySelector(`[data-module-id="${moduleId}"]`)
      }

      if (!element) {
        const id = href.substring(1)
        if (id) element = document.getElementById(id)
      }

      if (element) {
        e.preventDefault()
        
        const targetHash = `#${element.id}`
        
        // Update URL hash. 
        // Using window.location.hash triggers the browser's native scroll-to-anchor logic.
        // This is much more stable than manual JS scrolling and correctly respects 
        // the `scroll-behavior: smooth` and `scroll-margin-top` we defined in CSS.
        if (window.location.hash !== targetHash) {
          window.location.hash = element.id
        } else {
          // If we're already on that hash, setting it again won't trigger a scroll.
          // In this case, we fall back to scrollIntoView.
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          })
        }
      }
    }

    document.addEventListener('click', handleAnchorClick)
    return () => document.removeEventListener('click', handleAnchorClick)
  }, [])
}
