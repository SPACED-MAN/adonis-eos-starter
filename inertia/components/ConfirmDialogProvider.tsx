import React, { createContext, useContext, useState, useCallback, ReactNode, lazy, Suspense } from 'react'
import type { ConfirmOptions } from './ConfirmDialog'

const ConfirmDialog = lazy(() => import('./ConfirmDialog'))

type ConfirmContextType = {
  confirm: (options: ConfirmOptions) => Promise<boolean>
  alert: (options: Omit<ConfirmOptions, 'cancelText' | 'hideCancel'>) => Promise<void>
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined)

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const [resolveRef, setResolveRef] = useState<{ resolve: (value: boolean) => void } | null>(null)

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setOptions(opts)
      setResolveRef({ resolve })
      setOpen(true)
    })
  }, [])

  const alert = useCallback((opts: Omit<ConfirmOptions, 'cancelText' | 'hideCancel'>) => {
    return new Promise<void>((resolve) => {
      setOptions({ ...opts, hideCancel: true })
      setResolveRef({ resolve: () => resolve() })
      setOpen(true)
    })
  }, [])

  const handleCancel = useCallback(() => {
    setOpen(false)
    resolveRef?.resolve(false)
    setResolveRef(null)
  }, [resolveRef])

  const handleConfirm = useCallback(() => {
    setOpen(false)
    resolveRef?.resolve(true)
    setResolveRef(null)
  }, [resolveRef])

  return (
    <>
      <ConfirmContext.Provider value={{ confirm, alert }}>
        {children}
      </ConfirmContext.Provider>

      {options && (
        <Suspense fallback={null}>
          <ConfirmDialog
            open={open}
            onOpenChange={setOpen}
            options={options}
            onCancel={handleCancel}
            onConfirm={handleConfirm}
          />
        </Suspense>
      )}
    </>
  )
}

export function useConfirm() {
  const context = useContext(ConfirmContext)
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmDialogProvider')
  }
  return context
}
