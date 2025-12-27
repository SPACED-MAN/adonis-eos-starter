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
  storeAs?: 'id' | 'url' | 'object'
}

export default function MediaField({ value, onChange, storeAs = 'object' }: Props) {
  const [open, setOpen] = useState(false)

  // Resolve current ID for the thumb/picker
  const mediaId = useMemo(() => {
    if (!value) return null
    if (typeof value === 'string') {
      // If it looks like a UUID, use it. Otherwise it might be a URL.
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      return uuidRegex.test(value) ? value : null
    }
    return value.id || null
  }, [value])

  return (
    <div>
      <MediaThumb
        mediaId={mediaId}
        onChange={() => setOpen(true)}
        onClear={() => onChange(null)}
        fallbackUrl={typeof value === 'string' && !mediaId ? value : undefined}
      />
      <MediaPickerModal
        open={open}
        onOpenChange={setOpen}
        initialSelectedId={mediaId || undefined}
        onSelect={(m) => {
          if (storeAs === 'id') {
            onChange(m.id)
          } else if (storeAs === 'url') {
            onChange(m.url)
          } else {
            onChange({ id: m.id, url: m.url })
          }
          setOpen(false)
        }}
      />
    </div>
  )
}

import { useMemo } from 'react'
