import React, { ReactNode } from 'react'
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

export type ConfirmOptions = {
  title: string
  description: ReactNode
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  hideCancel?: boolean
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: ConfirmOptions
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  options,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{options.title}</AlertDialogTitle>
          <AlertDialogDescription>{options.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {!options.hideCancel && (
            <AlertDialogCancel onClick={onCancel}>
              {options.cancelText || 'Cancel'}
            </AlertDialogCancel>
          )}
          <AlertDialogAction
            onClick={onConfirm}
            className={options.variant === 'destructive' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
          >
            {options.confirmText || 'Continue'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

