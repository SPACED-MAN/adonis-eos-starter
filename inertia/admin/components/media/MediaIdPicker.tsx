import { useEffect, useState } from 'react'
import { MediaPickerModal } from './MediaPickerModal'
import { MediaRenderer } from '../../../components/MediaRenderer'

export function MediaIdPicker({
  label,
  value,
  onChange,
}: {
  label: string
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [previewAlt, setPreviewAlt] = useState<string>('')
  const [mediaData, setMediaData] = useState<any | null>(null)
  const id = value || ''

  // Fetch media data when id changes
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        if (!id) {
          if (alive) {
            setMediaData(null)
            setPreviewAlt('')
          }
          return
        }
        const res = await fetch(`/api/media/${encodeURIComponent(id)}`, {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        const data = j?.data
        if (alive) {
          setMediaData(data || null)
          setPreviewAlt(data?.altText || data?.originalFilename || '')
        }
      } catch {
        if (alive) {
          setMediaData(null)
          setPreviewAlt('')
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div>
      <label className="block text-sm font-medium text-neutral-medium mb-1">{label}</label>
      <div className="flex items-start gap-3">
        <div className="min-w-[72px]">
          {mediaData ? (
            <div className="w-[72px] h-[72px] border border-line-medium rounded overflow-hidden bg-backdrop-low dark:bg-backdrop-medium relative flex items-center justify-center">
              {/* Subtle checkerboard for transparency awareness */}
              <div
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
                style={{
                  backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uAnRowBoEMBAQQWBgZAiM0E0DAAwiAsQD8LYYByDMc8EBIAVScG6S+69Z0AAAAASUVORK5CYII=")`,
                  backgroundSize: '8px 8px',
                }}
              />
              <MediaRenderer
                image={mediaData}
                variant="thumb"
                alt={previewAlt}
                className="w-full h-full object-cover relative z-10"
              />
            </div>
          ) : (
            <div className="w-[72px] h-[72px] border border-dashed border-line-high rounded flex items-center justify-center text-[10px] text-neutral-medium">
              No image
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
              onClick={() => setOpen(true)}
            >
              {id ? 'Change' : 'Choose'}
            </button>
            {id && (
              <button
                type="button"
                className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
                onClick={() => onChange(null)}
              >
                Clear
              </button>
            )}
            {previewAlt && (
              <div className="text-[11px] text-neutral-low truncate max-w-[240px]">
                {previewAlt}
              </div>
            )}
          </div>
        </div>
      </div>
      <MediaPickerModal
        open={open}
        onOpenChange={setOpen}
        initialSelectedId={id || undefined}
        onSelect={(m) => onChange(m.id)}
      />
    </div>
  )
}

