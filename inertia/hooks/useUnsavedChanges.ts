import { useEffect } from 'react'
import { router } from '@inertiajs/react'
import { useConfirm } from '../components/ConfirmDialogProvider'

/**
 * Global flag to skip the dirty check when we manually re-trigger a visit
 * after user confirmation.
 */
let isBypassingGuard = false

/**
 * Manually bypass the unsaved changes guard for the next navigation/reload.
 */
export function bypassUnsavedChanges(bypass: boolean = true) {
  isBypassingGuard = bypass
}

/**
 * Hook to prevent navigation/refresh when there are unsaved changes.
 * @param isDirty Whether there are unsaved changes
 */
export function useUnsavedChanges(isDirty: boolean) {
  const { confirm } = useConfirm()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isBypassingGuard) {
        e.preventDefault()
        e.returnValue = ''
      }
    }

    const stopInertiaListener = router.on('before', async (event) => {
      if (isDirty && !isBypassingGuard) {
        // Prevent immediate navigation
        event.preventDefault()

        const confirmed = await confirm({
          title: 'Unsaved Changes',
          description: 'You have unsaved changes. Are you sure you want to leave?',
          confirmText: 'Leave Page',
          cancelText: 'Stay',
          variant: 'destructive',
        })

        if (confirmed) {
          isBypassingGuard = true
          // Re-trigger the original visit
          router.visit(event.detail.visit.url, event.detail.visit)
          // Reset bypass flag after a short delay or after the visit finishes
          // Usually, the page will unmount, but if it's a persistent layout, we need to reset.
          setTimeout(() => {
            isBypassingGuard = false
          }, 100)
        }
      }
    })

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      stopInertiaListener()
    }
  }, [isDirty, confirm])
}


