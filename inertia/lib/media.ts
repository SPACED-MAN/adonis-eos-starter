export type MediaVariant = {
  name: string
  url: string
  width?: number | null
  height?: number | null
  size?: number | null
}

/**
 * Determine the best variant URL for a media asset, given a desired size name
 * and the current theme (light/dark).
 */
export function pickMediaVariantUrl(
  baseUrl: string | null | undefined,
  variants: MediaVariant[] | null | undefined,
  desiredVariant?: string | null,
  options?: { darkSourceUrl?: string | null; isDark?: boolean }
): string {
  if (!baseUrl || typeof baseUrl !== 'string') {
    return ''
  }

  const isDark =
    options?.isDark !== undefined
      ? options.isDark
      : typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const darkSourceUrl =
    options && typeof options.darkSourceUrl === 'string' && options.darkSourceUrl
      ? options.darkSourceUrl
      : undefined

  const allVariants = Array.isArray(variants) ? variants : []

  const pickLargest = (list: MediaVariant[]): string | null => {
    if (!list.length) return null
    const sorted = [...list].sort((a, b) => (b.width || b.height || 0) - (a.width || a.height || 0))
    return sorted[0]?.url || null
  }

  if (isDark) {
    // 1. Try dark variant of desired name
    if (desiredVariant) {
      const darkName = `${desiredVariant}-dark`
      const exact = allVariants.find((v) => v.name === darkName)
      if (exact?.url) {
        return exact.url
      }
    }

    // 2. Try any dark variant
    const darkVariants = allVariants.filter((v) => String(v.name || '').endsWith('-dark'))
    const largestDark = pickLargest(darkVariants)
    if (largestDark) {
      return largestDark
    }

    // 3. Try darkSourceUrl
    if (darkSourceUrl) {
      return darkSourceUrl
    }

    // 4. Fallback to light variant of desired name
    if (desiredVariant) {
      const exact = allVariants.find((v) => v.name === desiredVariant)
      if (exact?.url) {
        return exact.url
      }
    }

    // 5. Fallback to any variant (largest)
    const largestAny = pickLargest(allVariants)
    if (largestAny) {
      return largestAny
    }

    // 6. Final fallback
    return baseUrl
  } else {
    // Light mode:
    // 1. Try desired variant
    if (desiredVariant) {
      const exact = allVariants.find((v) => v.name === desiredVariant)
      if (exact?.url) return exact.url
    }

    // 2. Try any light variant
    const lightVariants = allVariants.filter((v) => !String(v.name || '').endsWith('-dark'))
    const largestLight = pickLargest(lightVariants)
    if (largestLight) return largestLight

    // 3. Final fallback: Use light original
    return baseUrl
  }
}
