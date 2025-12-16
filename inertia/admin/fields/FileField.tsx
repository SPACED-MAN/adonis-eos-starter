import { Input } from '~/components/ui/input'

type FileValue =
  | string
  | null
  | {
      id?: string
      url?: string
      name?: string
      [key: string]: any
    }

type Props = {
  value: FileValue
  onChange: (val: FileValue) => void
  accept?: string
}

export default function FileField({ value, onChange, accept }: Props) {
  return (
    <div className="space-y-2">
      <Input
        type="text"
        placeholder="File ID or URL"
        value={
          typeof value === 'string'
            ? value
            : value && typeof value === 'object' && value.url
              ? String(value.url)
              : ''
        }
        onChange={(e) => onChange(e.target.value || null)}
      />
      <Input
        type="file"
        accept={accept}
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          onChange({ name: file.name })
        }}
      />
    </div>
  )
}
