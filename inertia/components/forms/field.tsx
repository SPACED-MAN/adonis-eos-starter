import * as React from 'react'
import { cn } from '~/components/ui/utils'

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {}
export const FormField = ({ className, ...props }: FormFieldProps) => {
  return <div className={cn('space-y-1', className)} {...props} />
}

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
export const FormLabel = React.forwardRef<HTMLLabelElement, FormLabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'block text-[11px] font-bold text-neutral-medium uppercase tracking-wider mt-2 mb-1.5 ml-1',
          className
        )}
        {...props}
      />
    )
  }
)
FormLabel.displayName = 'FormLabel'

export interface FormControlProps extends React.HTMLAttributes<HTMLDivElement> {}
export const FormControl = ({ className, ...props }: FormControlProps) => {
  return <div className={cn('', className)} {...props} />
}

export interface FormHelperProps extends React.HTMLAttributes<HTMLParagraphElement> {}
export const FormHelper = React.forwardRef<HTMLParagraphElement, FormHelperProps>(
  ({ className, ...props }, ref) => {
    return <p ref={ref} className={cn('text-xs text-neutral-low', className)} {...props} />
  }
)
FormHelper.displayName = 'FormHelper'
