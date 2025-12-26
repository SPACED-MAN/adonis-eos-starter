import { useEffect, useState } from 'react'
import { MediaRenderer } from '../../../components/MediaRenderer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { toast } from 'sonner'

type Props = {
  mediaId: string | null
  onChange: () => void
  onClear: () => void
  onDirty?: () => void
  fallbackUrl?: string
}

export function MediaThumb({ mediaId, onChange, onClear, onDirty, fallbackUrl }: Props) {
  const [mediaData, setMediaData] = useState<any | null>(null)
  const [localPlayMode, setLocalPlayMode] = useState<'autoplay' | 'inline' | 'modal'>('autoplay')

  const hasMedia = !!mediaId || !!fallbackUrl

  const xsrfFromCookie = typeof document !== 'undefined'
    ? (() => {
      const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
      return m ? decodeURIComponent(m[1]) : undefined
    })()
    : undefined

  async function updateMediaPlayMode(val: 'autoplay' | 'inline' | 'modal') {
    setLocalPlayMode(val)
    if (!mediaId) return
    try {
      const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
        method: 'PATCH',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          ...(xsrfFromCookie ? { 'X-XSRF-TOKEN': xsrfFromCookie } : {}),
        },
        credentials: 'same-origin',
        body: JSON.stringify({ playMode: val }),
      })
      if (!res.ok) throw new Error('Failed to update')
      toast.success('Video play mode saved')
      if (onDirty) onDirty()
    } catch {
      toast.error('Failed to save play mode')
    }
  }

  // Fetch media data when mediaId changes
  useEffect(() => {
    let alive = true
    async function load() {
      if (!mediaId) {
        if (alive) {
          setMediaData(null)
        }
        return
      }
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        const data = j?.data
        if (alive) {
          setMediaData(data || null)
          if (data?.metadata?.playMode) {
            setLocalPlayMode(data.metadata.playMode)
          }
        }
      } catch (err) {
        console.error('MediaThumb: Failed to load media', err)
        if (alive) {
          setMediaData(null)
        }
      }
    }
    load()
    return () => {
      alive = false
    }
  }, [mediaId])

  return (
    <div className="border border-line-low rounded p-2 bg-backdrop-low space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-backdrop-low dark:bg-backdrop-medium rounded border border-line-low overflow-hidden flex items-center justify-center shrink-0 relative">
          {/* Subtle checkerboard for transparency awareness */}
          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uAnRowBoEMBAQQWBgZAiM0E0DAAwiAsQD8LYYByDMc8EBIAVScG6S+69Z0AAAAASUVORK5CYII=")`,
              backgroundSize: '8px 8px'
            }}
          />
          {mediaData || fallbackUrl ? (
            <MediaRenderer
              image={mediaData}
              url={!mediaData ? fallbackUrl : undefined}
              variant="thumb"
              className="w-full h-full object-cover relative z-10"
              controls={false}
              autoPlay={false}
            />
          ) : (
            <span className="text-xs text-neutral-medium relative z-10">No media</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
            onClick={onChange}
          >
            {hasMedia ? 'Change' : 'Choose'}
          </button>
          {hasMedia && (
            <button
              type="button"
              className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
              onClick={onClear}
            >
              Remove
            </button>
          )}
        </div>
      </div>
      {(() => {
        const isVideo =
          mediaData?.mimeType?.startsWith('video/') ||
          mediaData?.url?.toLowerCase().endsWith('.mp4') ||
          mediaData?.url?.toLowerCase().endsWith('.webm') ||
          mediaData?.url?.toLowerCase().endsWith('.ogg')

        if (!isVideo) return null

        return (
          <div className="flex items-center gap-2 pt-1 border-t border-line-low">
            <label className="text-[10px] font-medium text-neutral-medium whitespace-nowrap">
              Play Mode:
            </label>
            <div className="flex-1">
              <Select value={localPlayMode} onValueChange={(v: any) => updateMediaPlayMode(v)}>
                <SelectTrigger className="h-7 text-[10px] py-0 px-2">
                  <SelectValue placeholder="Play Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="autoplay">Inline (Auto-loop)</SelectItem>
                  <SelectItem value="inline">Inline (Controls)</SelectItem>
                  <SelectItem value="modal">Open in Modal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
