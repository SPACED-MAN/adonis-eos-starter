import React, { useRef, useCallback } from 'react'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { TokenPicker } from './TokenPicker'

interface TokenFieldProps {
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'textarea'
  placeholder?: string
  name?: string
  className?: string
  customFields?: Array<{ slug: string; label: string }>
  [key: string]: any
}

export function TokenField({
  value,
  onChange,
  type = 'text',
  placeholder,
  name,
  className = '',
  customFields,
  ...props
}: TokenFieldProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  const handleTokenSelect = useCallback(
    (tokenName: string) => {
      const el = inputRef.current
      if (!el) {
        onChange(`${value}{${tokenName}}`)
        return
      }

      const start = el.selectionStart || 0
      const end = el.selectionEnd || 0
      const token = `{${tokenName}}`
      const newValue = value.substring(0, start) + token + value.substring(end)

      onChange(newValue)

      // Set cursor after the inserted token
      setTimeout(() => {
        el.focus()
        const newPos = start + token.length
        el.setSelectionRange(newPos, newPos)
      }, 0)
    },
    [value, onChange]
  )

  const Component = type === 'textarea' ? Textarea : Input

  return (
    <div className="relative group/token-field">
      <Component
        {...props}
        ref={inputRef as any}
        name={name}
        value={value}
        placeholder={placeholder}
        className={`${className} pr-10`}
        onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
      />
      <div className="absolute right-1 top-1 flex items-center h-8">
        <TokenPicker onSelect={handleTokenSelect} customFields={customFields} />
      </div>
    </div>
  )
}

export default TokenField
