import { Input } from '../../components/ui/input'

type Props = {
  value: string | null
  onChange: (val: string | null) => void
  placeholder?: string
  maxLength?: number
}

export default function TextField({ value, onChange, placeholder, maxLength }: Props) {
  return (
    <Input
      value={value ?? ''}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value || null)}
    />
  )
}

