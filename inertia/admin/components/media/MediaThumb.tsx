import { useEffect, useMemo, useState } from 'react'
import { pickMediaVariantUrl, type MediaVariant } from '../../../lib/media'

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
}

export function MediaThumb({ mediaId, onChange, onClear }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [mediaData, setMediaData] = useState<{
    baseUrl: string
    variants: MediaVariant[]
    darkSourceUrl?: string
  } | null>(null)
  const isDark = useIsDarkMode()

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
        const variants: MediaVariant[] = Array.isArray(meta?.variants)
          ? (meta.variants as MediaVariant[])
          : []
        const darkSourceUrl =
          typeof meta.darkSourceUrl === 'string' ? (meta.darkSourceUrl as string) : undefined
        if (alive) {
          setMediaData({ baseUrl, variants, darkSourceUrl })
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
    setPreviewUrl(resolved)
  }, [mediaData, isDark])

  return (
    <div className="border border-line-low rounded p-2 bg-backdrop-low flex items-center gap-3">
      <div className="w-16 h-16 bg-backdrop-medium rounded overflow-hidden flex items-center justify-center">
        {previewUrl ? (
          <img
            src={previewUrl}
            alt=""
            className="w-full h-full object-cover"
            key={`${previewUrl}-${isDark}`}
          />
        ) : (
          <span className="text-xs text-neutral-medium">No image</span>
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
  )
}


