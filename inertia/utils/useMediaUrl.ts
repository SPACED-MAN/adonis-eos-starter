import { useMemo } from 'react'
import { pickMediaVariantUrl, type MediaVariant } from '../lib/media'
import { useTheme } from './ThemeContext'

export interface MediaObject {
  url: string
  metadata?: {
    variants?: MediaVariant[]
    darkSourceUrl?: string | null
    playMode?: 'autoplay' | 'inline' | 'modal'
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
  const { isDark } = useTheme()

  return useMemo(() => {
    if (!image) return null

    let resolved: any = null

    if (typeof image === 'string') {
      resolved = image
    } else if (typeof image === 'object' && image !== null) {
      const url = image.url || (image as any).baseUrl
      if (url) {
        resolved = pickMediaVariantUrl(url, image.metadata?.variants || (image as any).variants || [], variant, {
          darkSourceUrl: image.metadata?.darkSourceUrl || (image as any).darkSourceUrl,
          isDark,
        })
        console.log('[useMediaUrl] resolved object:', {
          id: image.id,
          url,
          darkSourceUrl: image.metadata?.darkSourceUrl || (image as any).darkSourceUrl,
          isDark,
          variant,
          resolved
        })
      }
    }

    if (resolved && typeof resolved !== 'string') {
      console.warn('[useMediaUrl] resolved value is not a string:', resolved, { image, variant })
      return null
    }

    return resolved
  }, [image, variant, isDark])
}

