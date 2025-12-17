import React from 'react'
import { Input } from '~/components/ui/input'

type Props = {
  value: string | null
  onChange: (val: string | null) => void
  placeholder?: string
} & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'placeholder'>

export default function UrlField({ value, onChange, placeholder, ...rest }: Props) {
  return (
    <Input
      type="url"
      value={value ?? ''}
      placeholder={placeholder || 'https://'}
      onChange={(e) => onChange(e.target.value || null)}
      {...rest}
    />
  )
}
