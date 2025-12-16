import { Checkbox } from '~/components/ui/checkbox'

type Props = {
  value: boolean | null
  onChange: (val: boolean | null) => void
  labelOn?: string
  labelOff?: string
}

export default function BooleanField({ value, onChange, labelOn, labelOff }: Props) {
  const checked = !!value
  return (
    <label className="inline-flex items-center gap-2 text-sm text-neutral-high">
      <Checkbox checked={checked} onCheckedChange={(c) => onChange(Boolean(c))} />
      <span>{checked ? labelOn || 'On' : labelOff || 'Off'}</span>
    </label>
  )
}
