import { Input } from '~/components/ui/input'

type Props = {
  value: string | null
  onChange: (val: string | null) => void
  placeholder?: string
}

export default function UrlField({ value, onChange, placeholder }: Props) {
  return (
    <Input
      type="url"
      value={value ?? ''}
      placeholder={placeholder || 'https://'}
      onChange={(e) => onChange(e.target.value || null)}
    />
  )
}
