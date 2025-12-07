type Option = { label: string; value: string }

type Props = {
  value: string | string[] | null
  onChange: (val: string | string[] | null) => void
  options: Option[]
  multiple?: boolean
}

export default function SelectField({ value, onChange, options, multiple }: Props) {
  const selected = Array.isArray(value) ? value : value ? [value] : []

  return (
    <select
      multiple={!!multiple}
      className="block w-full border border-line-low rounded bg-backdrop-low px-3 py-2 text-sm text-neutral-high"
      value={selected}
      onChange={(e) => {
        if (multiple) {
          const vals = Array.from(e.target.selectedOptions).map((o) => o.value)
          onChange(vals)
        } else {
          const val = e.target.value
          onChange(val || null)
        }
      }}
    >
      {!multiple && <option value="">— Select —</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
