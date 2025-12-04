import Post from '#models/post'
import localeService from '#services/locale_service'
import i18nConfig from '#config/i18n'

/**
 * Generate hreflang tags for a post with translations
 */
export async function generateHreflangTags(post: Post, baseUrl: string): Promise<string[]> {
  const tags: string[] = []

  // Get all translations (including original)
  const translations = await post.getAllTranslations()

  // Add hreflang for each translation
  for (const translation of translations) {
    const url = generatePostUrl(translation, baseUrl)
    tags.push(`<link rel="alternate" hreflang="${translation.locale}" href="${url}" />`)
  }

  // Add x-default for the default locale
  const defaultTranslation = translations.find((t) => t.locale === localeService.getDefaultLocale())

  if (defaultTranslation) {
    const defaultUrl = generatePostUrl(defaultTranslation, baseUrl)
    tags.push(`<link rel="alternate" hreflang="x-default" href="${defaultUrl}" />`)
  }

  return tags
}

/**
 * Generate URL for a post in a specific locale
 */
export function generatePostUrl(post: Post, baseUrl: string): string {
  const path = `/${post.type}/${post.slug}`
  const localizedPath = localeService.generateLocalizedUrl(path, post.locale)

  return `${baseUrl}${localizedPath}`
}

/**
 * Generate locale-aware URL
 */
export function generateLocalizedUrl(path: string, locale: string, baseUrl?: string): string {
  const localizedPath = localeService.generateLocalizedUrl(path, locale)

  return baseUrl ? `${baseUrl}${localizedPath}` : localizedPath
}

/**
 * Get post with fallback to default locale
 * This is useful when a translation doesn't exist
 */
export async function getPostWithFallback(
  slug: string,
  locale: string,
  postType?: string
): Promise<Post | null> {
  // Try to find post in requested locale
  const query = Post.query().where('slug', slug).where('locale', locale)

  if (postType) {
    query.where('type', postType)
  }

  let post = await query.first()

  // If not found and locale is not default, try default locale
  if (!post && locale !== localeService.getDefaultLocale()) {
    const defaultQuery = Post.query()
      .where('slug', slug)
      .where('locale', localeService.getDefaultLocale())

    if (postType) {
      defaultQuery.where('type', postType)
    }

    post = await defaultQuery.first()
  }

  return post
}

/**
 * Get content with locale fallback
 * For JSONB fields with locale-specific content
 */
export function getLocalizedContent<T = string>(
  content: Record<string, T> | T,
  locale: string
): T | null {
  // If content is not an object, return as-is
  if (typeof content !== 'object' || content === null) {
    return content as T
  }

  // Try requested locale
  if (locale in content) {
    return (content as Record<string, T>)[locale]
  }

  // Try default locale
  const defaultLocale = localeService.getDefaultLocale()
  if (defaultLocale in content) {
    return (content as Record<string, T>)[defaultLocale]
  }

  // Try any available locale
  const availableLocales = Object.keys(content)
  if (availableLocales.length > 0) {
    return (content as Record<string, T>)[availableLocales[0]]
  }

  return null
}

/**
 * Build locale switcher data for UI
 */
export async function buildLocaleSwitcher(
  post: Post,
  currentPath: string,
  baseUrl: string
): Promise<
  Array<{
    locale: string
    label: string
    url: string
    isActive: boolean
    isAvailable: boolean
  }>
> {
  const translations = await post.getAllTranslations()
  const supportedLocales = localeService.getSupportedLocales()

  return supportedLocales.map((locale) => {
    const translation = translations.find((t) => t.locale === locale)
    const isActive = locale === post.locale
    const isAvailable = translation !== undefined

    // If translation exists, generate proper URL
    const url = isAvailable
      ? generatePostUrl(translation!, baseUrl)
      : localeService.generateLocalizedUrl(currentPath, locale)

    return {
      locale,
      label: getLocaleLabel(locale),
      url,
      isActive,
      isAvailable,
    }
  })
}

/**
 * Get human-readable label for locale
 * TODO: Expand this with more locales as needed
 */
export function getLocaleLabel(locale: string): string {
  const labels: Record<string, string> = {
    en: 'English',
    es: 'Español',
    fr: 'Français',
    de: 'Deutsch',
    it: 'Italiano',
    pt: 'Português',
    ja: '日本語',
    zh: '中文',
    ko: '한국어',
    ar: 'العربية',
    ru: 'Русский',
  }

  return labels[locale] || locale.toUpperCase()
}

/**
 * Validate locale parameter
 */
export function validateLocale(locale: string): {
  isValid: boolean
  locale: string
  error?: string
} {
  if (!locale) {
    return {
      isValid: false,
      locale: localeService.getDefaultLocale(),
      error: 'Locale is required',
    }
  }

  if (!localeService.isLocaleSupported(locale)) {
    return {
      isValid: false,
      locale: localeService.getDefaultLocale(),
      error: `Locale '${locale}' is not supported`,
    }
  }

  return {
    isValid: true,
    locale,
  }
}

/**
 * Extract locale from URL path
 */
export function extractLocaleFromPath(path: string): {
  locale: string
  cleanPath: string
} {
  if (!i18nConfig.useUrlPrefix) {
    return {
      locale: localeService.getDefaultLocale(),
      cleanPath: path,
    }
  }

  const match = path.match(/^\/([a-z]{2})(\/|$)/)
  if (match && localeService.isLocaleSupported(match[1])) {
    return {
      locale: match[1],
      cleanPath: path.slice(3) || '/',
    }
  }

  return {
    locale: localeService.getDefaultLocale(),
    cleanPath: path,
  }
}
