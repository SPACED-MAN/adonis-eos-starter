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
    <div className="space-y-2">
      {multiple && selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val)
            const text = opt?.label || val
            return (
              <button
                key={val}
                type="button"
                className="inline-flex items-center gap-1 rounded-full bg-backdrop-low border border-border px-3 py-1 text-sm text-neutral-high hover:bg-backdrop-medium"
                onClick={() =>
                  onChange(selected.filter((v) => v !== val))
                }
              >
                <span>{text}</span>
                <span className="text-neutral-low">✕</span>
              </button>
            )
          })}
        </div>
      )}

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
    </div>
  )
}
