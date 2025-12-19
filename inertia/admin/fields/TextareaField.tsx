import React from 'react'
import { TokenField } from '../components/ui/TokenField'

type Props = {
  value: string | null
  onChange: (val: string | null) => void
  placeholder?: string
  maxLength?: number
  customFields?: Array<{ slug: string; label: string }>
} & Omit<React.ComponentProps<typeof TokenField>, 'value' | 'onChange' | 'placeholder' | 'maxLength'>

export default function TextareaField({ value, onChange, placeholder, maxLength, customFields, ...rest }: Props) {
  return (
    <TokenField
      type="textarea"
      value={value ?? ''}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(val) => onChange(val || null)}
      customFields={customFields}
      rows={4}
      {...rest}
    />
  )
}
