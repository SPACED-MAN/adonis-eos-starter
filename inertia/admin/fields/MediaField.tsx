import { useState } from 'react'
import { MediaPickerModal } from '../components/media/MediaPickerModal'
import { MediaThumb } from '../components/media/MediaThumb'

type MediaValue =
  | string
  | null
  | {
      id?: string
      url?: string
      [key: string]: any
    }

type Props = {
  value: MediaValue
  onChange: (val: MediaValue) => void
}

export default function MediaField({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const mediaId =
    typeof value === 'string'
      ? value || null
      : value && typeof value === 'object'
        ? (value.id as string) || null
        : null

  return (
    <div>
      <MediaThumb mediaId={mediaId} onChange={() => setOpen(true)} onClear={() => onChange(null)} />
      <MediaPickerModal
        open={open}
        onOpenChange={setOpen}
        initialSelectedId={mediaId || undefined}
        onSelect={(m) => {
          onChange({ id: m.id, url: m.url })
          setOpen(false)
        }}
      />
    </div>
  )
}
