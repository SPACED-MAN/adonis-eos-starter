import React from 'react'
import { Input } from '../../components/ui/input'

type Props = {
  value: string | null
  onChange: (val: string | null) => void
  placeholder?: string
  maxLength?: number
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'placeholder' | 'maxLength'>

export default function TextField({ value, onChange, placeholder, maxLength, ...rest }: Props) {
  return (
    <Input
      value={value ?? ''}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value || null)}
      {...rest}
    />
  )
}
