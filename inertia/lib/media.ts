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
 *
 * - If `desiredVariant` is provided, we try to honor it (and its -dark partner in dark mode).
 * - If it's missing, we pick the largest variant for the current theme.
 * - If no variants match the theme, we fall back to any largest variant, then baseUrl.
 */
export function pickMediaVariantUrl(
  baseUrl: string,
  variants: MediaVariant[] | null | undefined,
  desiredVariant?: string | null
): string {
  if (!Array.isArray(variants) || variants.length === 0) {
    return baseUrl
  }

  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')

  const pickLargest = (list: MediaVariant[]): string | null => {
    if (!list.length) return null
    const sorted = [...list].sort((a, b) => (b.width || b.height || 0) - (a.width || a.height || 0))
    return sorted[0]?.url || null
  }

  if (desiredVariant) {
    const desired = String(desiredVariant)
    const darkName = `${desired}-dark`

    // Prefer theme-aware name first
    const preferredName = isDark ? darkName : desired
    const exact =
      variants.find((v) => v.name === preferredName) ||
      (!isDark && variants.find((v) => v.name === desired)) ||
      (isDark && variants.find((v) => v.name === darkName))
    if (exact?.url) {
      return exact.url
    }
  }

  // No specific size requested or not found: pick best for theme
  const darkVariants = variants.filter((v) => String(v.name || '').endsWith('-dark'))
  const lightVariants = variants.filter((v) => !String(v.name || '').endsWith('-dark'))

  if (isDark && darkVariants.length > 0) {
    return pickLargest(darkVariants) || baseUrl
  }
  if (!isDark && lightVariants.length > 0) {
    return pickLargest(lightVariants) || baseUrl
  }

  // Fallback: any variant
  const anyUrl = pickLargest(variants)
  return anyUrl || baseUrl
}
