import React from 'react'
import { Textarea } from '~/components/ui/textarea'

type Props = {
  value: string | null
  onChange: (val: string | null) => void
  placeholder?: string
  maxLength?: number
} & Omit<React.ComponentProps<typeof Textarea>, 'value' | 'onChange' | 'placeholder' | 'maxLength'>

export default function TextareaField({ value, onChange, placeholder, maxLength, ...rest }: Props) {
  return (
    <Textarea
      value={value ?? ''}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value || null)}
      rows={4}
      {...rest}
    />
  )
}
