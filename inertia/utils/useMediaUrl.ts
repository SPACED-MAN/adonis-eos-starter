import { useMemo } from 'react'
import { pickMediaVariant, type MediaVariant } from '../lib/media'
import { useTheme } from './ThemeContext'

export interface MediaObject {
  url: string
  metadata?: {
    variants?: MediaVariant[]
    darkSourceUrl?: string | null
    playMode?: 'autoplay' | 'inline' | 'modal'
    width?: number | null
    height?: number | null
    [key: string]: any
  } | null
  mimeType?: string | null
  altText?: string | null
  title?: string | null
  caption?: string | null
  description?: string | null
  [key: string]: any
}

/**
 * Hook to seamlessly resolve a media asset (URL + dimensions + srcset) based on the current theme.
 */
export function useMediaAsset(
  image: MediaObject | string | null | undefined,
  variant?: string | null
): { url: string | null; width: number | null; height: number | null; srcset?: string } {
  const { isDark } = useTheme()

  return useMemo(() => {
    if (!image) return { url: null, width: null, height: null }

    if (typeof image === 'string') {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (uuidRegex.test(image)) {
        return { url: null, width: null, height: null }
      }
      return { url: image, width: null, height: null }
    }

    const url = image.url || (image as any).baseUrl
    if (!url) return { url: null, width: null, height: null }

    const variants = (image.metadata?.variants || (image as any).variants || []) as MediaVariant[]

    const picked = pickMediaVariant(url, variants, variant, {
      darkSourceUrl: image.metadata?.darkSourceUrl || (image as any).darkSourceUrl,
      darkOptimizedUrl: image.metadata?.darkOptimizedUrl || (image as any).darkOptimizedUrl,
      darkOptimizedWidth: image.metadata?.darkOptimizedWidth || (image as any).darkOptimizedWidth,
      darkOptimizedHeight: image.metadata?.darkOptimizedHeight || (image as any).darkOptimizedHeight,
      optimizedUrl:
        image.optimizedUrl || image.metadata?.optimizedUrl || (image as any).optimizedUrl,
      optimizedWidth: image.width || image.metadata?.width || (image as any).width,
      optimizedHeight: image.height || image.metadata?.height || (image as any).height,
      isDark,
    })

    // Generate srcset from available variants of the same theme
    const themeVariants = variants.filter((v) => {
      const isVarDark = String(v.name || '').endsWith('-dark')
      return isDark ? isVarDark : !isVarDark
    })

    // Sort by width for srcset
    const sorted = [...themeVariants].sort((a, b) => (a.width || 0) - (b.width || 0))
    const srcset =
      sorted.length > 0
        ? sorted
          .map((v) => {
            const vUrl = v.optimizedUrl || v.url
            return vUrl && v.width ? `${vUrl} ${v.width}w` : null
          })
          .filter(Boolean)
          .join(', ')
        : undefined

    return {
      url: picked.optimizedUrl || picked.url || null,
      width: picked.width || null,
      height: picked.height || null,
      srcset,
    }
  }, [image, variant, isDark])
}

/**
 * Hook to seamlessly resolve a media URL based on the current theme.
 * Handles picking the best variant (e.g. thumb, wide) and dark mode version.
 *
 * @param image The media object or string URL
 * @param variant Optional desired variant name (e.g. 'thumb', 'wide')
 * @returns The resolved URL string
 */
export function useMediaUrl(
  image: MediaObject | string | null | undefined,
  variant?: string | null
): string | null {
  const asset = useMediaAsset(image, variant)
  return asset.url
}
