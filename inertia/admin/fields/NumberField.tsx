import { Input } from '~/components/ui/input'

type Props = {
  value: number | null
  onChange: (val: number | null) => void
  min?: number
  max?: number
  step?: number
}

export default function NumberField({ value, onChange, min, max, step }: Props) {
  return (
    <Input
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = e.target.value
        onChange(v === '' ? null : Number(v))
      }}
    />
  )
}
