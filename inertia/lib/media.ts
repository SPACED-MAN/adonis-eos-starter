export type MediaVariant = {
  name: string
  url: string
  width?: number | null
  height?: number | null
  size?: number | null
  optimizedUrl?: string | null
  optimizedSize?: number | null
}

/**
 * Determine the best variant for a media asset, given a desired size name
 * and the current theme (light/dark).
 * Returns the full variant object.
 */
export function pickMediaVariant(
  baseUrl: string | null | undefined,
  variants: MediaVariant[] | null | undefined,
  desiredVariant?: string | null,
  options?: {
    darkSourceUrl?: string | null
    darkOptimizedUrl?: string | null
    darkOptimizedWidth?: number | null
    darkOptimizedHeight?: number | null
    optimizedUrl?: string | null
    optimizedWidth?: number | null
    optimizedHeight?: number | null
    isDark?: boolean
  }
): MediaVariant {
  const empty: MediaVariant = { name: 'original', url: baseUrl || '' }
  if (!baseUrl || typeof baseUrl !== 'string') {
    return empty
  }

  const isDark =
    options?.isDark !== undefined
      ? options.isDark
      : typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const darkSourceUrl = options?.darkSourceUrl || undefined
  const darkOptimizedUrl = options?.darkOptimizedUrl || undefined
  const optimizedUrl = options?.optimizedUrl || undefined

  const allVariants = Array.isArray(variants) ? variants : []

  const pickLargest = (list: MediaVariant[]): MediaVariant | null => {
    if (!list.length) return null
    const sorted = [...list].sort((a, b) => (b.width || b.height || 0) - (a.width || a.height || 0))
    return sorted[0]
  }

  if (isDark) {
    // 1. Try dark variant of desired name
    if (desiredVariant) {
      const darkName = `${desiredVariant}-dark`
      const exact = allVariants.find((v) => v.name === darkName)
      if (exact) return exact
    }

    // 2. Try any dark variant
    const darkVariants = allVariants.filter((v) => String(v.name || '').endsWith('-dark'))
    const largestDark = pickLargest(darkVariants)
    if (largestDark) return largestDark

    // 3. Try darkSourceUrl (prefer optimized)
    if (darkOptimizedUrl || darkSourceUrl) {
      return {
        name: 'dark-original',
        url: darkOptimizedUrl || darkSourceUrl || '',
        width: options?.darkOptimizedWidth || null,
        height: options?.darkOptimizedHeight || null,
      }
    }

    // 4. Fallback to light variant of desired name
    if (desiredVariant) {
      const exact = allVariants.find((v) => v.name === desiredVariant)
      if (exact) return exact
    }

    // 5. Fallback to any variant (largest)
    const largestAny = pickLargest(allVariants)
    if (largestAny) return largestAny

    // 6. Final fallback
    return {
      name: 'dark-fallback',
      url: darkOptimizedUrl || darkSourceUrl || optimizedUrl || baseUrl,
      width: options?.darkOptimizedWidth || options?.optimizedWidth || null,
      height: options?.darkOptimizedHeight || options?.optimizedHeight || null,
    }
  } else {
    // Light mode:
    // 1. Try desired variant
    if (desiredVariant) {
      const exact = allVariants.find((v) => v.name === desiredVariant)
      if (exact) return exact
    }

    // 2. Try any light variant
    const lightVariants = allVariants.filter((v) => !String(v.name || '').endsWith('-dark'))
    const largestLight = pickLargest(lightVariants)
    if (largestLight) return largestLight

    // 3. Final fallback: Use light original (prefer optimized)
    return {
      name: 'original',
      url: optimizedUrl || baseUrl,
      width: options?.optimizedWidth || null,
      height: options?.optimizedHeight || null,
    }
  }
}

/**
 * Determine the best variant URL for a media asset, given a desired size name
 * and the current theme (light/dark).
 */
export function pickMediaVariantUrl(
  baseUrl: string | null | undefined,
  variants: MediaVariant[] | null | undefined,
  desiredVariant?: string | null,
  options?: {
    darkSourceUrl?: string | null
    darkOptimizedUrl?: string | null
    optimizedUrl?: string | null
    isDark?: boolean
  }
): string {
  const v = pickMediaVariant(baseUrl, variants, desiredVariant, options)
  return v.optimizedUrl || v.url || ''
}

/**
 * Shared utility to check if a media item (or URL) represents a video.
 */
export function isMediaVideo(m: any): boolean {
  if (!m) return false
  const url = m.url || (typeof m === 'string' ? m : '')
  const mime = m.mimeType || m.mime_type
  return (
    (typeof mime === 'string' && mime.startsWith('video/')) ||
    /\.(mp4|webm|ogg|mov|m4v|avi)$/i.test(url.split('?')[0])
  )
}

/**
 * Shared utility to get a user-friendly label for a media item.
 * Prioritizes Alt Text for images and Title/Caption for videos.
 */
export function getMediaLabel(m: any): string {
  if (!m) return ''
  const originalFilename = m.originalFilename || m.original_filename || m.url?.split('/').pop() || ''
  const title = m.title || m.caption
  const alt = m.altText || m.alt

  if (isMediaVideo(m)) {
    return title || originalFilename
  }
  return alt || title || originalFilename
}
