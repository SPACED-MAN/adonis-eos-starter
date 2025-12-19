import { useEffect, useMemo, useState } from 'react'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'
import { MediaRenderer } from '../../../components/MediaRenderer'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import { toast } from 'sonner'

function useIsDarkMode() {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'))
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'))
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [])

  return isDark
}

type Props = {
  mediaId: string | null
  onChange: () => void
  onClear: () => void
  onDirty?: () => void
}

export function MediaThumb({ mediaId, onChange, onClear, onDirty }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaData, setMediaData] = useState<{
    baseUrl: string
    mimeType?: string
    variants: MediaVariant[]
    darkSourceUrl?: string
    playMode?: 'autoplay' | 'inline' | 'modal'
  } | null>(null)
  const [localPlayMode, setLocalPlayMode] = useState<'autoplay' | 'inline' | 'modal'>('autoplay')
  const isDark = useIsDarkMode()

  const xsrfFromCookie = useMemo(() => {
    if (typeof document === 'undefined') return undefined
    const m = document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)
    return m ? decodeURIComponent(m[1]) : undefined
  }, [])

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
    ;(async () => {
      if (!mediaId) {
        if (alive) {
          setMediaData(null)
          setPreviewUrl(null)
        }
        return
      }
      try {
        const res = await fetch(`/api/media/${encodeURIComponent(mediaId)}`, {
          credentials: 'same-origin',
        })
        const j = await res.json().catch(() => ({}))
        const data = j?.data
        if (!data) {
          if (alive) {
            setMediaData(null)
            setPreviewUrl(null)
          }
          return
        }
        const baseUrl: string | null = data.url || null
        if (!baseUrl) {
          if (alive) {
            setMediaData(null)
            setPreviewUrl(null)
          }
          return
        }
        const meta = (data as any).metadata || {}
        const playMode = meta.playMode || 'autoplay'
        const variants: MediaVariant[] = Array.isArray(meta?.variants)
          ? (meta.variants as MediaVariant[])
          : []
        const darkSourceUrl =
          typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
        if (alive) {
          setMediaData({ baseUrl, mimeType: data.mimeType, variants, darkSourceUrl, playMode })
          setLocalPlayMode(playMode)
        }
      } catch (err) {
        console.error('MediaThumb: Failed to load media', err)
        if (alive) {
          setMediaData(null)
          setPreviewUrl(null)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [mediaId])

  // Compute display URL when media data or theme changes
  useEffect(() => {
    if (!mediaData) {
      setPreviewUrl(null)
      return
    }
    const adminThumb =
      (typeof process !== 'undefined' &&
        process.env &&
        (process.env as any).MEDIA_ADMIN_THUMBNAIL_VARIANT) ||
      'thumb'
    const resolved = pickMediaVariantUrl(mediaData.baseUrl, mediaData.variants, adminThumb, {
      darkSourceUrl: mediaData.darkSourceUrl,
    })
    setPreviewUrl(resolved || mediaData.baseUrl)
  }, [mediaData, isDark])

  return (
    <div className="border border-line-low rounded p-2 bg-backdrop-low space-y-2">
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 bg-backdrop-medium rounded overflow-hidden flex items-center justify-center shrink-0">
          {mediaData ? (
            <MediaRenderer
              url={previewUrl}
              mimeType={mediaData.mimeType}
              className="w-full h-full object-cover"
              key={`${previewUrl}-${isDark}`}
              controls={false}
              autoPlay={false}
              playMode={mediaData.playMode}
            />
          ) : (
            <span className="text-xs text-neutral-medium">No media</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="px-2 py-1 text-xs border border-line-medium rounded hover:bg-backdrop-medium text-neutral-medium"
            onClick={onChange}
          >
            {mediaId ? 'Change' : 'Choose'}
          </button>
          {mediaId && (
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
          mediaData?.baseUrl?.toLowerCase().endsWith('.mp4') ||
          mediaData?.baseUrl?.toLowerCase().endsWith('.webm') ||
          mediaData?.baseUrl?.toLowerCase().endsWith('.ogg')

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
