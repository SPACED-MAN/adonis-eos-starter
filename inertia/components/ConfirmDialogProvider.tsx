import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog'

type ConfirmOptions = {
  title: string
  description: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  hideCancel?: boolean
}

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
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{options.title}</AlertDialogTitle>
              <AlertDialogDescription>{options.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              {!options.hideCancel && (
                <AlertDialogCancel onClick={handleCancel}>
                  {options.cancelText || 'Cancel'}
                </AlertDialogCancel>
              )}
              <AlertDialogAction
                onClick={handleConfirm}
                className={options.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
              >
                {options.confirmText || 'Continue'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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


