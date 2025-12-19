/**
 * Token Service - Decoupled utility for template tokens/variables.
 * Denoted by curly braces, e.g. {title}
 */

export interface TokenDefinition {
  name: string
  label: string
  description?: string
  category: 'post' | 'system' | 'custom' | 'settings'
}

export const SYSTEM_TOKENS: TokenDefinition[] = [
  { name: 'title', label: 'Post Title', category: 'post', description: 'The title of the post currently being edited' },
  { name: 'slug', label: 'Post Slug', category: 'post', description: 'The URL slug of the post' },
  { name: 'excerpt', label: 'Post Excerpt', category: 'post', description: 'The summary/excerpt of the post' },
  { name: 'locale', label: 'Locale', category: 'post', description: 'The current language/locale code (e.g. en, es)' },
  { name: 'type', label: 'Post Type', category: 'post', description: 'The content type slug (e.g. page, blog)' },
  { name: 'id', label: 'Post ID', category: 'post', description: 'The unique UUID of the post' },
  { name: 'now', label: 'Current Date', category: 'system', description: 'The current date and time' },
  { name: 'year', label: 'Current Year', category: 'system', description: 'The current year (e.g. 2025)' },
  { name: 'settings.siteTitle', label: 'Site Title', category: 'settings', description: 'Global site title' },
  { name: 'settings.defaultMetaDescription', label: 'Default Meta Description', category: 'settings', description: 'Global default meta description' },
]

export class TokenService {
  /**
   * Resolves tokens in a string using the provided context.
   */
  static resolve(text: string | null | undefined, context: any): string {
    if (!text || typeof text !== 'string') return text || ''

    return text.replace(/\{([^{}]+)\}/g, (match, tokenName) => {
      const value = TokenService.getTokenValue(tokenName, context)
      if (value !== undefined && value !== null) {
        return String(value)
      }
      return match // Keep as is if not found
    })
  }

  /**
   * Resolves tokens recursively in an object or array.
   */
  static resolveRecursive(obj: any, context: any): any {
    if (!obj) return obj

    if (typeof obj === 'string') {
      return TokenService.resolve(obj, context)
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => TokenService.resolveRecursive(item, context))
    }

    if (typeof obj === 'object') {
      const resolved: Record<string, any> = {}
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = TokenService.resolveRecursive(value, context)
      }
      return resolved
    }

    return obj
  }

  /**
   * Internal helper to extract value for a token name.
   */
  private static getTokenValue(tokenName: string, context: any): any {
    // Handle post. prefix if present
    const normalizedName = tokenName.startsWith('post.') ? tokenName.replace('post.', '') : tokenName
    const postTokens = [
      'title',
      'slug',
      'excerpt',
      'locale',
      'type',
      'id',
      'metaTitle',
      'metaDescription',
      'canonicalUrl',
    ]

    // 1. Check for post fields directly
    if (context.post) {
      const postValue = context.post[normalizedName]
      if (postValue !== undefined && postValue !== null) {
        // Prevent self-referencing tokens
        const strVal = String(postValue)
        if (strVal === `{${tokenName}}` || strVal === `{post.${normalizedName}}`) {
          return ''
        }
        return postValue
      } else if (postTokens.includes(normalizedName)) {
        // If it's a known post token but the value is missing, return empty string
        return ''
      }
    }

    // 2. Check for custom fields (e.g. {custom.my_field})
    if (tokenName.startsWith('custom.')) {
      const slug = tokenName.replace('custom.', '')
      if (context.customFields && context.customFields[slug] !== undefined) {
        return context.customFields[slug]
      }
      // Fallback: check post.customFields array if present
      if (context.post?.customFields) {
        const cf = context.post.customFields.find((f: any) => f.slug === slug)
        if (cf) return cf.value
      }
    }

    // 3. System tokens
    if (tokenName === 'now') return new Date().toISOString()
    if (tokenName === 'year') return new Date().getFullYear().toString()

    // 4. Site settings (e.g. {settings.siteTitle})
    if (tokenName.startsWith('settings.')) {
      const key = tokenName.replace('settings.', '')
      if (context.siteSettings && context.siteSettings[key] !== undefined) {
        return context.siteSettings[key]
      }
    }

    return undefined
  }

  /**
   * Extracts all unique token names from a string.
   */
  static extract(text: string): string[] {
    if (!text || typeof text !== 'string') return []
    const matches = text.match(/\{([^{}]+)\}/g)
    if (!matches) return []
    return Array.from(new Set(matches.map(m => m.slice(1, -1))))
  }

  /**
   * Gets a list of available tokens for UI display.
   */
  static getAvailableTokens(customFields?: Array<{ slug: string; label: string }>): TokenDefinition[] {
    const list = [...SYSTEM_TOKENS]
    if (customFields) {
      customFields.forEach(cf => {
        list.push({
          name: `custom.${cf.slug}`,
          label: `CF: ${cf.label || cf.slug}`,
          category: 'custom',
          description: `Custom field: ${cf.slug}`
        })
      })
    }
    return list
  }
}

export default TokenService

